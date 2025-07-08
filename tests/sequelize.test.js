const sequelize = require("../models/index"); // ajusta la ruta según tu estructura

describe("Sequelize connection", () => {
  it("should connect successfully to the database", async () => {
    try {
      await sequelize.authenticate(); // test de conexión
    } catch (err) {
      // si falla, el test falla
      throw new Error("No se pudo conectar a la base de datos: " + err.message);
    }
  });
});
