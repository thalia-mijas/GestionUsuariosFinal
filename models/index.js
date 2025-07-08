const { Sequelize } = require("sequelize");

let sequelize;

if (process.env.NODE_ENV === "test") {
  console.log("Conectando a la base de datos en modo test");
  sequelize = new Sequelize("sqlite::memory:"); // base temporal para tests
} else {
  sequelize = new Sequelize("usuariosFinal", "uem", "1234", {
    host: "localhost",
    dialect: "mysql",
  });
}

module.exports = sequelize;
