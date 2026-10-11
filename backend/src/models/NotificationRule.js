import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
const NotificationRule = sequelize.define('NotificationRule', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'notification_rule_offset' },
  event_type: { type: D.ENUM('exam', 'task'), allowNull: false, unique: 'notification_rule_offset' },
  offset_minutes: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'notification_rule_offset', validate: { min: 0, max: 43200 } },
  enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'notification_rules' })
export { NotificationRule }
