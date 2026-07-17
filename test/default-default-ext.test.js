'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');
const eol = require('eol');

test('default defaultExt', (t) => {
  t.plan(2);
  const server = http.createServer(ecstatic(`${__dirname}/public/subdir`));

  server.listen(0, async () => {
    const port = server.address().port;
    const res = await client.get(`http://localhost:${port}`);
    t.equal(res.statusCode, 200);
    t.equal(eol.lf(res.body), 'index!!!\n');

    server.close(() => {
      t.end();
    });
  });
});
