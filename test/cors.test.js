'use strict';

const test = require('tap').test;
const server = require('../lib/core');
const http = require('http');
const path = require('path');
const client = require('./lib/http-client');

const root = path.join(__dirname, 'public');

test('cors defaults to false', (t) => {
  t.plan(3);

  const httpServer = http.createServer(
    server({
      root,
      autoIndex: true,
      defaultExt: 'html',
    })
  );

  httpServer.listen(async () => {
    const port = httpServer.address().port;
    const uri = `http://localhost:${port}/subdir/index.html`;

    const res = await client.get(uri);
    t.equal(res.statusCode, 200);
    t.type(res.headers['access-control-allow-origin'], 'undefined');
    t.type(res.headers['access-control-allow-headers'], 'undefined');
  });

  t.once('end', () => {
    httpServer.close();
  });
});

test('cors set to false', (t) => {
  t.plan(3);

  const httpServer = http.createServer(
    server({
      root,
      cors: false,
      autoIndex: true,
      defaultExt: 'html',
    })
  );

  httpServer.listen(async () => {
    const port = httpServer.address().port;
    const uri = `http://localhost:${port}/subdir/index.html`;

    const res = await client.get(uri);
    t.equal(res.statusCode, 200);
    t.type(res.headers['access-control-allow-origin'], 'undefined');
    t.type(res.headers['access-control-allow-headers'], 'undefined');
  });

  t.once('end', () => {
    httpServer.close();
  });
});

test('cors set to true', (t) => {
  t.plan(3);

  const httpServer = http.createServer(
    server({
      root,
      cors: true,
      autoIndex: true,
      defaultExt: 'html',
    })
  );

  httpServer.listen(async () => {
    const port = httpServer.address().port;
    const uri = `http://localhost:${port}/subdir/index.html`;

    const res = await client.get(uri);
    t.equal(res.statusCode, 200);
    t.equal(res.headers['access-control-allow-origin'], '*');
    t.equal(res.headers['access-control-allow-headers'], 'Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since');
  });

  t.once('end', () => {
    httpServer.close();
  });
});

test('CORS set to true', (t) => {
  t.plan(3);

  const httpServer = http.createServer(
    server({
      root,
      CORS: true,
      autoIndex: true,
      defaultExt: 'html',
    })
  );

  httpServer.listen(async () => {
    const port = httpServer.address().port;
    const uri = `http://localhost:${port}/subdir/index.html`;

    const res = await client.get(uri);
    t.equal(res.statusCode, 200);
    t.equal(res.headers['access-control-allow-origin'], '*');
    t.equal(res.headers['access-control-allow-headers'], 'Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since');
  });

  t.once('end', () => {
    httpServer.close();
  });
});
