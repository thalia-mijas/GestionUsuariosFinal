const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

let sequelize;

if (process.env.NODE_ENV === "test") {
  console.log("Conectando a la base de datos en modo test");
  sequelize = new Sequelize("sqlite::memory:"); // base temporal para tests
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME, // Nombre de la base de datos
    process.env.DB_USER, // Usuario de la base de datos
    process.env.DB_PASSWORD, // Contraseña de la base de datos
    {
      host: process.env.DB_HOST, // Dirección del servidor de la base de datos
      dialect: "mysql", // Tipo de base de datos
    }
  );
}

module.exports = sequelize;
