// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { User, TestSession, Test } from '../models/index.js';

const router = express.Router();

router.post(
  '/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Użytkownik istnieje' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password_hash: hash, name });
    req.session.userId = user.id;
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  }
);

router.post('/login',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Błędne dane logowania' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Błędne dane logowania' });

    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email, name: user.name });
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Wylogowano' }));
});

// [GET] /api/auth/me - Pobierz dane zalogowanego użytkownika
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json(null);
  const user = await User.findByPk(req.session.userId, { 
      attributes: ['id', 'email', 'name', 'description', 'birth_date', 'interests', 'avatar'] 
  });
  res.json(user || null);
});

// [PUT] /api/auth/me - Aktualizuj profil
router.put('/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Brak sesji' });
    
    const { name, description, birth_date, interests, avatar } = req.body;
    
    try {
        await User.update(
            { name, description, birth_date, interests, avatar },
            { where: { id: req.session.userId } }
        );
        const updatedUser = await User.findByPk(req.session.userId, { 
            attributes: ['id', 'email', 'name', 'description', 'birth_date', 'interests', 'avatar'] 
        });
        res.json(updatedUser);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd aktualizacji profilu" });
    }
});

// [GET] /api/auth/history - Historia rozwiązanych testów
router.get('/history', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Brak sesji' });

    try {
        const sessions = await TestSession.findAll({
            where: { user_id: req.session.userId },
            include: [
                { model: Test, attributes: ['title', 'access_code'] }
            ],
            order: [['started_at', 'DESC']]
        });
        res.json(sessions);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Błąd pobierania historii" });
    }
});

export default router;
