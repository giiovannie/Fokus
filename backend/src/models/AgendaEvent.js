import { DataTypes as D } from 'sequelize'
import { sequelize } from '../config/database.js'
export const AgendaEvent = sequelize.define('AgendaEvent', {
  id: { type: D.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id: { type: D.INTEGER.UNSIGNED, allowNull: false }, title: { type: D.STRING(180), allowNull: false },
  description: { type: D.TEXT, allowNull: true }, kind: { type: D.ENUM('personal', 'academic'), allowNull: false },
  event_date: { type: D.DATEONLY, allowNull: false },
  event_time: { type: D.TIME, allowNull: true, defaultValue: null, get() { return this.getDataValue('event_time')?.slice(0, 5) ?? null } },
  subject_id: { type: D.INTEGER.UNSIGNED, allowNull: true, defaultValue: null },
  reminder_minutes: { type: D.INTEGER.UNSIGNED, allowNull: true, defaultValue: null },
}, { tableName: 'agenda_events', indexes: [{ name: 'agenda_user_date', fields: ['user_id', 'event_date', 'id'] }] })
