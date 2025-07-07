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
  loginLimiter,
  xssSanitizer,
} from "./middlewares.js";
import "dotenv/config";
import sequelize from "./models/index.js";
import cookieParser from "cookie-parser";

const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());
app.use(cookieParser()); // Necesario para leer cookies de autenticación
app.use(xssSanitizer); // Limpia automáticamente req.body, req.query y req.params

app.get("/", listUsers, (req, res) => {});

app.post("/", verifyToken, validateUser, createUser, (req, res) => {});

app.put("/:id", verifyToken, validateUser, updateUser, (req, res) => {});

app.delete("/:id", verifyToken, deleteUser, (req, res) => {});

app.get("/:id", findUser, (req, res) => {});

app.post("/login", loginLimiter, generateToken, (req, res) => {});

app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
  });
  res.status(200).json({ message: "Sesión cerrada" });
});

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
