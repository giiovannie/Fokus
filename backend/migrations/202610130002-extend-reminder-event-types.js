import { DataTypes as D } from 'sequelize'
export const table = 'notification_reminders'
export const kind = 'extend_enum'
export const previousColumns = () => ({ event_type: { type: D.ENUM('exam', 'task'), allowNull: false } })
export const columns = () => ({ event_type: { type: D.ENUM('exam', 'task', 'agenda'), allowNull: false } })
