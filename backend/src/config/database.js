import { Sequelize } from 'sequelize'
import { getDatabaseOptions } from './databaseOptions.js'

const sequelize = new Sequelize(
  process.env.DB_NAME || '',
  process.env.DB_USER || '',
  process.env.DB_PASSWORD || '',
  getDatabaseOptions(),
)

export { sequelize }
