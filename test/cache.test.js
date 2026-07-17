'use strict';

const test = require('tap').test;
const http = require('http');
const client = require('./lib/http-client');
const ecstatic = require('../lib/core');

test('custom cache option number', (t) => {
  let server = null;
  try {
    server = http.createServer(ecstatic({
      root: `${__dirname}/public/`,
      cache: 3600,
    }));
  } catch (e) {
    t.fail(e.message);
    t.end();
  }

  t.plan(2);

  server.listen(0, async () => {
    const port = server.address().port;
    const res = await client.get(`http://localhost:${port}/a.txt`);
    t.equal(res.statusCode, 200, 'a.txt should be found');
    t.equal(res.headers['cache-control'], 'max-age=3600');
    server.close(() => {
      t.end();
    });
  });
});

test('custom cache option string', (t) => {
  let server = null;
  try {
    server = http.createServer(ecstatic({
      root: `${__dirname}/public/`,
      cache: 'max-whatever=3600',
    }));
  } catch (e) {
    t.fail(e.message);
    t.end();
  }

  t.plan(2);

  server.listen(0, async () => {
    const port = server.address().port;
    const res = await client.get(`http://localhost:${port}/a.txt`);
    t.equal(res.statusCode, 200, 'a.txt should be found');
    t.equal(res.headers['cache-control'], 'max-whatever=3600');
    server.close(() => {
      t.end();
    });
  });
});

test('custom cache option function returning a number', (t) => {
  let i = 0;
  let server = null;
  try {
    server = http.createServer(ecstatic({
      root: `${__dirname}/public/`,
      cache() {
        i += 1;
        return i;
      },
    }));
  } catch (e) {
    t.fail(e.message);
    t.end();
  }

  t.plan(4);

  server.listen(0, async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/a.txt`;

    const res = await client.get(uri);
    t.equal(res.statusCode, 200, 'a.txt should be found');
    t.equal(res.headers['cache-control'], 'max-age=1');

    const res2 = await client.get(uri);
    t.equal(res2.statusCode, 200, 'a.txt should be found');
    t.equal(res2.headers['cache-control'], 'max-age=2');

    server.close(() => {
      t.end();
    });
  });
});

test('custom cache option function returning a string', (t) => {
  let i = 0;
  let server = null;
  try {
    server = http.createServer(ecstatic({
      root: `${__dirname}/public/`,
      cache() {
        i += 1;
        return `max-meh=${i}`;
      },
    }));
  } catch (e) {
    t.fail(e.message);
    t.end();
  }

  t.plan(4);

  server.listen(0, async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/a.txt`;

    const res = await client.get(uri);
    t.equal(res.statusCode, 200, 'a.txt should be found');
    t.equal(res.headers['cache-control'], 'max-meh=1');

    const res2 = await client.get(uri);
    t.equal(res2.statusCode, 200, 'a.txt should be found');
    t.equal(res2.headers['cache-control'], 'max-meh=2');

    server.close(() => {
      t.end();
    });
  });
});
