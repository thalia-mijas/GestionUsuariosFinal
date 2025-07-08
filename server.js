const app = require("./app");
const sequelize = require("./models/index");

const PORT = process.env.PORT || 3000;

sequelize
  .sync()
  .then(() => {
    console.log("Base de datos sincronizada");
    app.listen(PORT, () => {
      console.log(`El servidor esta escuchando el puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("No se pudo sincronizar la base de datos:", error);
  });
