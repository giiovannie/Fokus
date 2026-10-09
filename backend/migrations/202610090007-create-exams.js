import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'

export const table = 'exams'
export const columns = () => ({
  ...baseColumns(),
  title: { type: D.STRING(180), allowNull: false },
  exam_date: { type: D.DATEONLY, allowNull: false },
  topics: { type: D.TEXT },
  grade: { type: D.DECIMAL(4, 2) },
  subject_id: foreignKey('subjects'),
})

