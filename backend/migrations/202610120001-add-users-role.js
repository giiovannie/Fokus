import { DataTypes as D } from 'sequelize'
export const kind = 'add_columns'
export const table = 'users'
export const columns = () => ({ role: { type: D.ENUM('student', 'superadmin'), allowNull: false, defaultValue: 'student' } })
