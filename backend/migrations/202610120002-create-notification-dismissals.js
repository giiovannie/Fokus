import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'
export const table = 'notification_dismissals'
export const columns = () => ({
  ...baseColumns(),
  user_id: { ...foreignKey('users'), unique: 'inbox_dismissal_identity' },
  notification_key: { type: D.CHAR(64), allowNull: false, unique: 'inbox_dismissal_identity' },
})
