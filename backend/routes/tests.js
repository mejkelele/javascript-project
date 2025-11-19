import express from "express";
import { Test } from "../models/index.js";

const router = express.Router();

// LOKALNIE ZDEFINIOWANY MIDDLEWARE AUTORYZACJI
const requireAuth = (req, res, next) => {
  // Sprawdza, czy istnieje ID użytkownika w sesji
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Wymagane logowanie.' });
  }
  next();
};

// [GET] /api/tests — lista testów zalogowanego użytkownika
router.get("/", requireAuth, async (req, res) => {
  // ID użytkownika pobrane z sesji
  const user_id = req.session.userId; 

  const tests = await Test.findAll({ 
    where: { user_id: user_id }, 
    order: [["id", "ASC"]] 
  });
  res.json(tests);
});


// [POST] /api/tests — dodaj nowy test
router.post("/", requireAuth, async (req, res) => {
  // ID użytkownika pobrane z sesji
  const user_id = req.session.userId; 
  
  const { title, description, access_code, is_public } = req.body || {};
  
  if (!title || !access_code) {
    return res.status(400).json({ error: "Brak wymaganych pól: tytuł i kod dostępu." });
  }
  
  try {
    const t = await Test.create({
      user_id, // Użyj ID z sesji
      title,
      description,
      access_code,
      is_public: is_public ?? true,
    });
    res.status(201).json(t);
  } catch (e) {
    if (e?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Kod dostępu ('access_code') już istnieje, podaj inny." });
    }
    console.error(e);
    res.status(500).json({ error: "Błąd dodawania testu" });
  }
});

export default router;