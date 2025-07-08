const { hashPassword, verifyPassword } = require("../utils");

describe("verifyPassword", () => {
  it("should return true for correct password", async () => {
    const password = "mySecret123";
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it("should return false for incorrect password", async () => {
    const password = "mySecret123";
    const wrongPassword = "wrongPassword";
    const hash = await hashPassword(password);
    const result = await verifyPassword(wrongPassword, hash);
    expect(result).toBe(false);
  });

  it("should return false for empty password", async () => {
    const password = "mySecret123";
    const hash = await hashPassword(password);
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });

  it("should return false for empty hash", async () => {
    const password = "mySecret123";
    const result = await verifyPassword(password, "");
    expect(result).toBe(false);
  });
});
