import express from 'express';
import User from '../models/User.js';

const router = express.Router();


router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// [GET] /api/users  — lista użytkowników
router.get('/', async (req, res) => {
  try {
    const users = await User.findAll({ order: [['id', 'ASC']] });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd pobierania użytkowników' });
  }
});

// [GET] /api/users/:id — pojedynczy użytkownik
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd pobierania użytkownika' });
  }
});

// [POST] /api/users — dodaj użytkownika
router.post('/', async (req, res) => {
  try {
    const { email, password_hash, name } = req.body || {};
    if (!email || !password_hash) {
      return res.status(400).json({ error: 'Brak wymaganych pól' });
    }

    const user = await User.create({ email, password_hash, name });
    res.status(201).json(user);
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Użytkownik z takim e-mailem już istnieje' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd dodawania użytkownika' });
  }
});


// [DELETE] /api/users/:id — usuń użytkownika
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await User.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    res.status(204).send(); // No Content
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd usuwania użytkownika' });
  }
});

export default router;
