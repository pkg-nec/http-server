'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');

test('malformed showdir uri', (t) => {
  const server = http.createServer(ecstatic(__dirname, { showDir: true }));

  t.plan(1);

  server.listen(0, async () => {
    const res = await client.get(`http://localhost:${server.address().port}/?%`);
    t.equal(res.statusCode, 400);

    server.close(() => {
      t.end();
    });
  });
});
