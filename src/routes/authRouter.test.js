const request = require("supertest");
const {
  beforeEach,
  expect,
  test,
  describe,
  afterEach,
} = require("@jest/globals");
const app = require("../service");
const { Role } = require("../model/model");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testUserId;
let extraToken;

const generateRandomEmail = () =>
  Math.random().toString(36).substring(2, 12) + "@test.com";

beforeEach(async () => {
  testUser.email = generateRandomEmail();
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;
});

afterEach(async () => {
  if (testUserAuthToken) {
    await request(app)
      .delete("/api/auth")
      .set("Authorization", `Bearer ${testUserAuthToken}`);
    testUserAuthToken = null;
  }

  if (extraToken) {
    await request(app)
      .delete("/api/auth")
      .set("Authorization", `Bearer ${extraToken}`);
    extraToken = null;
  }
});

test("register", async () => {
  testUser.email = generateRandomEmail();
  const regRes = await request(app).post("/api/auth").send(testUser);
  extraToken = regRes.body.token;
  expect(regRes.status).toBe(200);
  expect(regRes.body.token).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );

  const user = { ...testUser, roles: [{ role: Role.Diner }] };
  delete user["password"];
  expect(regRes.body.user).toMatchObject(user);
});

describe("Test login", () => {
  test("login once", async () => {
    const loginRes = await request(app).put("/api/auth").send(testUser);
    extraToken = loginRes.body.token;

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toMatch(
      /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
    );

    const user = { ...testUser, roles: [{ role: Role.Diner }] };
    delete user["password"];
    expect(loginRes.body.user).toMatchObject(user);
  });

  test("login multiple times", async () => {
    let loginRes = await request(app).put("/api/auth").send(testUser);
    extraToken = loginRes.body.token;

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toMatch(
      /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
    );

    const user = { ...testUser, roles: [{ role: Role.Diner }] };
    delete user["password"];
    expect(loginRes.body.user).toMatchObject(user);

    loginRes = await request(app).put("/api/auth").send(testUser);
    expect(loginRes.status).toBe(500);
    expect(loginRes.body.message.includes("Duplicate entry")).toBeTruthy();
  });
});

describe("Test logout", () => {
  const logout = async (token = testUserAuthToken) => {
    return await request(app)
      .delete("/api/auth")
      .set("Authorization", `Bearer ${token}`);
  };

  test("logout user that is logged in", async () => {
    const logResp = await logout();
    testUserAuthToken = null;
    expect(logResp.status).toBe(200);
  });

  test("logout user that isn't logged in fails", async () => {
    const logResp = await logout("");
    expect(logResp.status).toBe(401);
    expect(logResp.body.message.includes("unauthorized")).toBeTruthy();
  });
});

describe("Test update user", () => {
  const updateUser = async (id, newBody, authToken = testUserAuthToken) => {
    return await request(app)
      .put(`/api/auth/${id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send(newBody);
  };

  test("update existing user's email & password", async () => {
    const update = { password: "b", email: generateRandomEmail() };
    const updateRes = await updateUser(testUserId, update);

    expect(updateRes.status).toBe(200);

    const { email, id } = updateRes.body;
    expect(email).toBe(update.email);
    expect(id).toBe(testUserId);
  });

  test("call update on existing user with no changes", async () => {
    const updateRes = await updateUser(testUserId, testUser);
    expect(updateRes.status).toBe(200);

    const { email, id } = updateRes.body;
    expect(email).toBe(testUser.email);
    expect(id).toBe(testUserId);
  });

  test("update user without password", async () => {
    const updateRes = await updateUser(testUserId, {
      email: generateRandomEmail(),
    });
    expect(updateRes.status).toBe(500);
    expect(
      updateRes.body.message.includes("data and hash arguments required"),
    ).toBeTruthy();
  });

  test("update user without email", async () => {
    const updateRes = await updateUser(testUserId, { password: "new new new" });
    expect(updateRes.status).toBe(500);
    expect(
      updateRes.body.message.includes("must not contain undefined"),
    ).toBeTruthy();
  });

  test("update non-existing user", async () => {
    const updateRes = await updateUser(testUserId + 1, {});
    expect(updateRes.status).toBe(403);
    expect(updateRes.body.message.includes("unauthorized")).toBeTruthy();
  });

  test("update existing user unauthorized", async () => {
    const updateRes = await updateUser(testUserId, { password: "feet" }, "");
    expect(updateRes.status).toBe(401);
    expect(updateRes.body.message.includes("unauthorized")).toBeTruthy();
  });
});
