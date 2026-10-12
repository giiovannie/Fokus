import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
export const AdminEvent = sequelize.define('AdminEvent', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  actor_id: { type: D.INTEGER.UNSIGNED, allowNull: true },
  target_id: { type: D.INTEGER.UNSIGNED, allowNull: true },
  action: { type: D.ENUM('suspend', 'reactivate', 'delete'), allowNull: false },
  reason: { type: D.STRING(500), allowNull: true },
}, { tableName: 'admin_events' })
