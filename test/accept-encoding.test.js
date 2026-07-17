'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');

const root = `${__dirname}/public`;

test('properly handles whitespace in accept-encoding', (t) => {
  t.plan(2);

  const server = http.createServer(ecstatic({
    root,
    autoIndex: true,
    gzip: true
  }));

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/gzip`;

    const res = await client.get(uri, {
      headers: { 'accept-encoding': ' gzip, deflate' }
    });
    t.equal(res.statusCode, 200);
    t.equal(res.headers['content-encoding'], 'gzip');
  });

  t.once('end', () => {
    server.close();
  });
});

test('properly handles single accept-encoding entry', (t) => {
  t.plan(2);

  const server = http.createServer(ecstatic({
    root,
    autoIndex: true,
    gzip: true
  }));

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/gzip`;

    const res = await client.get(uri, {
      headers: { 'accept-encoding': 'gzip' }
    });
    t.equal(res.statusCode, 200);
    t.equal(res.headers['content-encoding'], 'gzip');
  });

  t.once('end', () => {
    server.close();
  });
});
