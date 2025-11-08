import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const QuestionOption = sequelize.define(
  "QuestionOption",
  {
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    is_correct: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: "question_options",
    timestamps: false,
  }
);

export default QuestionOption;
