import express from "express";
import session from "express-session";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import sequelize from "./db.js";
import usersRoutes from "./routes/users.js";
import authRoutes from "./routes/auth.js";
import testsRoutes from "./routes/tests.js";
import questionsRoutes from "./routes/questions.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morgan("dev"));

app.use(session({
  secret: process.env.SESSION_SECRET || "sekret123",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, sameSite: 'lax' }
}));

app.use("/api/users", usersRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tests", testsRoutes);
app.use("/api/questions", questionsRoutes);

app.get("/", (_req, res) => res.send("Backend działa z PostgreSQL ale jednoczesnie dziala na SQLite ✅"));

try {
  await sequelize.authenticate();
  console.log("💾 Połączono z bazą SQLite"); 

  await sequelize.sync({alter: true}); 
  console.log("✅ Wczytano modele i zsynchronizowano z bazą danych (utworzono tabele).");

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Backend działa na porcie ${PORT} \n http://localhost:3001/`));
} catch (err) {
  console.error("❌ Błąd bazy danych:", err);
}