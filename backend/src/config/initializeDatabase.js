import { sequelize } from '../models/index.js'
import { verifyMigrations } from '../migrations/runner.js'

export const initializeDatabase = async () => {
  await sequelize.authenticate()
  await verifyMigrations(sequelize)
}

export const closeDatabase = async () => sequelize.close()
