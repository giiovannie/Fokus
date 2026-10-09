import { describe, expect, it, vi } from 'vitest'
import { sequelize } from '../src/models/index.js'
import { createTableSql, loadMigrations, migrate, migrationChecksum, migrationStatus, verifyMigrations } from '../src/migrations/runner.js'
import { createHash } from 'node:crypto'

const migrations = await loadMigrations()
const history = migrations.map(({ name, checksum }) => ({ name, checksum }))
const tables = ['FokusMigrations', ...migrations.map((item) => item.table)]
const statusDb = (tableNames, rows = [], caseMode = 0) => ({
  query: vi.fn(async (sql) => sql.includes('@@lower_case_table_names') ? [{ lower_case_table_names: caseMode }] : sql === 'SHOW TABLES' ? tableNames.map((name) => ({ table: name })) : rows),
})

const migrationDb = (tableNames = [], rows = [], acquired = 1, caseMode = 0) => {
  const query = vi.fn(async (sql) => {
    if (sql.includes('GET_LOCK')) return [[{ acquired }]]
    if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }]]
    if (sql.includes('@@lower_case_table_names')) return [[{ lower_case_table_names: caseMode }]]
    if (sql === 'SHOW TABLES') return [tableNames.map((name) => ({ table: name }))]
    if (sql.startsWith('SELECT name')) return [rows]
    return [[]]
  })
  const connection = { promise: () => ({ query }), destroy: vi.fn() }
  return { query, db: {
    config: { database: 'test-only' },
    getQueryInterface: () => sequelize.getQueryInterface(),
    normalizeAttribute: (attr) => sequelize.normalizeAttribute(attr),
    connectionManager: { getConnection: vi.fn(async () => connection), releaseConnection: vi.fn() },
  } }
}

describe('migraciones del esquema actual', () => {
  it('conserva los hashes LF existentes y acepta CRLF sin ocultar cambios de código', () => {
    const source = 'migration\n', helper = 'schema\n'
    const current = createHash('sha256').update(source).update(helper).digest('hex')
    expect(migrationChecksum(source, helper)).toBe(current)
    expect(migrationChecksum('migration\r\n', 'schema\r\n')).toBe(current)
    expect(migrationChecksum('changed\n', helper)).not.toBe(current)
  })
  it('reproduce todos los atributos físicos y relaciones de los ocho modelos', () => {
    expect(migrations).toHaveLength(8)
    for (const item of migrations) {
      const model = Object.values(sequelize.models).find((value) => value.tableName === item.table)
      const columns = item.columns()
      const physical = Object.fromEntries(Object.values(model.rawAttributes).map((attr) => [attr.field, attr]))
      expect(Object.keys(columns).sort()).toEqual(Object.keys(physical).sort())
      for (const [name, column] of Object.entries(columns)) {
        const attr = physical[name]
        const generator = sequelize.getQueryInterface().queryGenerator
        const options = { escape: generator.escape.bind(generator) }
        expect(sequelize.normalizeAttribute(column).type.toSql(options)).toBe(attr.type.toSql(options))
        expect(column.allowNull ?? true).toBe(attr.primaryKey ? false : (attr.allowNull ?? true))
        expect(column.unique ?? false).toBe(attr.unique ?? false)
        expect(column.primaryKey ?? false).toBe(attr.primaryKey ?? false)
        expect(column.autoIncrement ?? false).toBe(attr.autoIncrement ?? false)
        expect(column.defaultValue).toEqual(attr.defaultValue)
        expect(column.references).toEqual(attr.references)
        expect(column.onDelete).toBe(attr.onDelete)
        expect(column.onUpdate).toBe(attr.onUpdate)
      }
      const sql = createTableSql(sequelize, item.table, columns)
      expect(sql).toContain('ENGINE=InnoDB')
      expect(sql).not.toContain('IF NOT EXISTS')
      expect(sql).not.toMatch(/DROP|TRUNCATE/)
      if (item.table === 'users') expect(sql).toMatch(/`email`[^,]+UNIQUE/)
      if (item.table === 'profiles') expect(sql).toMatch(/`user_id`[^,]+UNIQUE/)
    }
  })
  it('informa pendientes en una base vacía sin escribir', async () => {
    const db = statusDb([])
    expect((await migrationStatus(db)).pending).toHaveLength(8)
    expect(db.query).toHaveBeenCalledTimes(2)
    await expect(verifyMigrations(db)).rejects.toThrow('pendientes')
  })
  it('verifica el historial completo mediante consultas de lectura', async () => {
    const db = statusDb(tables, history)
    expect((await verifyMigrations(db)).pending).toHaveLength(0)
    expect(db.query.mock.calls.every(([sql]) => /^(SELECT|SHOW)/.test(sql))).toBe(true)
  })
  it.each([1, 2])('reconoce historial y tablas con distinta capitalización en modo %s', async (caseMode) => {
    const names = tables.map((name) => name.toUpperCase())
    const db = statusDb(names, history, caseMode)
    expect((await verifyMigrations(db)).pending).toHaveLength(0)
    expect(db.query.mock.calls.some(([sql]) => sql.includes('FROM `FOKUSMIGRATIONS`'))).toBe(true)
    const runner = migrationDb(names, history, 1, caseMode)
    await migrate(runner.db)
    expect(runner.query.mock.calls.some(([sql]) => /^(CREATE|INSERT)/.test(sql))).toBe(false)
  })
  it('en modo 0 no confunde tablas distintas por capitalización', async () => {
    await expect(verifyMigrations(statusDb(tables.map((name) => name.toLowerCase()), history, 0))).rejects.toThrow('Base existente')
    expect((await verifyMigrations(statusDb([...tables, 'fokusmigrations'], history, 0))).pending).toHaveLength(0)
    await expect(verifyMigrations(statusDb(tables.map((name) => name === 'users' ? 'USERS' : name), history, 0))).rejects.toThrow('Falta una tabla')
  })
  it.each([1, 2])('sigue rechazando tablas sin historial y checksums alterados en modo %s', async (caseMode) => {
    await expect(migrationStatus(statusDb(['USERS'], [], caseMode))).rejects.toThrow('Base existente')
    await expect(verifyMigrations(statusDb(tables.map((name) => name.toLowerCase()), [{ ...history[0], checksum: 'wrong' }], caseMode))).rejects.toThrow('historial')
  })
  it('rechaza modos desconocidos y nombres ambiguos', async () => {
    await expect(migrationStatus(statusDb([], [], 3))).rejects.toThrow('sensibilidad')
    await expect(migrationStatus(statusDb(['FokusMigrations', 'fokusmigrations'], [], 1))).rejects.toThrow('ambiguos')
  })
  it('rechaza historial alterado, tablas ausentes y bases existentes sin historial', async () => {
    await expect(verifyMigrations(statusDb(tables, [{ ...history[0], checksum: 'wrong' }]))).rejects.toThrow('historial')
    await expect(verifyMigrations(statusDb(['FokusMigrations'], history))).rejects.toThrow('Falta una tabla')
    await expect(migrationStatus(statusDb(['users']))).rejects.toThrow('Base existente')
  })
  it('rechaza migraciones parciales sin adoptar tablas', async () => {
    await expect(migrationStatus(statusDb(['FokusMigrations', 'users', 'profiles'], [history[0]]))).rejects.toThrow('parcial')
  })
  it('crea y registra en orden usando una misma conexión y bloqueo exclusivo', async () => {
    const { db, query } = migrationDb()
    await migrate(db)
    const writes = query.mock.calls.filter(([sql]) => /^(CREATE TABLE|INSERT)/.test(sql))
    expect(writes).toHaveLength(17)
    migrations.forEach((item, index) => {
      expect(writes[index * 2 + 1][0]).toContain(`CREATE TABLE \`${item.table}\``)
      expect(writes[index * 2 + 2][1]).toEqual([item.name, item.checksum])
    })
    expect(query.mock.calls.at(-1)[0]).toContain('RELEASE_LOCK')
    expect(db.connectionManager.releaseConnection).toHaveBeenCalledOnce()
  })
  it('no repite migraciones ya registradas', async () => {
    const { db, query } = migrationDb(tables, history)
    await migrate(db)
    expect(query.mock.calls.some(([sql]) => /^(CREATE|INSERT)/.test(sql))).toBe(false)
  })
  it('rechaza ejecución concurrente sin escribir', async () => {
    const { db, query } = migrationDb([], [], 0)
    await expect(migrate(db)).rejects.toThrow('Otra ejecución')
    expect(query).toHaveBeenCalledTimes(1)
    expect(db.connectionManager.releaseConnection).toHaveBeenCalledOnce()
  })
  it('no crea tablas en una base existente sin historial', async () => {
    const { db, query } = migrationDb(['users'])
    await expect(migrate(db)).rejects.toThrow('Base existente')
    expect(query.mock.calls.some(([sql]) => /^(CREATE|INSERT)/.test(sql))).toBe(false)
  })
  it('detiene un fallo parcial y libera el bloqueo sin borrar ni marcar éxito', async () => {
    const { db, query } = migrationDb()
    const implementation = query.getMockImplementation()
    query.mockImplementation(async (sql, values) => {
      if (sql.startsWith('CREATE TABLE `profiles`')) throw new Error('test failure')
      return implementation(sql, values)
    })
    await expect(migrate(db)).rejects.toThrow('test failure')
    expect(query.mock.calls.filter(([sql]) => sql.startsWith('INSERT'))).toHaveLength(1)
    expect(query.mock.calls.some(([sql]) => /DROP|TRUNCATE/.test(sql))).toBe(false)
    expect(query.mock.calls.at(-1)[0]).toContain('RELEASE_LOCK')
  })
})
