import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
const PushSubscription = sequelize.define('PushSubscription', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'push_user_device' },
  device_id: { type: D.STRING(36), allowNull: false, unique: 'push_user_device' },
  device_label: { type: D.STRING(100), allowNull: false, defaultValue: 'Este navegador' },
  endpoint: { type: D.TEXT, allowNull: false },
  endpoint_hash: { type: D.CHAR(64), allowNull: false, unique: true },
  p256dh: { type: D.STRING(87), allowNull: false },
  auth: { type: D.STRING(22), allowNull: false },
}, { tableName: 'push_subscriptions' })
export { PushSubscription }
