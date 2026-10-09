import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { QueryTypes } from 'sequelize'

const directory = new URL('../../migrations/', import.meta.url)
const metadataTable = 'FokusMigrations'

export class MigrationError extends Error {
  constructor(message) { super(message); this.name = 'MigrationError' }
}

export const migrationChecksum = (source, helper) => createHash('sha256')
  .update(source.toString().replaceAll('\r\n', '\n'))
  .update(helper.toString().replaceAll('\r\n', '\n'))
  .digest('hex')

export const loadMigrations = async () => {
  const helper = await readFile(new URL('./schema.js', import.meta.url))
  const names = (await readdir(directory)).filter((name) => /^\d{12}-[a-z-]+\.js$/.test(name)).sort()
  return Promise.all(names.map(async (name) => {
    const url = new URL(name, directory)
    const source = await readFile(url)
    const { table, columns } = await import(url.href)
    const checksum = migrationChecksum(source, helper)
    return { name, checksum, table, columns }
  }))
}

const readState = async (query, migrations) => {
  const [settings] = await query('SELECT @@lower_case_table_names AS lower_case_table_names')
  const caseMode = Number(settings?.lower_case_table_names)
  if (![0, 1, 2].includes(caseMode)) throw new MigrationError('No se pudo determinar la sensibilidad de nombres de tablas')
  const tables = (await query('SHOW TABLES')).map((row) => Object.values(row)[0])
  const findTable = (name) => {
    const matches = tables.filter((table) => caseMode === 0 ? table === name : table.toLowerCase() === name.toLowerCase())
    if (matches.length > 1) throw new MigrationError('Nombres de tablas ambiguos; detener el despliegue')
    return matches[0]
  }
  const historyTable = findTable(metadataTable)
  const applied = historyTable
    ? await query(`SELECT name, checksum FROM \`${historyTable.replaceAll('`', '``')}\` ORDER BY name`)
    : []
  for (let i = 0; i < applied.length; i++) {
    if (applied[i].name !== migrations[i]?.name || applied[i].checksum !== migrations[i]?.checksum) {
      throw new MigrationError('El historial de migraciones difiere del código; detener el despliegue')
    }
    if (!findTable(migrations[i].table)) throw new MigrationError('Falta una tabla registrada en el historial de migraciones')
  }
  const pending = migrations.slice(applied.length)
  if (pending.some((item) => findTable(item.table)) || (!historyTable && tables.length > 0)) {
    throw new MigrationError('Base existente o migración parcial sin historial válido; requiere revisión y respaldo antes de continuar')
  }
  return { applied, pending, tables, historyTable }
}

export const migrationStatus = async (sequelize) => readState(
  (sql) => sequelize.query(sql, { type: QueryTypes.SELECT, logging: false }),
  await loadMigrations(),
)

export const verifyMigrations = async (sequelize) => {
  const state = await migrationStatus(sequelize)
  if (state.pending.length) throw new MigrationError('Hay migraciones pendientes; ejecutarlas manualmente antes del despliegue')
  return state
}

export const createTableSql = (sequelize, table, columns) => {
  const generator = sequelize.getQueryInterface().queryGenerator
  const normalized = Object.fromEntries(Object.entries(columns).map(([name, column]) => [name, sequelize.normalizeAttribute(column)]))
  const attributes = generator.attributesToSQL(normalized, { table, context: 'createTable' })
  // Sin IF NOT EXISTS: nunca aceptar silenciosamente una tabla con otro esquema.
  return generator.createTableQuery(table, attributes, { engine: 'InnoDB' }).replace('CREATE TABLE IF NOT EXISTS', 'CREATE TABLE')
}

export const migrate = async (sequelize) => {
  const migrations = await loadMigrations()
  const connection = await sequelize.connectionManager.getConnection({ type: 'WRITE' })
  const client = connection.promise()
  const query = async (sql, values) => (await client.query(sql, values))[0]
  const lock = `fokus-migrations-${createHash('sha256').update(sequelize.config.database).digest('hex').slice(0, 40)}`
  let locked = false
  try {
    const rows = await query('SELECT GET_LOCK(?, 0) AS acquired', [lock])
    if (Number(rows[0].acquired) !== 1) throw new MigrationError('Otra ejecución de migraciones está activa')
    locked = true
    const state = await readState(query, migrations)
    if (!state.historyTable) {
      await query(`CREATE TABLE \`${metadataTable}\` (name VARCHAR(255) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`)
    }
    // MySQL DDL no permite rollback de todo el lote. Registrar cada tabla solo
    // después de crearla; cualquier fallo detiene el proceso sin eliminar datos.
    for (const item of state.pending) {
      await query(createTableSql(sequelize, item.table, item.columns()))
      await query(`INSERT INTO \`${metadataTable}\` (name, checksum) VALUES (?, ?)`, [item.name, item.checksum])
    }
  } finally {
    try {
      if (locked) {
        const rows = await query('SELECT RELEASE_LOCK(?) AS released', [lock])
        if (Number(rows[0].released) !== 1) throw new MigrationError('No se pudo liberar el bloqueo de migraciones')
      }
    } catch (error) {
      connection.destroy()
      throw error
    } finally {
      await sequelize.connectionManager.releaseConnection(connection)
    }
  }
}
