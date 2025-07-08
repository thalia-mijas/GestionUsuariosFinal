const { DataTypes } = require("sequelize");
const sequelize = require("./index.js"); // Importa la instancia de Sequelize

const User = sequelize.define("usuariosFinal", {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  password: DataTypes.STRING,
});

module.exports = User;
