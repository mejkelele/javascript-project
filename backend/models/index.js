import User from "./User.js";
import Test from "./Test.js";
import Question from "./Question.js";
import QuestionOption from "./QuestionOption.js";
import TestSession from "./TestSession.js";
import Answer from "./Answer.js";
import Leaderboard from "./Leaderboard.js";

// User 1..* Test
User.hasMany(Test, { foreignKey: "user_id" });
Test.belongsTo(User, { foreignKey: "user_id" });

// Test 1..* Question
Test.hasMany(Question, { foreignKey: "test_id" });
Question.belongsTo(Test, { foreignKey: "test_id" });

// Question 1..* QuestionOption
Question.hasMany(QuestionOption, { foreignKey: "question_id" });
QuestionOption.belongsTo(Question, { foreignKey: "question_id" });

// Test 1..* TestSession
Test.hasMany(TestSession, { foreignKey: "test_id" });
TestSession.belongsTo(Test, { foreignKey: "test_id" });

// TestSession 1..* Answer
TestSession.hasMany(Answer, { foreignKey: "session_id" });
Answer.belongsTo(TestSession, { foreignKey: "session_id" });

// Question 1..* Answer (trackowane pytanie)
Question.hasMany(Answer, { foreignKey: "question_id" });
Answer.belongsTo(Question, { foreignKey: "question_id" });

// Test 1..* Leaderboard
Test.hasMany(Leaderboard, { foreignKey: "test_id" });
Leaderboard.belongsTo(Test, { foreignKey: "test_id" });

export {
  User,
  Test,
  Question,
  QuestionOption,
  TestSession,
  Answer,
  Leaderboard,
};
