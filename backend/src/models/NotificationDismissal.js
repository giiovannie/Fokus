import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
export const NotificationDismissal = sequelize.define('NotificationDismissal', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'inbox_dismissal_identity' },
  notification_key: { type: D.CHAR(64), allowNull: false, unique: 'inbox_dismissal_identity' },
}, { tableName: 'notification_dismissals' })
