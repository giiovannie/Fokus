import { DataTypes as D } from 'sequelize'
import { baseColumns } from '../src/migrations/schema.js'
export const table = 'notification_worker_state'
export const columns = () => ({
  ...baseColumns(),
  scope: { type: D.STRING(80), allowNull: false, unique: true },
  cursor: { type: D.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
})
