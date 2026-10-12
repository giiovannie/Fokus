import { DataTypes as D } from 'sequelize'
import { baseColumns } from '../src/migrations/schema.js'
export const table = 'admin_events'
export const columns = () => ({
  ...baseColumns(),
  actor_id: { type: D.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
  target_id: { type: D.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
  action: { type: D.ENUM('suspend', 'reactivate', 'delete'), allowNull: false },
  reason: { type: D.STRING(500), allowNull: true },
})
