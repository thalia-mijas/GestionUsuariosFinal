const { DataTypes } = require("sequelize");
const sequelize = require("./index"); // Importa la instancia de Sequelize

const User = sequelize.define("usuariosFinal", {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  password: DataTypes.STRING,
  wrongLoginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = User;
