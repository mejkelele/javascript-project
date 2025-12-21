import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const DB_FILE =  'cringely_test7.sqlite';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: DB_FILE,
  logging: false,
});

export default sequelize;
