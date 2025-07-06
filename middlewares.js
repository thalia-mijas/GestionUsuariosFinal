import { userSchema } from "./schemas.js";
import { verifyPassword } from "./utils.js";
import { hashPassword } from "./utils.js";
import jwt from "jsonwebtoken";
import "dotenv/config";
import User from "./models/user.js";
import { Op } from "sequelize";

const SECRET_KEY = process.env.JWT_SECRET;

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.status(200).json({ usuarios: users });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
  next();
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
  if (user && user.id.toString() !== id.toString()) {
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
  next();
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
  next();
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
  next();
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
  next();
};

export const generateToken = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      where: { name: username },
    });

    if (!user) return res.status(404).json({ error: "El usuario no existe" });

    if (await verifyPassword(password, user.password)) {
      const payload = { username };
      const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "1h" });

      await user.update({
        wrongLoginAttempts: 0,
      });
      res.status(201).json({ token });
    } else {
      await user.update({
        wrongLoginAttempts: user.wrongLoginAttempts + 1,
      });
      res.status(401).json({ message: "Credenciales incorrectas" });
    }
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
  next();
};

export const verifyToken = (req, res, next) => {
  try {
    const token = req.headers["authorization"];
    if (!token) return res.status(403).json({ message: "Token requerido" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
      if (err) return res.status(401).json({ message: "Token inválido" });
      req.user = decoded;
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
  next();
};
