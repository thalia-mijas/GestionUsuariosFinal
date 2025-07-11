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

  it("should synchronize the database", async () => {
    try {
      await sequelize.sync({ force: true }); // fuerza la sincronización
    } catch (err) {
      // si falla, el test falla
      throw new Error("Error al sincronizar la base de datos: " + err.message);
    }
  });
});

describe("Sequelize configuration", () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it("should create a Sequelize instance", () => {
    expect(sequelize).toBeDefined();
    expect(typeof sequelize.authenticate).toBe("function");
  });

  it("should connect successfully to the database", async () => {
    await expect(sequelize.authenticate()).resolves.not.toThrow();
  });

  it("should synchronize the database", async () => {
    await expect(sequelize.sync({ force: true })).resolves.not.toThrow();
  });
});
