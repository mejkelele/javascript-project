import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const Answer = sequelize.define(
  "Answer",
  {
    session_id: { type: DataTypes.INTEGER, allowNull: false },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    answer_text: { type: DataTypes.TEXT },
    is_correct: { type: DataTypes.BOOLEAN },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "answers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default Answer;
