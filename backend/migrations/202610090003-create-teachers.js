import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'

export const table = 'teachers'
export const columns = () => ({
  ...baseColumns(),
  name: { type: D.STRING(160), allowNull: false },
  user_id: foreignKey('users'),
})

