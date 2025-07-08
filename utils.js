const bcrypt = require("bcrypt"); // Importa bcrypt

async function hashPassword(password) {
  const saltRounds = 10; // Nivel de seguridad
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}

async function verifyPassword(inputPassword, storedHash) {
  const match = await bcrypt.compare(inputPassword, storedHash);
  return match; // Devuelve true si coinciden, false si no
}

module.exports = { hashPassword, verifyPassword };
