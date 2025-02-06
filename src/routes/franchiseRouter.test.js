const { agent } = require("supertest");
const {
  describe,
  test,
  expect,
  afterAll,
  beforeEach,
} = require("@jest/globals");
const app = require("../service");
const { Role } = require("../model/model");

const request = agent(app);

const generateRandomString = () => Math.random().toString(36);

const generateEmail = () =>
  generateRandomString().substring(2, 12) + "@test.com";

let adminAuthToken;
const admin = { name: "Admin", email: "", password: "admin", role: Role.Admin };
let adminId;

let franchiseId;
const franchisee = { name: "Franchisee", email: "", password: "f" };

let franchiseeAuthToken;
let franchiseeId;

const getFranchise = (email) => ({
  name: `Pizza Franchise ${generateRandomString()}`,
  admins: [{ email }],
});

const sendFranchiseCreateReq = async (authToken, franchise) => {
  return await request
    .post("/api/franchise")
    .set("Authorization", `Bearer ${authToken}`)
    .send(franchise);
};

const getStore = (franchiseId) => ({
  franchiseId,
  name: `${generateRandomString()} Store`,
});

let existingFranchiseIds = [];
let existingFranchises;

beforeEach(async () => {
  admin.email = generateEmail();
  const regRes = await request.post("/api/auth").send(admin);
  adminAuthToken = regRes.body.token;
  adminId = regRes.body.user.id;

  franchisee.email = generateEmail();
  const registerRes = await request.post("/api/auth").send(franchisee);
  franchiseeAuthToken = registerRes.body.token;
  franchiseeId = registerRes.body.user.id;

  existingFranchises = [
    getFranchise(admin.email),
    getFranchise(franchisee.email),
  ];
  existingFranchiseIds = [];

  for (let i = 0; i < existingFranchises.length; i++) {
    const createReq = await sendFranchiseCreateReq(
      adminAuthToken,
      existingFranchises[i],
    );
    existingFranchiseIds.push(createReq.body.id);
  }
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

describe("createFranchise", () => {
  test("works for an admin through admin", async () => {
    const franchise = getFranchise(admin.email);
    const createRes = await sendFranchiseCreateReq(adminAuthToken, franchise);

    expect(createRes.status).toBe(200);

    const { name, admins, id } = createRes.body;
    franchiseId = id;
    const expectedAdmins = [
      ...franchise.admins.map((obj) => ({
        ...obj,
        id: adminId,
        name: admin.name,
      })),
    ];

    expect(name).toBe(franchise.name);
    expect(admins).toStrictEqual(expectedAdmins);
  });

  test("works for franchisee through admin", async () => {
    const franchise = getFranchise(franchisee.email);
    const createRes = await sendFranchiseCreateReq(adminAuthToken, franchise);

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
    const createRes = await sendFranchiseCreateReq(
      franchiseeAuthToken,
      franchise,
    );
    expect(createRes.status).toBe(403);
    expect(
      createRes.body.message.includes("unable to create a franchise"),
    ).toBeTruthy();
  });

  test("does not work for franchisee through franchisee", async () => {
    const franchise = getFranchise(franchisee.email);
    const createRes = await sendFranchiseCreateReq(
      franchiseeAuthToken,
      franchise,
    );
    expect(createRes.status).toBe(403);
    expect(
      createRes.body.message.includes("unable to create a franchise"),
    ).toBeTruthy();
  });
});

describe("deleteFranchise", () => {
  test("delete with existing id", async () => {
    const franchise = getFranchise(franchisee.email);
    const createRes = await sendFranchiseCreateReq(adminAuthToken, franchise);

    const deleteRes = await request
      .delete(`/api/franchise/${createRes.body.id}`)
      .set("Authorization", `Bearer ${adminAuthToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe("franchise deleted");
  });

  test("franchise cannot be deleted by non-admin", async () => {
    const deleteRes = await request
      .delete(`/api/franchise/${existingFranchiseIds[0]}`)
      .set("Authorization", `Bearer ${franchiseeAuthToken}`);

    expect(deleteRes.status).toBe(403);
    expect(
      deleteRes.body.message.includes("unable to delete a franchise"),
    ).toBeTruthy();
  });
});

describe("createStore", () => {
  test("admin can create store for existing franchise", async () => {
    const store = getStore(existingFranchiseIds[0]);

    const storeRes = await request
      .post(`/api/franchise/${existingFranchiseIds[0]}/store`)
      .set("Authorization", `Bearer ${adminAuthToken}`)
      .send(store);

    const { name, franchiseId } = storeRes.body;
    expect(storeRes.status).toBe(200);
    expect(name).toBe(store.name);
    expect(franchiseId).toBe(existingFranchiseIds[0]);
  });

  test("franchisee cannot create store for existing franchise", async () => {
    const store = getStore(existingFranchiseIds[0]);
    const storeRes = await request
      .post(`/api/franchise/${existingFranchiseIds[0]}/store`)
      .set("Authorization", `Bearer ${franchiseeAuthToken}`)
      .send(store);

    expect(storeRes.status).toBe(403);
    expect(storeRes.body.message).toBe("unable to create a store");
  });

  test("admin cannot create store for nonexistent franchise", async () => {
    const store = getStore(existingFranchiseIds[0] + 20);
    const storeRes = await request
      .post(`/api/franchise/${existingFranchiseIds[0] + 20}/store`)
      .set("Authorization", `Bearer ${adminAuthToken}`)
      .send(store);

    expect(storeRes.status).toBe(500);
    expect(storeRes.body.message.includes("Cannot add or update")).toBeTruthy();
  });
});

describe("deleteStore", () => {
  let storeId;

  beforeEach(async () => {
    const store = getStore(existingFranchiseIds[0]);
    const createRes = await request
      .post(`/api/franchise/${existingFranchiseIds[0]}/store`)
      .set("Authorization", `Bearer ${adminAuthToken}`)
      .send(store);
    storeId = createRes.body.id;
  });

  test("admin can delete existing store from existing franchise", async () => {
    const delRes = await request
      .delete(`/api/franchise/${existingFranchiseIds[0]}/store/${storeId}`)
      .set("Authorization", `Bearer ${adminAuthToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.message).toBe("store deleted");
  });

  test("franchisee cannot delete existing store from existing franchise", async () => {
    const delRes = await request
      .delete(`/api/franchise/${existingFranchiseIds[0]}/store/${storeId}`)
      .set("Authorization", `Bearer ${franchiseeAuthToken}`);

    expect(delRes.status).toBe(403);
    expect(delRes.body.message).toBe("unable to delete a store");
  });
});

test("getFranchises lists as expected", async () => {
  const listRes = await request.get("/api/franchise");
  expect(listRes.status).toBe(200);
});

test("getUserFranchises lists as expected", async () => {
  let listRes = await request
    .get(`/api/franchise/${franchiseeId}`)
    .set("Authorization", `Bearer ${adminAuthToken}`);
  expect(listRes.status).toBe(200);

  listRes = await request
    .get(`/api/franchise/${franchiseeId}`)
    .set("Authorization", `Bearer ${franchiseeAuthToken}`);
  expect(listRes.status).toBe(200);

  listRes = await request
    .get(`/api/franchise/${adminId}`)
    .set("Authorization", `Bearer ${franchiseeAuthToken}`);
  expect(listRes.status).toBe(200);
});
