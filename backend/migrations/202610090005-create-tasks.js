import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'

export const table = 'tasks'
export const columns = () => ({
  ...baseColumns(),
  title: { type: D.STRING(180), allowNull: false },
  description: { type: D.TEXT },
  due_date: { type: D.DATEONLY, allowNull: false },
  status: { type: D.ENUM('pending', 'in_progress', 'completed'), allowNull: false, defaultValue: 'pending' },
  subject_id: foreignKey('subjects'),
})

