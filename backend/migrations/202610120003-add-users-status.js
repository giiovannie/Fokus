import { DataTypes as D } from 'sequelize'
export const kind = 'add_columns'
export const table = 'users'
export const columns = () => ({ status: { type: D.ENUM('active', 'suspended'), allowNull: false, defaultValue: 'active' } })
