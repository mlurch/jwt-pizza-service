const { agent } = require("supertest");
const {
  describe,
  test,
  beforeAll,
  expect,
  afterAll,
} = require("@jest/globals");
const app = require("../service");

const request = agent(app);

const generateEmail = () =>
  Math.random().toString(36).substring(2, 12) + "@test.com";

let adminAuthToken;
const admin = { name: "常用名字", email: "a@jwt.com", password: "admin" };

let franchiseId;
const franchisee = { name: "Franchisee", email: "", password: "f" };

let franchiseeAuthToken;
let franchiseeId;

const getFranchise = (email) => ({
  name: `Pizza Franchise ${Math.random().toString(36)}`,
  admins: [{ email }],
});

const sendCreateReq = async (authToken, franchise) => {
  return await request
    .post("/api/franchise")
    .set("Authorization", `Bearer ${authToken}`)
    .send(franchise);
};

beforeAll(async () => {
  const loginRes = await request.put("/api/auth").send(admin);
  adminAuthToken = loginRes.body.token;
  console.log(loginRes.body);

  franchisee.email = generateEmail();
  const registerRes = await request.post("/api/auth").send(franchisee);
  franchiseeAuthToken = registerRes.body.token;
  franchiseeId = registerRes.body.user.id;
});

afterAll(async () => {
  if (franchiseId && adminAuthToken) {
    await request
      .delete(`/api/franchise/${franchiseId}`)
      .set("Authorization", `Bearer ${adminAuthToken}`);
    franchiseId = null;
  }

  if (adminAuthToken) {
    await request
      .delete("/api/auth")
      .set("Authorization", `Bearer ${adminAuthToken}`);
    adminAuthToken = null;
  }

  if (franchiseeAuthToken) {
    await request
      .delete("/api/auth")
      .set("Authorization", `Bearer ${franchiseeAuthToken}`);
    franchiseeAuthToken = null;
  }
});

describe.only("createFranchise", () => {
  test.only("works for an admin through admin", async () => {
    const franchise = getFranchise(admin.email);
    console.log(adminAuthToken);
    const createRes = await sendCreateReq(adminAuthToken, franchise);
    console.log(createRes.body);

    expect(createRes.status).toBe(200);

    const { name, admins, id } = createRes.body;
    franchiseId = id;
    const expectedAdmins = [
      ...franchise.admins.map((obj) => ({ ...obj, id: 1, name: admin.name })),
    ];

    expect(name).toBe(franchise.name);
    expect(admins).toStrictEqual(expectedAdmins);
  });

  test("works for franchisee through admin", async () => {
    const franchise = getFranchise(franchisee.email);
    const createRes = await sendCreateReq(adminAuthToken, franchise);

    expect(createRes.status).toBe(200);

    const { name, admins, id } = createRes.body;
    franchiseId = id;
    const expectedAdmins = [
      ...franchise.admins.map((obj) => ({
        ...obj,
        id: franchiseeId,
        name: franchisee.name,
      })),
    ];

    expect(name).toBe(franchise.name);
    expect(admins).toStrictEqual(expectedAdmins);
  });

  test("does not work for admin through franchisee", async () => {
    const franchise = getFranchise(admin.email);
    const createRes = await sendCreateReq(franchiseeAuthToken, franchise);
    expect(createRes.status).toBe(403);
    expect(
      createRes.body.message.includes("unable to create a franchise"),
    ).toBeTruthy();
  });

  test("does not work for franchisee through franchisee", async () => {
    const franchise = getFranchise(franchisee.email);
    const createRes = await sendCreateReq(franchiseeAuthToken, franchise);
    expect(createRes.status).toBe(403);
    expect(
      createRes.body.message.includes("unable to create a franchise"),
    ).toBeTruthy();
  });
});

describe("deleteFranchise", () => {
  test("delete with existing id", async () => {
    const franchise = getFranchise(franchisee.email);
    const createRes = await sendCreateReq(adminAuthToken, franchise);

    const deleteRes = await request
      .delete(`/api/franchise/${createRes.body.id}`)
      .set("Authorization", `Bearer ${adminAuthToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe("franchise deleted");
  });

  test("franchise cannot be deleted by non-admin", async () => {
    const franchise = getFranchise(franchisee.email);
    const { id } = await sendCreateReq(adminAuthToken, franchise);

    const deleteRes = await request
      .delete(`/api/franchise/${id}`)
      .set("Authorization", `Bearer ${franchiseeAuthToken}`);

    expect(deleteRes.status).toBe(403);
    expect(
      deleteRes.body.message.includes("unable to delete a franchise"),
    ).toBeTruthy();
  });
});
