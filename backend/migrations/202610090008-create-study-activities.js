import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'

export const table = 'study_activities'
export const columns = () => ({
  ...baseColumns(),
  title: { type: D.STRING(180), allowNull: false },
  target_date: { type: D.DATEONLY, allowNull: false },
  status: { type: D.ENUM('pending', 'completed'), allowNull: false, defaultValue: 'pending' },
  subject_id: foreignKey('subjects'),
})

