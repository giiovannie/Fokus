import { DataTypes as D } from 'sequelize'
import { baseColumns } from '../src/migrations/schema.js'

export const table = 'users'
export const columns = () => ({
  ...baseColumns(),
  email: { type: D.STRING(160), allowNull: false, unique: true },
  password: { type: D.STRING(255), allowNull: false },
})

