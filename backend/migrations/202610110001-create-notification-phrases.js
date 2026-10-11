import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'
export const table = 'notification_phrases'
export const columns = () => ({
  ...baseColumns(),
  user_id: { ...foreignKey('users'), unique: 'notification_phrase_content' },
  event_type: { type: D.ENUM('exam', 'task'), allowNull: false, unique: 'notification_phrase_content' },
  content: { type: D.STRING(240), allowNull: false, unique: 'notification_phrase_content' },
})
