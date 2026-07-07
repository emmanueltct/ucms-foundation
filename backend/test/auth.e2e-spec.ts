import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end skeleton for the Foundation module's auth flow.
 *
 * Requires a real (test) Postgres database migrated via
 * `DATABASE_URL=<test-db-url> npx prisma migrate deploy` and seeded via
 * `npm run prisma:seed` before running. Wire this into CI as a separate
 * job from the fast unit-test suite (see .github/workflows in this repo).
 *
 * Demo tenant/user come from prisma/seed.ts:
 *   tenant slug: demo-church
 *   admin login: admin@demo-church.test / ChangeMe123
 */
describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  const TENANT_HEADER = { 'X-Tenant-Slug': 'demo-church' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests where the tenant cannot be resolved', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin@demo-church.test',
      password: 'ChangeMe123',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TENANT_NOT_RESOLVED');
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(TENANT_HEADER)
      .send({ email: 'admin@demo-church.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in with valid credentials and returns an access/refresh token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(TENANT_HEADER)
      .send({ email: 'admin@demo-church.test', password: 'ChangeMe123' });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.user.permissions.length).toBeGreaterThan(0);
  });

  it('rejects a protected route without an access token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users').set(TENANT_HEADER);
    expect(res.status).toBe(401);
  });

  it('allows a protected route with a valid access token and sufficient permissions', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(TENANT_HEADER)
      .send({ email: 'admin@demo-church.test', password: 'ChangeMe123' });

    const accessToken = login.body.data.tokens.accessToken;

    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set(TENANT_HEADER)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(TENANT_HEADER)
      .send({ email: 'admin@demo-church.test', password: 'ChangeMe123' });

    const oldRefreshToken = login.body.data.tokens.refreshToken;

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(TENANT_HEADER)
      .send({ refreshToken: oldRefreshToken });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.tokens.refreshToken).not.toBe(oldRefreshToken);

    const reuseAttempt = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(TENANT_HEADER)
      .send({ refreshToken: oldRefreshToken });

    expect(reuseAttempt.status).toBe(401);
  });
});
