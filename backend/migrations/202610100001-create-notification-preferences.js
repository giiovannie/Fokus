import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'
export const table = 'notification_preferences'
export const columns = () => ({
  ...baseColumns(), user_id: { ...foreignKey('users'), unique: true },
  enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
  timezone: { type: D.STRING(100), allowNull: false, defaultValue: 'America/Argentina/Cordoba' },
  exams_enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
  tasks_enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
  exam_default_time: { type: D.TIME, allowNull: false, defaultValue: '09:00:00' },
  task_default_time: { type: D.TIME, allowNull: false, defaultValue: '09:00:00' },
  exam_style: { type: D.ENUM('formal', 'friendly', 'motivating', 'sarcastic', 'unfiltered'), allowNull: false, defaultValue: 'formal' },
  task_style: { type: D.ENUM('formal', 'friendly', 'motivating', 'sarcastic', 'unfiltered'), allowNull: false, defaultValue: 'formal' },
  unfiltered_enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
  unfiltered_consented_at: { type: D.DATE },
  quiet_hours_enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
  quiet_start: { type: D.TIME }, quiet_end: { type: D.TIME },
  revision: { type: D.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
})
