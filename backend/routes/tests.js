import express from "express";
import { Test, Question, QuestionOption, User, TestSession, Answer } from "../models/index.js";

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Wymagane logowanie.' });
  }
  next();
};


// [GET] /api/tests/public/:code — PUBLICZNY endpoint dla ucznia
router.get("/public/:code", async (req, res) => {
    const { code } = req.params;
    try {
        const test = await Test.findOne({
            where: { access_code: code },
            attributes: ['id', 'title', 'description', 'is_public'], 
            include: [
                {
                    model: Question,
                    attributes: ['id', 'text', 'question_type', 'points'],
                    include: [
                        {
                            model: QuestionOption,
                            attributes: ['id', 'text'] 
                        }
                    ]
                },
                {
                    model: User,
                    attributes: ['name']
                }
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

// [GET] /api/tests — lista testów (bez zmian)
router.get("/", requireAuth, async (req, res) => {
  const user_id = req.session.userId;
  const tests = await Test.findAll({ 
    where: { user_id }, 
    order: [["id", "DESC"]] 
  });
  res.json(tests);
});

// [GET] /api/tests/:id — pobierz test wraz z pytaniami i opcjami
router.get("/:id", requireAuth, async (req, res) => {
    const user_id = req.session.userId;
    const { id } = req.params;

    try {
        const test = await Test.findOne({
            where: { id, user_id }, 
            include: [
                {
                    model: Question,
                    include: [QuestionOption] 
                }
            ]
        });

        if (!test) return res.status(404).json({ error: "Test nie znaleziony." });

        res.json(test);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd pobierania testu." });
    }
});

// [POST] /api/tests — dodaj nowy test 
router.post("/", requireAuth, async (req, res) => {
  const user_id = req.session.userId;
  const { title, description, access_code, is_public } = req.body || {};
  
  if (!title || !access_code) {
    return res.status(400).json({ error: "Brak wymaganych pól." });
  }
  
  try {
    const t = await Test.create({
      user_id,
      title,
      description,
      access_code,
      is_public: is_public ?? true,
    });
    res.status(201).json(t);
  } catch (e) {
    if (e?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Kod dostępu już istnieje." });
    }
    console.error(e);
    res.status(500).json({ error: "Błąd dodawania testu" });
  }
});

// [PUT] /api/tests/:id — edytuj dane główne testu
router.put("/:id", requireAuth, async (req, res) => {
    const user_id = req.session.userId;
    const { id } = req.params;
    const { title, description, is_public } = req.body;

    try {
        const test = await Test.findOne({ where: { id, user_id } });
        if (!test) return res.status(404).json({ error: "Nie znaleziono testu." });

        test.title = title;
        test.description = description;
        test.is_public = is_public;

        await test.save();
        res.json(test);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd edycji testu." });
    }
});


// [POST] /api/tests/solve/:code — Prześlij rozwiązanie testu
router.post("/solve/:code", async (req, res) => {
    const { code } = req.params;
    const { guest_name, answers } = req.body; 

    if (!guest_name) return res.status(400).json({ error: "Podaj imię!" });

    try {
        const test = await Test.findOne({
            where: { access_code: code },
            include: [
                {
                    model: Question,
                    include: [QuestionOption]
                }
            ]
        });

        if (!test) return res.status(404).json({ error: "Test nie istnieje." });

        // 2. Utwórz sesję testu
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
        const savedAnswers = [];

        // 3. Sprawdź każdą odpowiedź
        for (const question of test.Questions) {
            const userAnswer = answers[question.id]; 
            let isCorrect = false;
            let pointsEarned = 0;

            // sprawdzanie zależne od typu testu
            if (question.question_type === 'ABC') {
                const selectedOption = question.QuestionOptions.find(o => o.id == userAnswer);
                if (selectedOption && selectedOption.is_correct) {
                    isCorrect = true;
                }
            } 
            else if (question.question_type === 'FILL') {
                const correctText = question.QuestionOptions[0]?.text || "";
                if (userAnswer && String(userAnswer).trim().toLowerCase() === correctText.trim().toLowerCase()) {
                    isCorrect = true;
                }
            }
            // pytania otwarte trzeba dopracowac  
            if (isCorrect) {
                pointsEarned = question.points;
                totalScore += pointsEarned;
            }
            maxPoints += question.points;

            savedAnswers.push({
                session_id: session.id,
                question_id: question.id,
                answer_text: String(userAnswer || ''),
                is_correct: isCorrect
            });
        }

        // 4. Zapisz odpowiedzi i zaktualizuj wynik sesji
        await Answer.bulkCreate(savedAnswers);
        
        session.score = totalScore;
        await session.save();

        // 5. Zwróć wynik do frontendu
        res.json({
            message: "Test zakończony!",
            score: totalScore,
            maxPoints: maxPoints,
            isPublic: test.is_public // Frontend może zdecydować czy pokazać poprawne odpowiedzi
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd zapisu odpowiedzi." });
    }
});

export default router;