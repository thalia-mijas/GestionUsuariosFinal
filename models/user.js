import { DataTypes } from "sequelize";
import sequelize from "./index.js"; // Importa la instancia de Sequelize

const User = sequelize.define("usuariosFinal", {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  password: DataTypes.STRING,
});

export default User;
