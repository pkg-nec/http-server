'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const path = require('path');
const client = require('./lib/http-client');

test('if-modified-since illegal access date', (t) => {
  const dir = path.join(__dirname, 'public');
  const server = http.createServer(ecstatic(dir));

  t.plan(1);

  server.listen(0, async () => {
    const res = await client.get(`http://localhost:${server.address().port}/a.txt`, {
      headers: {
        'if-modified-since': '275760-09-24'
      }
    });
    t.equal(res.statusCode, 200);

    server.close(() => {
      t.end();
    });
  });
});
