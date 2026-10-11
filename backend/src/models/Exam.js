import { DataTypes } from 'sequelize'
import { sequelize } from '../config/database.js'

const Exam = sequelize.define('Exam', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(180), allowNull: false },
  exam_time: { type: DataTypes.TIME, allowNull: true, defaultValue: null, get() { return this.getDataValue('exam_time')?.slice(0, 5) ?? null } },
  exam_date: { type: DataTypes.DATEONLY, allowNull: false },
  topics: { type: DataTypes.TEXT },
  grade: { type: DataTypes.DECIMAL(4, 2), validate: { min: 0, max: 10 } },
  subject_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, { tableName: 'exams' })

export { Exam }
