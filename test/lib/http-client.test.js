const t = require('tap');
const http = require('http');
const client = require('./http-client');

// Start a simple HTTP test server
let server;
let httpsServer;

t.before(async () => {
  // HTTP server
  server = http.createServer((req, res) => {
    if (req.url === '/success') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } else if (req.url === '/not-found') {
      res.writeHead(404);
      res.end('Not found');
    } else if (req.url === '/auth-required') {
      const auth = req.headers.authorization;
      if (auth === 'Basic dXNlcjpwYXNz') {
        // base64('user:pass')
        res.writeHead(200);
        res.end('Authenticated');
      } else {
        res.writeHead(401);
        res.end('Unauthorized');
      }
    } else {
      res.writeHead(200);
      res.end('OK');
    }
  });

  await new Promise((resolve) => {
    server.listen(0, resolve);
  });
});

t.teardown(() => {
  if (server) server.close();
  if (httpsServer) httpsServer.close();
});

t.test('GET request successful response', async (t) => {
  const port = server.address().port;
  const res = await client.get(`http://localhost:${port}/success`);
  t.equal(res.statusCode, 200, 'Status code is 200');
  t.ok(res.body.includes('ok'), 'Body contains response');
  t.ok(res.headers, 'Headers object exists');
});

t.test('GET request 404 response', async (t) => {
  const port = server.address().port;
  const res = await client.get(`http://localhost:${port}/not-found`);
  t.equal(res.statusCode, 404, 'Status code is 404');
  t.equal(res.body, 'Not found', 'Body matches');
});

t.test('POST request with body', async (t) => {
  const port = server.address().port;
  const res = await client.post(`http://localhost:${port}/`, {
    body: JSON.stringify({ key: 'value' }),
    headers: { 'Content-Type': 'application/json' },
  });
  t.equal(res.statusCode, 200, 'Status code is 200');
});

t.test('Basic auth header encoding', async (t) => {
  const port = server.address().port;
  const res = await client.get(`http://localhost:${port}/auth-required`, {
    auth: { username: 'user', password: 'pass' },
  });
  t.equal(res.statusCode, 200, 'Status code is 200 with correct auth');
  t.equal(res.body, 'Authenticated', 'Auth successful');
});

t.test('Custom headers passed through', async (t) => {
  const port = server.address().port;
  const res = await client.get(`http://localhost:${port}/`, {
    headers: { 'X-Custom-Header': 'test-value' },
  });
  t.equal(res.statusCode, 200, 'Status code is 200');
});

t.test('Generic request method with options', async (t) => {
  const port = server.address().port;
  const res = await client.request(`http://localhost:${port}/success`, {
    method: 'GET',
  });
  t.equal(res.statusCode, 200, 'Status code is 200');
});
