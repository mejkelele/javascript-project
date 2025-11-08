import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const Test = sequelize.define(
  "Test",
  {
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    access_code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    is_public: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "tests",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default Test;
