import { DataTypes as D } from 'sequelize'
import { baseColumns, foreignKey } from '../src/migrations/schema.js'

export const table = 'profiles'
export const columns = () => ({
  ...baseColumns(),
  name: { type: D.STRING(80), allowNull: false },
  last_name: { type: D.STRING(80), allowNull: false },
  nickname: { type: D.STRING(80) },
  avatar_url: { type: D.STRING(500) },
  preferences: { type: D.JSON },
  user_id: { ...foreignKey('users'), unique: true },
})

