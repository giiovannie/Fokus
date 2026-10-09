import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'

export const table = 'subjects'
export const columns = () => ({
  ...baseColumns(),
  name: { type: D.STRING(160), allowNull: false },
  teacher_id: foreignKey('teachers'),
  user_id: foreignKey('users'),
})

