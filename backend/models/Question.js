import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const Question = sequelize.define(
  "Question",
  {
    test_id: { type: DataTypes.INTEGER, allowNull: false },
    question_type: {
      type: DataTypes.ENUM("ABC", "FILL", "OPEN"),
      allowNull: false,
    },
    text: { type: DataTypes.TEXT, allowNull: false },
    points: { type: DataTypes.INTEGER, defaultValue: 1 },
    order_index: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    tableName: "questions",
    timestamps: false,
  }
);

export default Question;
