// Definiciones históricas de la primera versión: no cambiar tras aplicar.
import { DataTypes } from 'sequelize'

export const baseColumns = () => ({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
})

export const foreignKey = (model) => ({
  type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
  references: { model, key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
})

