'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');

test('should not add trailing slash when showDir and autoIndex are off', (t) => {
  t.plan(2);
  const server = http.createServer(
    ecstatic({
      root: `${__dirname}/public`,
      autoIndex: false,
      showDir: false,
    })
  );
  t.on('end', () => { server.close(); });
  server.listen(0, async () => {
    const port = server.address().port;
    const res = await client.get(`http://localhost:${port}/subdir`);
    t.equal(res.statusCode, 404);
    t.equal(res.body, 'File not found. :(');
  });
});
