import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const TestSession = sequelize.define(
  "TestSession",
  {
    test_id: { type: DataTypes.INTEGER, allowNull: false },
    guest_name: { type: DataTypes.STRING(100) },
    started_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    finished_at: { type: DataTypes.DATE },
    score: { type: DataTypes.FLOAT },
  },
  {
    tableName: "test_sessions",
    timestamps: false,
  }
);

export default TestSession;
