import { DataTypes as D } from 'sequelize'
export const kind = 'add_columns'
export const table = 'tasks'
export const columns = () => ({ due_time: { type: D.TIME, allowNull: true, defaultValue: null } })
