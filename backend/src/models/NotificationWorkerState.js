import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
const NotificationWorkerState = sequelize.define('NotificationWorkerState', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  scope: { type: D.STRING(80), allowNull: false, unique: true },
  cursor: { type: D.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { tableName: 'notification_worker_state' })
export { NotificationWorkerState }
