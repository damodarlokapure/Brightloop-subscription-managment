const request = require('supertest');
const app = require('../src/app');

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.time).toBeDefined();
  });
});
