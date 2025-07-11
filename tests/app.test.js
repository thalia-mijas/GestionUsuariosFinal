const request = require("supertest");
const app = require("../app");
const jwt = require("jsonwebtoken");
const sequelize = require("../models/index");
const User = require("../models/user");
let csrfToken;
let csrfCookie;
let jwtToken;

// Antes de correr los tests, sincroniza la base de datos temporal en memoria
beforeAll(async () => {
  await sequelize.sync({ force: true });
  const res = await request(app).get("/csrf-token");
  csrfToken = res.body.csrfToken;
  // Guarda la cookie _csrf devuelta por el servidor
  if (res.headers["set-cookie"]) {
    const csrfCookieHdr = res.headers["set-cookie"].find((cookie) =>
      cookie.startsWith("_csrf=")
    );
    if (csrfCookieHdr) {
      // Guarda la cookie para usarla en los tests si es necesario
      csrfCookie = csrfCookieHdr.split(";")[0]; // "_csrf=valor"
    }
  }
});

describe("GET /", () => {
  it("should return 200 and a list of users", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ usuarios: [] });
  });
});

describe("GET /csrf-token", () => {
  it("should return a CSRF token", async () => {
    const res = await request(app).get("/csrf-token");
    expect(res.statusCode).toBe(200);

    expect(res.body).toHaveProperty("csrfToken");
  });
});

describe("POST /", () => {
  it("should return 400 if required fields are missing", async () => {
    const res = await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send({ name: "Test User", password: "anyPassword" }); // Falta el campo email
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ errors: ['"email" is required'] });
  });

  it("should create a new user and return 201", async () => {
    const newUser = {
      name: "Test User",
      email: "test@example.com",
      password: "testpassword",
    };
    const res = await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send(newUser);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("new_user");
    expect(res.body.new_user).toEqual({
      name: newUser.name,
      email: newUser.email,
      password: expect.any(String), // La contraseña debería estar hasheada
    });
  });

  it("should return 409 if user already exists", async () => {
    const existingUser = {
      name: "Existing User",
      email: "test@example.com",
      password: "testpassword",
    };
    const res = await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send(existingUser);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: "El usuario ya está registrado" });
  });

  it("should return 400 if email is invalid", async () => {
    const invalidUser = {
      name: "Invalid User",
      email: "invalid-email",
      password: "testpassword",
    };
    const res = await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send(invalidUser);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ errors: ['"email" must be a valid email'] });
  });
});

describe("GET /:id", () => {
  it("should return 404 if user not found", async () => {
    const res = await request(app).get("/999");
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "El usuario no existe" });
  });

  it("should return 200 and the user if found", async () => {
    // Primero, crea un usuario para probar
    const newUser = {
      name: "Test User 2",
      email: "test2@example.com",
      password: "testpassword",
    };
    const createRes = await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send(newUser);
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body).toHaveProperty("new_user");
    const userId = await User.findOne({ where: { email: newUser.email } }).then(
      (user) => user.id
    );
    const getRes = await request(app).get(`/${userId}`);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body).toEqual({
      user: {
        id: userId,
        name: newUser.name,
        email: newUser.email,
        password: expect.any(String), // La contraseña debería estar hasheada
        createdAt: expect.any(String), // La fecha de creación debería ser una cadena
        updatedAt: expect.any(String), // La fecha de creación debería ser una cadena
      },
    });
  });
});

describe("POST /login", () => {
  it("should return 400 if email or password is missing", async () => {
    const res = await request(app)
      .post("/login")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send({ email: "test@example.com" }); // Falta el campo password
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: "Username y password son requeridos" });
  });

  it("should return 401 if credentials are invalid", async () => {
    const res = await request(app)
      .post("/login")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({ username: "invaliduser", password: "wrongpassword" });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Credenciales incorrectas" });
  });

  it("should return 401 if user exists but password is wrong", async () => {
    // Crea un usuario válido primero
    const newUser = {
      name: "loginuser",
      email: "loginuser@example.com",
      password: "correctpassword",
    };
    await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send(newUser);

    const res = await request(app)
      .post("/login")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({ username: newUser.name, password: "wrongpassword" });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Credenciales incorrectas" });
  });

  it("should return 200 and set token cookie if credentials are correct", async () => {
    // Crea un usuario válido primero
    const validUser = {
      name: "validuser",
      email: "validuser@example.com",
      password: "validpassword",
    };
    const nuevo = await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send(validUser);

    const res = await request(app)
      .post("/login")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({ username: validUser.name, password: validUser.password });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Login exitoso" });
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^token=.*HttpOnly;/)])
    );
  });

  it("should return 429 if too many login attempts", async () => {
    // Intenta con credenciales incorrectas MAX_LOGIN_ATTEMPTS veces
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;
    let res;
    for (let i = 0; i < maxAttempts + 1; i++) {
      res = await request(app)
        .post("/login")
        .set("csrf-token", csrfToken)
        .set("Cookie", csrfCookie)
        .send({ username: "testuser", password: "wrongpassword" });
    }
    // En el último intento debe devolver el error de demasiados intentos
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({
      error:
        "Demasiados intentos de inicio de sesión, por favor intente luego de 15 minutos.",
    });
  });
});

describe("PUT /:id", () => {
  it("should return 401 if no token cookie", async () => {
    const res = await request(app)
      .put("/1")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send({
        name: "Updated User",
        email: "update@example.com",
        password: "newpassword",
      });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ message: "Token requerido" });
  });

  it("should return 404 if user not found", async () => {
    const fakeToken = jwt.sign({ id: 999 }, process.env.JWT_SECRET, {
      expiresIn: "5m",
    });
    const res = await request(app)
      .put("/999")
      .set("Cookie", [`token=${fakeToken}`, csrfCookie]) // Incluye la cookie CSRF
      .set("csrf-token", csrfToken)
      .send({
        name: "Updated User",
        email: "update@example.com",
        password: "newpassword",
      });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "El usuario no existe" });
  });

  it("should update user and return 200 if user exists", async () => {
    // Primero, crea un usuario para actualizar
    const newUser = {
      name: "User to Update",
      email: "update@example.com",
      password: "oldpassword",
    };
    const createRes = await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send(newUser);
    expect(createRes.statusCode).toBe(201);
    const userId = await User.findOne({ where: { email: newUser.email } }).then(
      (user) => user.id
    );
    const fakeToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: "5m",
    });
    const updateRes = await request(app)
      .put(`/${userId}`)
      .set("Cookie", [`token=${fakeToken}`, csrfCookie]) // Incluye la cookie CSRF
      .set("csrf-token", csrfToken)
      .send({
        name: "Updated User",
        email: "update@example.com",
        password: "newpassword",
      });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body).toEqual({
      message: "Usuario actualizado con exito",
      updated_user: {
        name: "Updated User",
        email: "update@example.com",
        password: expect.any(String), // La contraseña debería estar hasheada
      },
    });
  });
});

describe("DELETE /:id", () => {
  it("should return 401 if no token cookie", async () => {
    const res = await request(app)
      .delete("/1")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie); // Incluye la cookie CSRF
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ message: "Token requerido" });
  });

  it("should return 404 if user not found", async () => {
    const fakeToken = jwt.sign({ id: 999 }, process.env.JWT_SECRET, {
      expiresIn: "5m",
    });
    const res = await request(app)
      .delete("/999")
      .set("Cookie", [`token=${fakeToken}`, csrfCookie]) // Incluye la cookie CSRF
      .set("csrf-token", csrfToken);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "El usuario no existe" });
  });

  it("should delete user and return 200 if user exists", async () => {
    // Primero, crea un usuario para eliminar
    const newUser = {
      name: "User to Delete",
      email: "delete@example.com",
      password: "passwordtodelete",
    };
    const createRes = await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie) // Incluye la cookie CSRF
      .send(newUser);
    expect(createRes.statusCode).toBe(201);
    const userId = await User.findOne({ where: { email: newUser.email } }).then(
      (user) => user.id
    );
    const fakeToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: "5m",
    });
    const deleteRes = await request(app)
      .delete(`/${userId}`)
      .set("Cookie", [`token=${fakeToken}`, csrfCookie]) // Incluye la cookie CSRF
      .set("csrf-token", csrfToken);
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body).toEqual({ message: "Usuario eliminado con éxito" });
    // Verifica que el usuario ya no existe
    const checkRes = await request(app).get(`/${userId}`);
    expect(checkRes.statusCode).toBe(404);
    expect(checkRes.body).toEqual({ error: "El usuario no existe" });
  });
});

describe("POST /logout", () => {
  it("should return 401 if no session (no token cookie)", async () => {
    const res = await request(app)
      .post("/logout")
      .set("Cookie", csrfCookie)
      .set("csrf-token", csrfToken);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "No existe sesión activa" });
  });

  it("should clear token cookie and return 200 if session exists", async () => {
    // Simulate login to set token cookie
    const fakeToken = "faketoken";
    const res = await request(app)
      .post("/logout")
      .set("Cookie", [`token=${fakeToken}`, csrfCookie]) // Include the CSRF cookie
      .set("csrf-token", csrfToken);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Sesión cerrada" });
    // Optionally, check that the cookie is cleared
    expect(res.headers["set-cookie"].some((c) => c.startsWith("token=;"))).toBe(
      true
    );
  });
});

describe("CSRF Protection", () => {
  it("should return 403 if CSRF token is missing on protected POST", async () => {
    const res = await request(app)
      .post("/")
      .send({ name: "No CSRF", email: "no@csrf.com", password: "123456" });
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/Token CSRF inválido/);
  });

  it("should return 403 if CSRF token is invalid", async () => {
    const res = await request(app)
      .post("/")
      .set("csrf-token", "invalidtoken")
      .set("Cookie", csrfCookie)
      .send({ name: "No CSRF", email: "no@csrf.com", password: "123456" });
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/Token CSRF inválido/);
  });
});

describe("Security headers and cookies", () => {
  it("should set HttpOnly, Secure, and SameSite=Strict on token cookie after login", async () => {
    const validUser = {
      name: "headeruser",
      email: "headeruser@example.com",
      password: "headerpassword",
    };
    await request(app)
      .post("/")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send(validUser);

    const res = await request(app)
      .post("/login")
      .set("csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({ username: validUser.name, password: validUser.password });

    const tokenCookie = (res.headers["set-cookie"] || []).find((c) =>
      c.startsWith("token=")
    );
    expect(tokenCookie).toMatch(/HttpOnly/);
    expect(tokenCookie).toMatch(/SameSite=Strict/);
    expect(tokenCookie).toMatch(/Secure/);
  });
});

describe("App structure and middleware integration", () => {
  it("should handle CSRF errors with custom message", async () => {
    const res = await request(app)
      .post("/")
      .send({ name: "test", email: "test@csrf.com", password: "123456" });
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/Token CSRF inválido/);
  });
});
