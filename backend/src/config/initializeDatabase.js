import { sequelize } from '../models/index.js'
import { verifyMigrations } from '../migrations/runner.js'

export const initializeDatabase = async () => {
  await sequelize.authenticate()
  if (process.env.NODE_ENV === 'production') {
    await verifyMigrations(sequelize)
  } else {
    await sequelize.sync()
  }
}

export const closeDatabase = async () => sequelize.close()
