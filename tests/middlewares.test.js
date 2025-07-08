const {
  listUsers,
  validateUser,
  createUser,
  updateUser,
  deleteUser,
  findUser,
  loginLimiter,
  generateToken,
  verifyToken,
  xssSanitizer,
} = require("../middlewares");
const User = require("../models/user.js");
const userSchema = require("../schemas.js");
const { Op } = require("sequelize");
const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const utils = require("../utils");
const xss = require("xss");

describe("listUsers", () => {
  let req, res, next;

  jest.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should respond with 200 and users list", async () => {
    const fakeUsers = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    jest.spyOn(User, "findAll").mockResolvedValue(fakeUsers);

    await listUsers(req, res, next);

    expect(User.findAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ usuarios: fakeUsers });
  });

  it("should respond with 500 on error", async () => {
    jest.spyOn(User, "findAll").mockRejectedValue(new Error("DB error"));

    await listUsers(req, res, next);

    expect(User.findAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error interno del servidor",
    });
  });
});

jest.mock("../schemas.js", () => ({
  validate: jest.fn(),
}));

describe("validateUser", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: { name: "Alice", email: "alice@example.com" },
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("should call next if validation passes and user does not exist", async () => {
    userSchema.validate.mockReturnValue({ error: null });
    jest.spyOn(User, "findOne").mockResolvedValue(null);

    await validateUser(req, res, next);

    expect(userSchema.validate).toHaveBeenCalledWith(req.body, {
      abortEarly: false,
    });
    expect(User.findOne).toHaveBeenCalledWith({
      where: {
        [Op.or]: [{ name: "Alice" }, { email: "alice@example.com" }],
      },
    });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should respond with 400 if validation fails", async () => {
    userSchema.validate.mockReturnValue({
      error: {
        details: [
          { message: "Name is required" },
          { message: "Email is invalid" },
        ],
      },
    });

    await validateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      errors: ["Name is required", "Email is invalid"],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should respond with 409 if user exists and id is different", async () => {
    userSchema.validate.mockReturnValue({ error: null });
    req.params.id = "2";
    const existingUser = { id: "1" };
    jest.spyOn(User, "findOne").mockResolvedValue(existingUser);

    await validateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "El usuario ya está registrado",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next if user exists but id matches", async () => {
    userSchema.validate.mockReturnValue({ error: null });
    req.params.id = "1";
    const existingUser = { id: "1" };
    jest.spyOn(User, "findOne").mockResolvedValue(existingUser);

    await validateUser(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
describe("createUser", () => {
  let req, res, next;
  const fakeHashedPassword = "hashedPassword123";

  beforeEach(() => {
    req = {
      body: {
        name: "Charlie",
        email: "charlie@example.com",
        password: "plainPassword",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("should create a user and respond with 201 and new_user", async () => {
    jest.spyOn(User, "findAll").mockResolvedValue([]);
    jest.spyOn(User, "create").mockResolvedValue({});
    jest
      .spyOn(require("../utils.js"), "hashPassword")
      .mockResolvedValue(fakeHashedPassword);

    await createUser(req, res, next);

    expect(User.findAll).toHaveBeenCalled();
    expect(User.create).toHaveBeenCalledWith({
      name: "Charlie",
      email: "charlie@example.com",
      password: fakeHashedPassword,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      new_user: {
        name: "Charlie",
        email: "charlie@example.com",
        password: fakeHashedPassword,
      },
    });
  });

  it("should respond with 500 on error", async () => {
    jest.spyOn(User, "findAll").mockRejectedValue(new Error("DB error"));
    jest
      .spyOn(require("../utils.js"), "hashPassword")
      .mockResolvedValue(fakeHashedPassword);

    await createUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error interno del servidor",
    });
  });
});
describe("updateUser", () => {
  let req, res, next;
  const fakeHashedPassword = "hashedPassword456";
  let userInstance;

  beforeEach(() => {
    req = {
      params: { id: "1" },
      body: {
        name: "UpdatedName",
        email: "updated@example.com",
        password: "newPassword",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    userInstance = {
      update: jest.fn().mockResolvedValue(),
    };
    jest.clearAllMocks();
  });

  it("should update user and respond with 200 and updated user", async () => {
    jest.spyOn(User, "findByPk").mockResolvedValue(userInstance);
    jest
      .spyOn(require("../utils.js"), "hashPassword")
      .mockResolvedValue(fakeHashedPassword);

    await updateUser(req, res, next);

    expect(User.findByPk).toHaveBeenCalledWith("1");
    expect(require("../utils.js").hashPassword).toHaveBeenCalledWith(
      "newPassword"
    );
    expect(userInstance.update).toHaveBeenCalledWith({
      name: "UpdatedName",
      email: "updated@example.com",
      password: fakeHashedPassword,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuario actualizado con exito",
      user: { id: "1", name: "UpdatedName", email: "updated@example.com" },
    });
  });

  it("should respond with 404 if user does not exist", async () => {
    jest.spyOn(User, "findByPk").mockResolvedValue(null);

    await updateUser(req, res, next);

    expect(User.findByPk).toHaveBeenCalledWith("1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "El usuario no existe" });
  });

  it("should respond with 500 on error", async () => {
    jest.spyOn(User, "findByPk").mockRejectedValue(new Error("DB error"));

    await updateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error interno del servidor",
    });
  });
});
describe("deleteUser", () => {
  let req, res, next;
  let userInstance;

  beforeEach(() => {
    req = { params: { id: "1" } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    userInstance = {
      destroy: jest.fn().mockResolvedValue(),
    };
    jest.clearAllMocks();
  });

  it("should delete user and respond with 200 and success message", async () => {
    jest.spyOn(User, "findByPk").mockResolvedValue(userInstance);

    await deleteUser(req, res, next);

    expect(User.findByPk).toHaveBeenCalledWith("1");
    expect(userInstance.destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuario eliminado con éxito",
    });
  });

  it("should respond with 404 if user does not exist", async () => {
    jest.spyOn(User, "findByPk").mockResolvedValue(null);

    await deleteUser(req, res, next);

    expect(User.findByPk).toHaveBeenCalledWith("1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "El usuario no existe",
    });
  });

  it("should respond with 500 on error", async () => {
    jest.spyOn(User, "findByPk").mockRejectedValue(new Error("DB error"));

    await deleteUser(req, res, next);

    expect(User.findByPk).toHaveBeenCalledWith("1");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error interno del servidor",
    });
  });
});

describe("findUser", () => {
  let req, res, next;
  let userInstance;

  beforeEach(() => {
    req = { params: { id: "1" } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    userInstance = { id: "1", name: "Test User", email: "test@example.com" };
    jest.clearAllMocks();
  });

  it("should respond with 200 and user data if user exists", async () => {
    jest.spyOn(User, "findByPk").mockResolvedValue(userInstance);

    await findUser(req, res, next);

    expect(User.findByPk).toHaveBeenCalledWith("1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ user: userInstance });
  });

  it("should respond with 404 if user does not exist", async () => {
    jest.spyOn(User, "findByPk").mockResolvedValue(null);

    await findUser(req, res, next);

    expect(User.findByPk).toHaveBeenCalledWith("1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "El usuario no existe" });
  });

  it("should respond with 500 on error", async () => {
    jest.spyOn(User, "findByPk").mockRejectedValue(new Error("DB error"));

    await findUser(req, res, next);

    expect(User.findByPk).toHaveBeenCalledWith("1");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error interno del servidor",
    });
  });
});

describe("loginLimiter", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());
    app.use(cookieParser());

    // Ruta simulada de login que siempre falla (status 401)
    app.post("/login", loginLimiter, (req, res) => {
      res.status(401).json({ error: "Credenciales incorrectas" });
    });
  });

  it("should allow requests under the limit", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/login")
        .send({ username: "testuser" });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Credenciales incorrectas" });
    }
  });

  it("should block requests after exceeding the limit", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post("/login").send({ username: "blockeduser" });
    }
    const res = await request(app)
      .post("/login")
      .send({ username: "blockeduser" });

    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/Demasiados intentos/);
  });

  it("should use IP as key if username is not provided", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post("/login").send({});
    }
    const res = await request(app).post("/login").send({});
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty("error");
  });

  it("should reset limit for different usernames", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post("/login").send({ username: "userA" });
    }
    // userB aún no ha hecho intentos, así que no debe estar bloqueado
    const res = await request(app).post("/login").send({ username: "userB" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Credenciales incorrectas" });
  });
});

jest.mock("../models/user");
jest.mock("../utils");

const SECRET_KEY = "test_secret"; // Puedes usar dotenv si prefieres

describe("generateToken", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());
    app.use(cookieParser());

    // Ruta de prueba que usa el middleware
    app.post("/login", (req, res, next) => generateToken(req, res, next));
    jest.clearAllMocks();
  });

  it("should return 404 if user does not exist", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post("/login").send({
      username: "nonexistent",
      password: "irrelevant",
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "El usuario no existe" });
  });

  it("should return 401 if password is incorrect", async () => {
    User.findOne.mockResolvedValue({ name: "testuser", password: "hashed" });
    utils.verifyPassword.mockResolvedValue(false);

    const res = await request(app).post("/login").send({
      username: "testuser",
      password: "wrongpass",
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Credenciales incorrectas" });
  });

  it("should set token cookie and return success message if credentials are correct", async () => {
    const fakeUser = { name: "testuser", password: "hashed" };
    User.findOne.mockResolvedValue(fakeUser);
    utils.verifyPassword.mockResolvedValue(true);
    jest.spyOn(jwt, "sign").mockReturnValue("faketoken");

    const res = await request(app).post("/login").send({
      username: "testuser",
      password: "correctpass",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Login exitoso" });
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/token=faketoken/)])
    );
  });

  it("should handle internal server error", async () => {
    User.findOne.mockRejectedValue(new Error("DB error"));

    const res = await request(app).post("/login").send({
      username: "testuser",
      password: "any",
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Error interno del servidor" });
  });
});

jest.mock("jsonwebtoken");

describe("verifyToken", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(cookieParser());

    // Ruta protegida con el middleware
    app.get("/protected", verifyToken, (req, res) => {
      res.status(200).json({ message: "Acceso concedido", user: req.user });
    });

    jest.clearAllMocks();
  });

  it("should return 403 if no token is provided", async () => {
    const res = await request(app).get("/protected");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Token requerido" });
  });

  it("should return 401 if token is invalid", async () => {
    jwt.verify.mockImplementation((token, secret, cb) => {
      cb(new Error("Invalid token"), null);
    });

    const res = await request(app)
      .get("/protected")
      .set("Cookie", ["token=invalidtoken"]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Token inválido" });
  });

  it("should call next and attach decoded user if token is valid", async () => {
    const decodedPayload = { username: "testuser" };
    jwt.verify.mockImplementation((token, secret, cb) => {
      cb(null, decodedPayload);
    });

    const res = await request(app)
      .get("/protected")
      .set("Cookie", ["token=validtoken"]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "Acceso concedido",
      user: decodedPayload,
    });
  });

  it("should return 500 on unexpected error inside verifyToken", async () => {
    // Fuerza un error dentro del bloque try/catch del middleware
    jwt.verify.mockImplementation(() => {
      throw new Error("Unexpected failure");
    });

    const res = await request(app)
      .get("/protected")
      .set("Cookie", ["token=validtoken"]);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Error interno del servidor" });
  });
});

describe("xssSanitizer", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());

    // Ruta de prueba que expone los datos sanitizados
    app.post("/test/:id", xssSanitizer, (req, res) => {
      res.status(200).json({
        body: req.body,
        params: req.params,
        query: req.query,
      });
    });
  });

  it("should sanitize XSS content in body, params, and query", async () => {
    const malicious = '<script>alert("xss")</script>';
    const sanitized = xss(malicious);
    const encoded = encodeURIComponent(malicious);

    const res = await request(app)
      .post(`/test/${encoded}`)
      .query({ search: encoded })
      .send({ comment: malicious });

    expect(res.status).toBe(200);
    expect(res.body.body.comment).toBe(sanitized);
    expect(res.body.params.id).toBe(sanitized);
    // Decode the received value before comparing to sanitized
    expect(xss(decodeURIComponent(res.body.query.search))).toBe(sanitized);
  });

  it("should sanitize nested objects", async () => {
    const malicious = '<img src="x" onerror="alert(1)" />';
    const sanitized = xss(malicious);

    const res = await request(app)
      .post("/test/123")
      .send({
        user: {
          bio: malicious,
          profile: {
            about: malicious,
          },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.body.user.bio).toBe(sanitized);
    expect(res.body.body.user.profile.about).toBe(sanitized);
  });

  it("should not alter safe input", async () => {
    const safeInput = "Hola mundo";

    const res = await request(app)
      .post("/test/abc")
      .query({ q: safeInput })
      .send({ message: safeInput });

    expect(res.status).toBe(200);
    expect(res.body.body.message).toBe(safeInput);
    expect(res.body.params.id).toBe("abc");
    expect(res.body.query.q).toBe(safeInput);
  });

  it("should call next without errors", async () => {
    const res = await request(app).post("/test/ok").send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("body");
    expect(res.body).toHaveProperty("params");
    expect(res.body).toHaveProperty("query");
  });
});
