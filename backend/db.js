import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const DB_FILE =  'cringely_test2.sqlite';

const sequelize = new Sequelize({
  dialect: 'sqlite', // ⬅️ Zmień dialekt na SQLite
  storage: DB_FILE,  // ⬅️ Ścieżka do pliku bazy danych
  logging: false,    // Opcjonalnie: wyłącz logowanie zapytań SQL
});

export default sequelize;
