const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const { effectiveUnitPrice } = require('../src/services/pricing');

beforeAll(async () => {
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.passwordResetToken.deleteMany();
});

describe('Auth API', () => {
  it('rejects duplicate email on signup', async () => {
    const payload = {
      name: 'Alice Customer',
      email: 'alice@example.com',
      password: 'StrongPass@123'
    };

    const first = await request(app).post('/api/auth/signup').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/auth/signup').send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('requires a strong password and rejects exactly 8 characters', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Weak User',
      email: 'weak@example.com',
      password: 'Abcdef1!' 
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEAK_PASSWORD');
  });

  it('creates a reset token and allows a valid reset flow', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      name: 'Reset User',
      email: 'reset@example.com',
      password: 'StrongPass@123'
    });

    expect(signup.status).toBe(201);

    const forgot = await request(app).post('/api/auth/forgot-password').send({
      email: 'reset@example.com'
    });

    expect(forgot.status).toBe(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'reset@example.com' } }
    });
    expect(tokenRecord).toBeTruthy();

    const newPassword = 'NewStrong@456';
    const reset = await request(app).post('/api/auth/reset-password').send({
      token: tokenRecord.tokenHash,
      password: newPassword
    });

    expect(reset.status).toBe(200);
  });

  it('blocks non-admin staff creation for staff and customer roles', async () => {
    const staffUser = await request(app).post('/api/auth/signup').send({
      name: 'Staff Test',
      email: 'stafftest@example.com',
      password: 'StrongPass@123'
    });

    const staffLogin = await request(app).post('/api/auth/login').send({
      email: 'stafftest@example.com',
      password: 'StrongPass@123'
    });

    const staffToken = staffLogin.body.token;
    const resStaff = await request(app)
      .post('/api/users/staff')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Nope', email: 'nope@example.com' });

    expect(resStaff.status).toBe(403);

    const customer = await request(app).post('/api/auth/signup').send({
      name: 'Customer Test',
      email: 'customertest@example.com',
      password: 'StrongPass@123'
    });

    const customerLogin = await request(app).post('/api/auth/login').send({
      email: 'customertest@example.com',
      password: 'StrongPass@123'
    });

    const customerRes = await request(app)
      .post('/api/users/staff')
      .set('Authorization', `Bearer ${customerLogin.body.token}`)
      .send({ name: 'Nope', email: 'nope2@example.com' });

    expect(customerRes.status).toBe(403);
  });

  it('allows admins to create staff accounts', async () => {
    const admin = await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@brightloop.com',
        passwordHash: '$2b$10$uMc88OMR0UkCSpuHuP2tW.eJ0skB4E9C0E4p8vaYGxp1UQXhWx88S',
        role: 'ADMIN',
        isActive: true
      }
    });

    const token = require('jsonwebtoken').sign(
      { id: admin.id, role: admin.role, customerId: null },
      process.env.JWT_SECRET || 'development-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const res = await request(app)
      .post('/api/users/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Staff User',
        email: 'staffkeeper@example.com',
        password: 'StrongPass@123'
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('staffkeeper@example.com');
  });
});

describe('Pricing Service', () => {
  it('calculates the effective price for a product variant example', () => {
    const product = { salesPrice: 1000 };
    const variant = { extraPrice: 560 };

    expect(effectiveUnitPrice(product, variant)).toBe(1560);
  });
});
