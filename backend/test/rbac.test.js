/**
 * RBAC: rol -> ruxsat matritsasi va admin akkaunt boshqaruvi testlari.
 * Run: node --test --test-force-exit test/rbac.test.js
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { pools } from '../src/config/db.js';
import {
  roleHasPermission,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  requirePermission,
} from '../src/middleware/rbac.js';
import {
  createAdminAccount,
  updateAdminAccount,
  resetAdminPassword,
  loginAdminAccount,
  changeOwnPassword,
} from '../src/services/adminAccountsService.js';

const db = pools.users;
const TEST_PREFIX = `rbactest_${crypto.randomBytes(3).toString('hex')}`;

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
}

describe('rbac: rol-ruxsat matritsasi', () => {
  it('owner hamma ruxsatga ega', () => {
    for (const p of Object.values(PERMISSIONS)) {
      assert.ok(roleHasPermission('owner', p), `owner: ${p}`);
    }
  });

  it('uploader faqat kitob/immersion boshqaradi', () => {
    assert.ok(roleHasPermission('uploader', PERMISSIONS.MANAGE_BOOKS));
    assert.ok(roleHasPermission('uploader', PERMISSIONS.MANAGE_IMMERSION));
    assert.equal(roleHasPermission('uploader', PERMISSIONS.MANAGE_ADMINS), false);
    assert.equal(roleHasPermission('uploader', PERMISSIONS.MODERATE_COMMUNITY), false);
    assert.equal(roleHasPermission('uploader', PERMISSIONS.MANAGE_CROSSWORDS), false);
  });

  it('moderator moderatsiya + foydalanuvchi ko‘rish, kontent emas', () => {
    assert.ok(roleHasPermission('moderator', PERMISSIONS.MODERATE_COMMUNITY));
    assert.ok(roleHasPermission('moderator', PERMISSIONS.VIEW_USERS));
    assert.equal(roleHasPermission('moderator', PERMISSIONS.MANAGE_BOOKS), false);
    assert.equal(roleHasPermission('moderator', PERMISSIONS.MANAGE_ADMINS), false);
  });

  it('editor kontentni boshqaradi, adminlarni emas', () => {
    assert.ok(roleHasPermission('editor', PERMISSIONS.MANAGE_CROSSWORDS));
    assert.ok(roleHasPermission('editor', PERMISSIONS.MANAGE_LESSONS));
    assert.equal(roleHasPermission('editor', PERMISSIONS.MANAGE_ADMINS), false);
    assert.equal(roleHasPermission('editor', PERMISSIONS.MANAGE_USERS), false);
  });

  it('noma’lum rol hech narsaga ega emas', () => {
    assert.equal(roleHasPermission('hacker', PERMISSIONS.MANAGE_BOOKS), false);
    assert.equal(ROLE_PERMISSIONS.hacker, undefined);
  });

  it('requirePermission: tokensiz 401', () => {
    const mw = requirePermission(PERMISSIONS.MANAGE_BOOKS);
    const res = mockRes();
    let called = false;
    mw({ headers: {} }, res, () => {
      called = true;
    });
    assert.equal(called, false);
    assert.equal(res.statusCode, 401);
  });
});

describe('rbac: admin akkaunt boshqaruvi + token oqimi', () => {
  let created = null;
  const email = `${TEST_PREFIX}@test.local`;
  const password = 'test-parol-123';

  it('akkaunt yaratish va rol bilan login', async () => {
    created = await createAdminAccount({ email, password, role: 'moderator' });
    assert.ok(created.id);
    assert.equal(created.role, 'moderator');

    const login = await loginAdminAccount(email, password);
    assert.ok(login.token.includes('.'));
    assert.equal(login.admin.role, 'moderator');

    // Token requirePermission orqali o‘tishi kerak (moderatsiya uchun)
    const mw = requirePermission(PERMISSIONS.MODERATE_COMMUNITY);
    const req = { headers: { authorization: `Bearer ${login.token}` } };
    const res = mockRes();
    let passed = false;
    mw(req, res, () => {
      passed = true;
    });
    assert.equal(passed, true);
    assert.equal(req.admin.role, 'moderator');

    // Lekin kitob boshqarishga 403
    const mw2 = requirePermission(PERMISSIONS.MANAGE_BOOKS);
    const res2 = mockRes();
    let passed2 = false;
    mw2({ headers: { authorization: `Bearer ${login.token}` } }, res2, () => {
      passed2 = true;
    });
    assert.equal(passed2, false);
    assert.equal(res2.statusCode, 403);
  });

  it('dublikat email 409', async () => {
    await assert.rejects(
      () => createAdminAccount({ email, password: 'boshqa-parol1', role: 'editor' }),
      (err) => err.statusCode === 409
    );
  });

  it('rol almashtirish va deaktivatsiya', async () => {
    const upd = await updateAdminAccount(created.id, { role: 'editor' });
    assert.equal(upd.role, 'editor');

    const off = await updateAdminAccount(created.id, { active: false });
    assert.equal(off.active, 0);

    await assert.rejects(
      () => loginAdminAccount(email, password),
      (err) => err.statusCode === 401
    );

    await updateAdminAccount(created.id, { active: true });
  });

  it('parol reset va o‘z parolini almashtirish', async () => {
    await resetAdminPassword(created.id, 'yangi-parol-123');
    const login = await loginAdminAccount(email, 'yangi-parol-123');
    assert.ok(login.token);

    await changeOwnPassword(created.id, 'yangi-parol-123', 'ozgargan-parol-1');
    const login2 = await loginAdminAccount(email, 'ozgargan-parol-1');
    assert.ok(login2.token);

    await assert.rejects(
      () => changeOwnPassword(created.id, 'notogri-eski', 'baribir-yangi-1'),
      (err) => err.statusCode === 401
    );
  });

  it('yaroqsiz rol rad etiladi', async () => {
    await assert.rejects(
      () => createAdminAccount({ email: `x${email}`, password, role: 'superman' }),
      (err) => err.statusCode === 400
    );
  });

  after(async () => {
    await db.query(`DELETE FROM admin_accounts WHERE email LIKE 'rbactest\\_%'`);
  });
});
