import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'
export const table = 'notification_rules'
export const columns = () => ({
  ...baseColumns(), user_id: { ...foreignKey('users'), unique: 'notification_rule_offset' },
  event_type: { type: D.ENUM('exam', 'task'), allowNull: false, unique: 'notification_rule_offset' },
  offset_minutes: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'notification_rule_offset', validate: { min: 0, max: 43200 } },
  enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
})
