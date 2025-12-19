import express from "express";
import { Test, Question, QuestionOption, User, TestSession, Answer } from "../models/index.js";

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Wymagane logowanie.' });
  }
  next();
};

// [GET] /api/tests/public/leaderboard/:code
router.get("/public/leaderboard/:code", async (req, res) => {
    try {
        const test = await Test.findOne({ where: { access_code: req.params.code } });
        if (!test) return res.status(404).json({ error: "Test nie istnieje" });

        const leaderboard = await TestSession.findAll({
            where: { test_id: test.id },
            attributes: ['guest_name', 'score', 'finished_at'],
            order: [['score', 'DESC'], ['finished_at', 'ASC']],
            limit: 10
        });

        res.json(leaderboard);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd rankingu" });
    }
});

// [GET] /api/tests/recent
router.get("/recent", async (req, res) => {
    try {
        const tests = await Test.findAll({
            where: { is_public: true },
            order: [['createdAt', 'DESC']],
            limit: 3,
            attributes: ['title', 'description', 'access_code', 'createdAt']
        });
        res.json(tests);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd pobierania najnowszych testów" });
    }
});

// [GET] /api/tests/public/:code
router.get("/public/:code", async (req, res) => {
    const { code } = req.params;
    try {
        const test = await Test.findOne({
            where: { access_code: code },
            attributes: ['id', 'title', 'description', 'is_public', 'show_answers'], 
            include: [
                {
                    model: Question,
                    attributes: ['id', 'text', 'question_type', 'points'],
                    include: [{ model: QuestionOption, attributes: ['id', 'text'] }]
                },
                { model: User, attributes: ['name'] }
            ]
        });

        if (!test) return res.status(404).json({ error: "Test nie istnieje lub kod jest błędny." });
        if (!test.is_public) return res.status(403).json({ error: "Ten test jest prywatny." });

        res.json(test);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd serwera." });
    }
});

// [GET] /api/tests
router.get("/", requireAuth, async (req, res) => {
  const user_id = req.session.userId;
  const tests = await Test.findAll({ 
    where: { user_id }, 
    order: [["id", "DESC"]] 
  });
  res.json(tests);
});

// [GET] /api/tests/:id/stats
router.get("/:id/stats", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    try {
        const test = await Test.findOne({ 
            where: { id, user_id: userId },
            include: [{ model: Question, attributes: ['id', 'text', 'points', 'question_type'] }] 
        });

        if (!test) return res.status(403).json({ error: "Brak dostępu lub test nie istnieje" });

        const sessions = await TestSession.findAll({
            where: { test_id: id },
            include: [
                { 
                    model: Answer,
                    include: [{ model: Question, attributes: ['id'] }] 
                }
            ],
            order: [['started_at', 'DESC']]
        });

        const totalMaxPoints = test.Questions.reduce((sum, q) => sum + (q.points || 0), 0);
        const count = sessions.length;
        const scores = sessions.map(s => s.score || 0);
        const avgScore = count > 0 ? (scores.reduce((a, b) => a + b, 0) / count).toFixed(1) : 0;
        const maxScore = count > 0 ? Math.max(...scores) : 0;

        res.json({
            title: test.title,
            scoreThresholds: test.scoreThresholds,
            totalMaxPoints,
            count,
            avgScore,
            maxScore,
            sessions,
            questions: test.Questions 
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd statystyk" });
    }
});

// [GET] /api/tests/:id (Edycja)
router.get("/:id", requireAuth, async (req, res) => {
    const user_id = req.session.userId;
    try {
        const test = await Test.findOne({
            where: { id: req.params.id, user_id }, 
            include: [{ model: Question, include: [QuestionOption] }]
        });
        if (!test) return res.status(404).json({ error: "Test nie znaleziony." });
        res.json(test);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd pobierania testu." });
    }
});

// [POST] /api/tests
router.post("/", requireAuth, async (req, res) => {
  const user_id = req.session.userId;
  const { 
      title, description, access_code, 
      is_public, show_answers, // <--- show_answers
      scoringMethod, scoreThresholds 
  } = req.body || {};
  
  if (!title || !access_code) return res.status(400).json({ error: "Brak wymaganych pól." });
  
  try {
    const t = await Test.create({ 
        user_id, 
        title, 
        description, 
        access_code, 
        is_public: is_public ?? true, 
        show_answers: show_answers ?? true, // <--- Zapisujemy
        scoringMethod: scoringMethod || "standard",
        scoreThresholds: scoreThresholds || [], 
    });
    res.status(201).json(t);
  } catch (e) {
    if (e?.name === "SequelizeUniqueConstraintError") return res.status(409).json({ error: "Kod dostępu już istnieje." });
    console.error(e);
    res.status(500).json({ error: "Błąd dodawania testu" });
  }
});

// [PUT] /api/tests/:id
router.put("/:id", requireAuth, async (req, res) => {
    const user_id = req.session.userId;
    const { id } = req.params;
    const { 
        title, description, is_public, show_answers, 
        scoringMethod, scoreThresholds 
    } = req.body;

    try {
        const test = await Test.findOne({ where: { id, user_id } });
        if (!test) return res.status(404).json({ error: "Nie znaleziono testu." });

        test.title = title;
        test.description = description;
        test.is_public = is_public;
        
        // Aktualizacja show_answers
        if (show_answers !== undefined) test.show_answers = show_answers;
        
        if (scoringMethod) test.scoringMethod = scoringMethod;
        if (scoreThresholds) test.scoreThresholds = scoreThresholds;

        await test.save();
        res.json(test);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd edycji testu." });
    }
});

// [POST] /api/tests/solve/:code
router.post("/solve/:code", async (req, res) => {
    const { code } = req.params;
    const { guest_name, answers } = req.body; 

    if (!guest_name) return res.status(400).json({ error: "Podaj imię!" });

    try {
        const test = await Test.findOne({
            where: { access_code: code },
            include: [{ model: Question, include: [QuestionOption] }]
        });

        if (!test) return res.status(404).json({ error: "Test nie istnieje." });

        const session = await TestSession.create({
            test_id: test.id,
            user_id: req.session.userId || null,
            guest_name,
            started_at: new Date(),
            finished_at: new Date(),
            score: 0
        });

        let totalScore = 0;
        let maxPoints = 0;
        let requiresGrading = false;
        
        // Statystyki
        let correctCount = 0;
        let incorrectCount = 0;
        let pendingCount = 0;

        const savedAnswers = [];
        const resultsDetails = {}; // Tutaj zbieramy info o odpowiedziach dla frontendu

        for (const question of test.Questions) {
            const userAnswer = answers[question.id]; 
            let isCorrect = false; 
            let pointsEarned = 0;

            // --- SPRAWDZANIE ODPOWIEDZI ---
            let correctOptionId = null;
            let correctText = null;

            if (question.question_type === 'ABC') {
                // Znajdź poprawną opcję (żeby zwrócić uczniowi, jeśli allowed)
                const correctOpt = question.QuestionOptions.find(o => o.is_correct);
                if (correctOpt) correctOptionId = correctOpt.id;

                const selectedOption = question.QuestionOptions.find(o => o.id == userAnswer);
                if (selectedOption && selectedOption.is_correct) isCorrect = true;
            } 
            else if (question.question_type === 'FILL') {
                correctText = question.QuestionOptions[0]?.text || "";
                if (userAnswer && String(userAnswer).trim().toLowerCase() === correctText.trim().toLowerCase()) {
                    isCorrect = true;
                }
            }
            else if (question.question_type === 'OPEN') {
                isCorrect = null;
                requiresGrading = true;
            }
            
            // --- PUNKTACJA ---
            if (isCorrect === true) {
                pointsEarned = question.points;
                totalScore += pointsEarned;
                correctCount++;
            } else if (isCorrect === false) {
                incorrectCount++;
            } else {
                pendingCount++; 
            }
            maxPoints += question.points;

            savedAnswers.push({
                session_id: session.id,
                question_id: question.id,
                answer_text: String(userAnswer || ''),
                is_correct: isCorrect
            });

            // --- BUDOWANIE RAPORTU DLA UCZNIA (jeśli włączone) ---
            if (test.show_answers) {
                resultsDetails[question.id] = {
                    isCorrect: isCorrect,
                    pointsEarned: isCorrect === true ? pointsEarned : 0,
                    correctOptionId: correctOptionId, // dla ABC
                    correctText: correctText,         // dla FILL
                    userAnswer: userAnswer            // to co wpisał
                };
            }
        }

        await Answer.bulkCreate(savedAnswers);
        session.score = totalScore;
        await session.save();

        // Średnia
        const allSessions = await TestSession.findAll({ 
            where: { test_id: test.id },
            attributes: ['score']
        });
        const totalSum = allSessions.reduce((sum, s) => sum + s.score, 0);
        const avgScore = allSessions.length > 0 ? (totalSum / allSessions.length).toFixed(1) : 0;

        res.json({
            message: "Test zakończony!",
            score: totalScore,
            maxPoints: maxPoints,
            requiresGrading,
            isPublic: test.is_public,
            stats: {
                correct: correctCount,
                incorrect: incorrectCount,
                pending: pendingCount,
                averageScore: avgScore,
                totalQuestions: test.Questions.length
            },
            // Zwracamy szczegóły tylko jeśli autor pozwolił
            resultsDetails: test.show_answers ? resultsDetails : null
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd zapisu odpowiedzi." });
    }
});

// [POST] /api/tests/sessions/:sessionId/grade
router.post("/sessions/:sessionId/grade", requireAuth, async (req, res) => {
    const { sessionId } = req.params;
    const { grades } = req.body; 

    try {
        const session = await TestSession.findByPk(sessionId, {
            include: [{ model: Answer, include: [Question] }]
        });
        if (!session) return res.status(404).json({ error: "Sesja nie istnieje" });

        for (const ans of session.Answers) {
            if (grades[ans.id] !== undefined) {
                ans.is_correct = grades[ans.id];
                await ans.save();
            }
        }

        let newScore = 0;
        for (const ans of session.Answers) {
            if (ans.is_correct === true) {
                newScore += ans.Question.points; 
            }
        }

        session.score = newScore;
        await session.save();

        res.json({ message: "Oceniono pomyślnie", newScore });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd oceniania" });
    }
});

export default router;