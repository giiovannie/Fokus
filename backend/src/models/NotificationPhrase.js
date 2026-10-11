import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
const NotificationPhrase = sequelize.define('NotificationPhrase', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: D.INTEGER.UNSIGNED, allowNull: false, unique: 'notification_phrase_content' },
  event_type: { type: D.ENUM('exam', 'task'), allowNull: false, unique: 'notification_phrase_content' },
  content: { type: D.STRING(240), allowNull: false, unique: 'notification_phrase_content', validate: { len: [1, 240] } },
}, { tableName: 'notification_phrases' })
export { NotificationPhrase }
