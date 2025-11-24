import express from 'express';
import { Question, QuestionOption, Test } from '../models/index.js';

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Wymagane logowanie.' });
  next();
};

const checkOwnership = async (testId, userId) => {
    const test = await Test.findOne({ where: { id: testId, user_id: userId } });
    return !!test;
};

// [POST] Dodaj pytanie
router.post('/', requireAuth, async (req, res) => {
  const { test_id, text, question_type, options, points } = req.body; // <--- Dodano points

  try {
    const question = await Question.create({ 
        test_id, 
        text, 
        question_type: question_type || 'ABC',
        points: points || 1 
    });

    if (options?.length) {
      const opts = options.map(o => ({ ...o, question_id: question.id }));
      await QuestionOption.bulkCreate(opts);
    }
    res.status(201).json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd dodawania pytania' });
  }
});

// [PUT] Edytuj pytanie
router.put('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { text, options, points } = req.body; 

    try {
        const question = await Question.findByPk(id);
        if (!question) return res.status(404).json({ error: "Pytanie nie istnieje" });

        question.text = text;
        if (points) question.points = points;
        await question.save();

        if (options) {
             await QuestionOption.destroy({ where: { question_id: id } });
             const opts = options.map(o => ({ 
                 question_id: id, 
                 text: o.text, 
                 is_correct: o.is_correct 
             }));
             await QuestionOption.bulkCreate(opts);
        }

        res.json(question);
    } catch (err) { /* ... */ }
});

// [DELETE] /api/questions/:id — usuń pytanie
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const question = await Question.findByPk(id);
        if (!question) return res.status(404).json({ error: "Pytanie nie istnieje" });

        if (!await checkOwnership(question.test_id, req.session.userId)) {
            return res.status(403).json({ error: "Brak dostępu." });
        }

        await question.destroy();
        res.json({ message: "Usunięto" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Błąd usuwania pytania' });
    }
});

export default router;