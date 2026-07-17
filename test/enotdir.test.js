'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');

test('should handle ENOTDIR as 404', (t) => {
  t.plan(2);
  const server = http.createServer(ecstatic(`${__dirname}/public/subdir`));
  t.on('end', () => { server.close(); });
  server.listen(0, async () => {
    const port = server.address().port;
    const res = await client.get(`http://localhost:${port}/index.html/hello`)
    t.equal(res.statusCode, 404);
    t.equal(res.body, 'File not found. :(');
  });
});
