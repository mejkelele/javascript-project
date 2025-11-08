import express from "express";
import { Test } from "../models/index.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const tests = await Test.findAll({ order: [["id", "ASC"]] });
  res.json(tests);
});

router.post("/", async (req, res) => {
  const { user_id, title, description, access_code, is_public } =
    req.body || {};
  if (!user_id || !title || !access_code) {
    return res.status(400).json({ error: "Brak wymaganych pól" });
  }
  try {
    const t = await Test.create({
      user_id,
      title,
      description,
      access_code,
      is_public,
    });
    res.status(201).json(t);
  } catch (e) {
    if (e?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "access_code już istnieje" });
    }
    console.error(e);
    res.status(500).json({ error: "Błąd dodawania testu" });
  }
});

export default router;
