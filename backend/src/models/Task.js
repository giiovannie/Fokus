import { DataTypes } from 'sequelize'
import { sequelize } from '../config/database.js'

const Task = sequelize.define('Task', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(180), allowNull: false },
  description: { type: DataTypes.TEXT },
  due_time: { type: DataTypes.TIME, allowNull: true, defaultValue: null, get() { return this.getDataValue('due_time')?.slice(0, 5) ?? null } },
  due_date: { type: DataTypes.DATEONLY, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  subject_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, { tableName: 'tasks' })

export { Task }
