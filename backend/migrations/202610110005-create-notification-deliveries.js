import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'
export const table = 'notification_deliveries'
export const indexes = [{ name: 'delivery_retry', fields: ['status', 'next_attempt_at', 'id'] }]
export const columns = () => ({
  ...baseColumns(),
  reminder_id: { ...foreignKey('notification_reminders'), unique: 'delivery_identity' },
  device_id: { type: D.STRING(36), allowNull: false, unique: 'delivery_identity' },
  subscription_id: { ...foreignKey('push_subscriptions'), allowNull: true, defaultValue: null, onDelete: 'SET NULL' },
  subscription_hash: { type: D.CHAR(64), allowNull: false },
  status: { type: D.ENUM('pending', 'processing', 'sent', 'failed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  attempts: { type: D.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  next_attempt_at: { type: D.DATE, allowNull: false },
  attempted_at: { type: D.DATE, allowNull: true },
  sent_at: { type: D.DATE, allowNull: true },
  last_error_code: { type: D.STRING(40), allowNull: true },
})
