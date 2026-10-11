import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
const NotificationDelivery = sequelize.define('NotificationDelivery', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  reminder_id: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'delivery_identity' },
  device_id: { type: D.STRING(36), allowNull: false, unique: 'delivery_identity' },
  subscription_id: { type: D.INTEGER.UNSIGNED, allowNull: true, defaultValue: null },
  subscription_hash: { type: D.CHAR(64), allowNull: false },
  status: { type: D.ENUM('pending', 'processing', 'sent', 'failed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  attempts: { type: D.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  next_attempt_at: { type: D.DATE, allowNull: false },
  attempted_at: { type: D.DATE, allowNull: true },
  sent_at: { type: D.DATE, allowNull: true },
  last_error_code: { type: D.STRING(40), allowNull: true },
}, { indexes: [{ name: 'delivery_retry', fields: ['status', 'next_attempt_at', 'id'] }], tableName: 'notification_deliveries' })
export { NotificationDelivery }
