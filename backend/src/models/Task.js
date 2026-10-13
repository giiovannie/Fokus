import { DataTypes } from 'sequelize'
import { sequelize } from '../config/database.js'

const Task = sequelize.define('Task', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(180), allowNull: false },
  description: { type: DataTypes.TEXT },
  due_time: { type: DataTypes.TIME, allowNull: true, defaultValue: null, get() { return this.getDataValue('due_time')?.slice(0, 5) ?? null } },
  due_date: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  subject_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, { tableName: 'tasks', indexes: [{ name: 'task_subject_date', fields: ['subject_id', 'due_date', 'id'] }] })

export { Task }
