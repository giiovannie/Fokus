import { DataTypes as D } from 'sequelize'
export const table = 'notification_preferences'
export const kind = 'extend_enum'
const styles = ['formal', 'friendly', 'motivating', 'sarcastic', 'unfiltered']
export const previousColumns = () => Object.fromEntries(['exam_style', 'task_style'].map(name => [name,
  { type: D.ENUM(...styles), allowNull: false, defaultValue: 'formal' }]))
export const columns = () => Object.fromEntries(['exam_style', 'task_style'].map(name => [name,
  { type: D.ENUM(...styles, 'custom'), allowNull: false, defaultValue: 'formal' }]))
