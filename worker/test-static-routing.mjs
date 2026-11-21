import assert from 'node:assert/strict';
import worker from './src/index.js';

const base = 'https://kazino-lakay.test';
const seen = [];
const env = {
  ASSETS: {
    fetch: async (request) => {
      const url = new URL(request.url);
      seen.push({ pathname: url.pathname, method: request.method });
      return new Response('<h1>Kazino Lakay Admin</h1>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }
  }
};

for (const path of ['/admin', '/admin/']) {
  const response = await worker.fetch(new Request(base + path), env);
  assert.equal(response.status, 200, path + ' must serve the admin page');
  assert.equal(response.headers.get('Location'), null, path + ' must not issue a redirect');
  assert.match(await response.text(), /Kazino Lakay Admin/);
}
assert.deepEqual(seen, [
  { pathname: '/admin.html', method: 'GET' },
  { pathname: '/admin.html', method: 'GET' }
]);

const unavailable = await worker.fetch(new Request(base + '/admin'), {});
assert.equal(unavailable.status, 503, 'Missing assets binding must fail clearly, not redirect');

console.log('Kazino Lakay admin routing: /admin and /admin/ serve admin.html directly without redirects.');
