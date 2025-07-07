import { userSchema } from "./schemas.js";
import { verifyPassword } from "./utils.js";
import { hashPassword } from "./utils.js";
import jwt from "jsonwebtoken";
import "dotenv/config";
import User from "./models/user.js";
import { Op } from "sequelize";
import rateLimit from "express-rate-limit";
import xss from "xss";

const SECRET_KEY = process.env.JWT_SECRET;
const WINDOW_MINUTES = parseInt(process.env.WINDOW_MINUTES) || 15;
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.status(200).json({ usuarios: users });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const validateUser = async (req, res, next) => {
  const { error } = userSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res.status(400).json({ errors: messages });
  }
  const { name, email } = req.body;
  const { id } = req.params; // Puede ser undefined si es creación

  const user = await User.findOne({
    where: {
      [Op.or]: [{ name: name }, { email: email }],
    },
  });

  // Si existe usuario y (el id o es diferente al del usuario encontrado)
  if (user && user.id !== id) {
    return res.status(409).json({ message: "El usuario ya está registrado" });
  }
  next();
};

export const createUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const new_user = {
      name: name,
      email: email,
      password: await hashPassword(password),
    };
    const users = await User.findAll();
    users.push(new_user);
    await User.create(new_user);
    return res.status(201).json({ new_user: new_user });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: "El usuario no existe" });
    const updated_user = {
      name: name,
      email: email,
      password: await hashPassword(password),
    };

    await user.update(updated_user);

    return res.status(200).json({
      message: "Usuario actualizado con exito",
      user: { id, name, email },
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: "El usuario no existe" });

    await user.destroy();

    return res.status(200).json({ message: `Usuario eliminado con éxito` });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const findUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: "El usuario no existe" });
    return res.status(200).json({ user: user });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const loginLimiter = rateLimit({
  windowMs: WINDOW_MINUTES * 60 * 1000,
  max: MAX_LOGIN_ATTEMPTS,
  keyGenerator: (req) => req.body.username || req.ip, // cuenta los intentos por username si está disponible, sino por ip
  message: {
    error: `Demasiados intentos de inicio de sesión, por favor intente luego de ${WINDOW_MINUTES} minutos.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, //Solo limita intentos fallidos
});

export const generateToken = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      where: { name: username },
    });

    if (!user) return res.status(404).json({ error: "El usuario no existe" });

    if (await verifyPassword(password, user.password)) {
      const payload = { username };
      const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "5m" });

      //Almacenar el token en una cookie httpOnly
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
      });

      res.json({ message: "Login exitoso" });
    } else {
      res.status(401).json({ message: "Credenciales incorrectas" });
    }
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const verifyToken = (req, res, next) => {
  try {
    // Leer el token desde la cookie httpOnly
    const token = req.cookies?.token;
    if (!token) return res.status(403).json({ message: "Token requerido" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
      if (err) return res.status(401).json({ message: "Token inválido" });
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const xssSanitizer = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj) return;
    for (const key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = xss(obj[key]);
      } else if (typeof obj[key] === "object") {
        sanitize(obj[key]);
      }
    }
  };

  sanitize(req.body);
  sanitize(req.params);
  sanitize(req.query);

  next();
};
