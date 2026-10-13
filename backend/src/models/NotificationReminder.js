import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
const NotificationReminder = sequelize.define('NotificationReminder', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'reminder_identity' },
  event_type: { type: D.ENUM('exam', 'task', 'agenda'), allowNull: false, unique: 'reminder_identity' },
  event_id: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'reminder_identity' },
  offset_minutes: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'reminder_identity' },
  due_at: { type: D.DATE, allowNull: false },
  event_at: { type: D.DATE, allowNull: false },
  status: { type: D.ENUM('pending', 'processed', 'failed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  source_hash: { type: D.CHAR(64), allowNull: false },
  last_phrase: { type: D.STRING(240), allowNull: true },
  cancellation_reason: { type: D.STRING(40), allowNull: true },
}, { indexes: [{ name: 'reminder_due', fields: ['status', 'due_at', 'id'] }], tableName: 'notification_reminders' })
export { NotificationReminder }
