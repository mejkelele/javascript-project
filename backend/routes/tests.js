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

// [GET] /api/tests/recent - 3 najnowsze publiczne testy
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
                    attributes: ['id', 'text', 'question_type', 'points', 'is_multiple_choice'],
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

// [GET] /api/tests (Moje testy)
router.get("/", requireAuth, async (req, res) => {
  const user_id = req.session.userId;
  const tests = await Test.findAll({ 
    where: { user_id }, 
    order: [["id", "DESC"]] 
  });
  res.json(tests);
});

// [GET] /api/tests/:id/stats — Statystyki dla autora (ROZSZERZONE)
router.get("/:id/stats", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    try {
        const test = await Test.findOne({ 
            where: { id, user_id: userId },
            include: [{ model: Question, attributes: ['points'] }] 
        });

        if (!test) return res.status(403).json({ error: "Brak dostępu" });

        // Pobieramy sesje WRAZ z odpowiedziami i punktami
        const sessions = await TestSession.findAll({
            where: { test_id: id },
            include: [
                { 
                    model: Answer,
                    include: [{ model: Question, attributes: ['text', 'question_type', 'points'] }] 
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
            sessions
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
      title, 
      description, 
      access_code, 
      is_public, 
      show_answers,
      scoringMethod, 
      scoreThresholds, 
  } = req.body || {};
  
  if (!title || !access_code) return res.status(400).json({ error: "Brak wymaganych pól." });
  
  try {
    const t = await Test.create({ 
        user_id, 
        title, 
        description, 
        access_code, 
        is_public: is_public ?? true, 
        show_answers: show_answers ?? true,
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

// [POST] /api/tests/solve/:code — Przesyłanie rozwiązań (AUTO-OCENIANIE + PUNKTY)
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
        const resultsDetails = {}; 

        for (const question of test.Questions) {
            const userAnswer = answers[question.id]; 
            let isCorrect = false; 
            let pointsEarned = 0; // Ile punktów zdobył za to pytanie

            // --- SPRAWDZANIE ODPOWIEDZI ---
            let correctOptionId = null; 
            let correctOptionIds = [];  
            let correctText = null;

            if (question.question_type === 'ABC') {
                if (question.is_multiple_choice) {
                    // Wielokrotny
                    const correctOpts = question.QuestionOptions.filter(o => o.is_correct).map(o => o.id);
                    correctOptionIds = correctOpts;
                    const userSelectedIds = Array.isArray(userAnswer) ? userAnswer.map(Number) : (userAnswer ? [Number(userAnswer)] : []);

                    const userSet = new Set(userSelectedIds);
                    const correctSet = new Set(correctOpts);
                    
                    if (userSet.size === correctSet.size && [...userSet].every(x => correctSet.has(x))) {
                        isCorrect = true;
                    }
                } else {
                    // Jednokrotny
                    const correctOpt = question.QuestionOptions.find(o => o.is_correct);
                    if (correctOpt) correctOptionId = correctOpt.id;

                    const selectedOption = question.QuestionOptions.find(o => o.id == userAnswer);
                    if (selectedOption && selectedOption.is_correct) isCorrect = true;
                }
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
            
            // --- PUNKTACJA (AUTOMATYCZNA) ---
            if (isCorrect === true) {
                pointsEarned = question.points; // Max pkt za pytanie
                totalScore += pointsEarned;
                correctCount++;
            } else if (isCorrect === false) {
                pointsEarned = 0;
                incorrectCount++;
            } else {
                pointsEarned = 0; // Dla OPEN na razie 0, nauczyciel zmieni
                pendingCount++; 
            }
            maxPoints += question.points;

            const answerTextToSave = Array.isArray(userAnswer) ? JSON.stringify(userAnswer) : String(userAnswer || '');

            savedAnswers.push({
                session_id: session.id,
                question_id: question.id,
                answer_text: answerTextToSave,
                is_correct: isCorrect,
                points_earned: pointsEarned 
            });

            if (test.show_answers) {
                resultsDetails[question.id] = {
                    isCorrect: isCorrect,
                    pointsEarned: pointsEarned,
                    correctOptionId: correctOptionId,
                    correctOptionIds: correctOptionIds,
                    correctText: correctText,
                    userAnswer: userAnswer 
                };
            }
        }

        await Answer.bulkCreate(savedAnswers);
        session.score = totalScore;
        await session.save();

        const allSessions = await TestSession.findAll({ where: { test_id: test.id }, attributes: ['score'] });
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
            resultsDetails: test.show_answers ? resultsDetails : null
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd zapisu odpowiedzi." });
    }
});

// [POST] /api/tests/sessions/:sessionId/grade — Ręczne ocenianie (AKTUALIZACJA)
router.post("/sessions/:sessionId/grade", requireAuth, async (req, res) => {
    const { sessionId } = req.params;
    const { grades } = req.body; 
    // grades: { answerId: liczba_punktow, ... }

    try {
        const session = await TestSession.findByPk(sessionId, {
            include: [{ model: Answer, include: [Question] }]
        });
        if (!session) return res.status(404).json({ error: "Sesja nie istnieje" });

        // 1. Aktualizuj punkty w odpowiedziach
        for (const ans of session.Answers) {
            if (grades[ans.id] !== undefined) {
                const newPoints = parseFloat(grades[ans.id]);
                
                ans.points_earned = newPoints;
                
                // Automatycznie ustawiamy flagę is_correct
                if (newPoints === ans.Question.points) ans.is_correct = true;
                else if (newPoints === 0) ans.is_correct = false;
                else ans.is_correct = false; // "Partial" = technicznie niepoprawne, ale z punktami
                
                await ans.save();
            }
        }

        // 2. Przelicz wynik całej sesji
        let newScore = 0;
        for (const ans of session.Answers) {
            newScore += (ans.points_earned || 0);
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