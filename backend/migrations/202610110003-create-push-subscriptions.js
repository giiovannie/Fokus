import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'
export const table = 'push_subscriptions'
export const columns = () => ({
  ...baseColumns(),
  user_id: { ...foreignKey('users'), unique: 'push_user_device' },
  device_id: { type: D.STRING(36), allowNull: false, unique: 'push_user_device' },
  device_label: { type: D.STRING(100), allowNull: false, defaultValue: 'Este navegador' },
  endpoint: { type: D.TEXT, allowNull: false },
  endpoint_hash: { type: D.CHAR(64), allowNull: false, unique: true },
  p256dh: { type: D.STRING(87), allowNull: false },
  auth: { type: D.STRING(22), allowNull: false },
})
