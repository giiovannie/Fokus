import { DataTypes as D } from 'sequelize'

export const kind = 'relax_nullability'
export const table = 'tasks'
export const previousColumns = () => ({ due_date: { type: D.DATEONLY, allowNull: false } })
export const columns = () => ({ due_date: { type: D.DATEONLY, allowNull: true, defaultValue: null } })
