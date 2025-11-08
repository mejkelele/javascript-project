import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const Leaderboard = sequelize.define(
  "Leaderboard",
  {
    test_id: { type: DataTypes.INTEGER, allowNull: false },
    guest_name: { type: DataTypes.STRING(100), allowNull: false },
    score: { type: DataTypes.FLOAT, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "leaderboard",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default Leaderboard;
