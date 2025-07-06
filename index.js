import express from "express";
import {
  listUsers,
  createUser,
  deleteUser,
  findUser,
  updateUser,
  validateUser,
  generateToken,
  verifyToken,
} from "./middlewares.js";
import "dotenv/config";
import sequelize from "./models/index.js";

const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());

app.get("/", listUsers, (req, res) => {});

app.post("/", [validateUser, createUser], (req, res) => {});

app.put("/:id", [verifyToken, validateUser, updateUser], (req, res) => {});

app.delete("/:id", [verifyToken, deleteUser], (req, res) => {});

app.get("/:id", findUser, (req, res) => {});

app.post("/login", generateToken, (req, res) => {});

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
