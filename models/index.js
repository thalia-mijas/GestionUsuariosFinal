const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  "usuariosFinal", // Nombre de la base de datos
  "uem", // Usuario de la base de datos
  "1234", // Contraseña del usuario
  {
    host: "localhost", // Host donde se encuentra la base de datos
    dialect: "mysql", // Tipo de base de datos
  }
);

module.exports = sequelize;
