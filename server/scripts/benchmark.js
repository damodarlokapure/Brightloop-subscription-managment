const axios = require('axios');

const baseUrl = process.env.BASE_URL || 'http://localhost:4000/api';
const endpoints = [
  '/reports/summary?from=2025-01-01&to=2026-12-31',
  '/reports/revenue-trend?from=2025-01-01&to=2026-12-31&groupBy=month',
  '/reports/subscriptions-by-status',
  '/reports/subscriptions-by-plan',
  '/reports/payments-by-method',
  '/reports/overdue-invoices?page=1&limit=20',
  '/reports/top-customers?page=1&limit=20',
  '/invoices?overdue=true&page=1&limit=20'
];

async function fetchWithTiming(url) {
  const started = Date.now();
  const response = await axios.get(`${baseUrl}${url}`);
  const ms = Date.now() - started;
  return { url, ms, status: response.status };
}

(async () => {
  const results = [];

  for (const endpoint of endpoints) {
    try {
      const result = await fetchWithTiming(endpoint);
      results.push(result);
      console.log(`${endpoint} => ${result.ms} ms`);
    } catch (error) {
      console.log(`${endpoint} => ERROR: ${error.message}`);
    }
  }

  console.log('\nSummary:');
  for (const item of results) {
    console.log(`${item.url} :: ${item.ms} ms`);
  }
})();
