import express from "express";
import session from "express-session";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import sequelize from "./db.js";
import "./models/index.js";
import usersRoutes from "./routes/users.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use(session({
  secret: process.env.SESSION_SECRET || "sekret123",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, sameSite: 'lax' }
}));

app.use("/api/users", usersRoutes);
app.use("/api/auth", authRoutes);

app.get("/", (_req, res) => res.send("Backend działa z PostgreSQL ✅"));

try {
  await sequelize.authenticate();
  console.log("💾 Połączono z bazą PostgreSQL");
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Backend działa na porcie ${PORT}`));
} catch (err) {
  console.error("❌ Błąd bazy danych:", err);
}
