'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');
const eol = require('eol');

test('escaping special characters', (t) => {
  const server = http.createServer(ecstatic(`${__dirname}/public`));

  server.listen(0, async () => {
    const port = server.address().port;
    const res = await client.get(`http://localhost:${port}/curimit%40gmail.com%20(40%25)`);
    t.equal(res.statusCode, 200);
    t.equal(eol.lf(res.body), 'index!!!\n');

    server.close(() => {
      t.end();
    });
  });
});
