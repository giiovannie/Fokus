import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'

export const table = 'task_notes'
export const columns = () => ({
  ...baseColumns(),
  content: { type: D.TEXT, allowNull: false },
  task_id: foreignKey('tasks'),
})

