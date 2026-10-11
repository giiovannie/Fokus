import { DataTypes as D } from 'sequelize'
export const kind = 'add_columns'
export const table = 'exams'
export const columns = () => ({ exam_time: { type: D.TIME, allowNull: true, defaultValue: null } })
