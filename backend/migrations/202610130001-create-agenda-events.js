import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'
export const table = 'agenda_events'
export const indexes = [{ name: 'agenda_user_date', fields: ['user_id', 'event_date', 'id'] }]
export const columns = () => ({ ...baseColumns(), user_id: foreignKey('users'),
  title: { type: D.STRING(180), allowNull: false }, description: { type: D.TEXT, allowNull: true },
  kind: { type: D.ENUM('personal', 'academic'), allowNull: false },
  event_date: { type: D.DATEONLY, allowNull: false }, event_time: { type: D.TIME, allowNull: true, defaultValue: null },
  subject_id: { ...foreignKey('subjects'), allowNull: true, defaultValue: null, onDelete: 'SET NULL' },
  reminder_minutes: { type: D.INTEGER.UNSIGNED, allowNull: true, defaultValue: null },
})
