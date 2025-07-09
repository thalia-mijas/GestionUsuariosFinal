const express = require("express");
const cookieParser = require("cookie-parser");
const { verifyToken, generateToken } = require("./middlewares.js");
const {
  listUsers,
  createUser,
  deleteUser,
  findUser,
  updateUser,
  validateUser,
} = require("./middlewares.js");
const { loginLimiter, xssSanitizer } = require("./middlewares.js");
const csrf = require("csurf");
const xss = require("xss");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const csrfProtection = csrf({ cookie: true });

app.use(express.json());
app.use(xssSanitizer); // Temporarily disabled for debugging
app.use(cookieParser()); // Necesario para leer cookies de autenticación

app.get("/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.get("/", listUsers, (req, res) => {});

app.post("/", csrfProtection, validateUser, createUser, (req, res) => {});

app.put(
  "/:id",
  verifyToken,
  csrfProtection,
  validateUser,
  updateUser,
  (req, res) => {}
);

app.delete("/:id", verifyToken, csrfProtection, deleteUser, (req, res) => {});

app.get("/:id", findUser, (req, res) => {});

app.post("/login", loginLimiter, csrfProtection, generateToken, (req, res) => {
  res.status(200).json({ message: "Login exitoso" });
});

app.post("/logout", csrfProtection, (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
  });
  res.status(200).json({ message: "Sesión cerrada" });
});

// Middleware para manejar errores de CSRF
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    // Error lanzado por csurf cuando el token es inválido o falta
    return res.status(403).json({
      error:
        "Token CSRF inválido o ausente. Por favor, recarga la página o vuelve a iniciar sesión.",
    });
  }
  // Otros errores
  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

module.exports = app;
