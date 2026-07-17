'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');

const root = `${__dirname}/public`;

test('serves brotli-encoded file when available', (t) => {
  t.plan(2);

  const server = http.createServer(ecstatic({
    root,
    brotli: true,
    autoIndex: true
  }));

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/brotli`;

    const res = await client.get(uri, {
      headers: {
        'accept-encoding': 'gzip, deflate, br'
      }
    });
    t.equal(res.statusCode, 200);
    t.equal(res.headers['content-encoding'], 'br');
  });

  t.once('end', () => {
    server.close();
  });
});

test('serves gzip-encoded file when brotli not available', (t) => {
  t.plan(2);

  const server = http.createServer(ecstatic({
    root,
    brotli: true,
    gzip: true,
    autoIndex: true
  }));

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/gzip`;

    const res = await client.get(uri, {
      headers: {
        'accept-encoding': 'gzip, deflate, br'
      }
    });
    t.equal(res.statusCode, 200);
    t.equal(res.headers['content-encoding'], 'gzip');
  });

  t.once('end', () => {
    server.close();
  });
});

test('serves gzip-encoded file when brotli not accepted', (t) => {
  t.plan(2);

  const server = http.createServer(ecstatic({
    root,
    brotli: true,
    gzip: true,
    autoIndex: true
  }));

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/brotli`;

    const res = await client.get(uri, {
      headers: {
        'accept-encoding': 'gzip, deflate'
      }
    });
    t.equal(res.statusCode, 200);
    t.equal(res.headers['content-encoding'], 'gzip');
  });

  t.once('end', () => {
    server.close();
  });
});

test('serves gzip-encoded file when brotli not enabled', (t) => {
  t.plan(2);

  const server = http.createServer(ecstatic({
    root,
    brotli: false,
    gzip: true,
    autoIndex: true
  }));

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/brotli`;

    const res = await client.get(uri, {
      headers: {
        'accept-encoding': 'gzip, deflate, br'
      }
    });
    t.equal(res.statusCode, 200);
    t.equal(res.headers['content-encoding'], 'gzip');
  });

  t.once('end', () => {
    server.close();
  });
});

test('serves unencoded file when compression not accepted', (t) => {
  t.plan(2);

  const server = http.createServer(ecstatic({
    root,
    brotli: true,
    gzip: true,
    autoIndex: true
  }));

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/brotli`;

    const res = await client.get(uri, {
      headers: {
        'accept-encoding': ''
      }
    });
    t.equal(res.statusCode, 200);
    t.equal(res.headers['content-encoding'], undefined);
  });

  t.once('end', () => {
    server.close();
  });
});

test('serves unencoded file when compression not enabled', (t) => {
  t.plan(2);

  const server = http.createServer(ecstatic({
    root,
    brotli: false,
    gzip: false,
    autoIndex: true
  }));

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/brotli`;
    const options = {
      uri: `http://localhost:${port}/brotli`,
      headers: {
        'accept-encoding': 'gzip, deflate, br'
      }
    };

    const res = await client.get(uri, {
      headers: {
        'accept-encoding': 'gzip, deflate, br'
      }
    });
    t.equal(res.statusCode, 200);
    t.equal(res.headers['content-encoding'], undefined);
  });

  t.once('end', () => {
    server.close();
  });
});
