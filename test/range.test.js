'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');
const eol = require('eol');

test('range', (t) => {
  t.plan(3);
  const server = http.createServer(ecstatic(`${__dirname}/public/subdir`));
  t.on('end', () => { server.close(); });

  server.listen(0, async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/e.html`;

    const res = await client.get(uri, {
      headers: {
        range: '3-5'
      }
    })
    t.equal(res.statusCode, 206, 'partial content status code');
    t.equal(res.body, 'e!!');
    t.equal(parseInt(res.headers['content-length'], 10), res.body.length);
  });
});

test('range past the end', (t) => {
  t.plan(3);
  const server = http.createServer(ecstatic(`${__dirname}/public/subdir`));
  t.on('end', () => { server.close(); });

  server.listen(0, async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/e.html`;

    const res = await client.get(uri, {
      headers: {
        range: '3-500'
      }
    })
    t.equal(res.statusCode, 206, 'partial content status code');
    t.equal(eol.lf(res.body), 'e!!</b>\n');
    t.equal(parseInt(res.headers['content-length'], 10), res.body.length);
  });
});

test('NaN range', (t) => {
  t.plan(2);
  const server = http.createServer(ecstatic(`${__dirname}/public/subdir`));
  t.on('end', () => { server.close(); });

  server.listen(0, async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/e.html`;

    const res = await client.get(uri, {
      headers: {
        range: 'abc-def'
      }
    })
    t.equal(res.statusCode, 416, 'range error status code');
    t.equal(res.body, 'Requested range not satisfiable');
  });
});

test('flipped range', (t) => {
  t.plan(2);
  const server = http.createServer(ecstatic(`${__dirname}/public/subdir`));
  t.on('end', () => { server.close(); });

  server.listen(0, async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/e.html`;

    const res = await client.get(uri, {
      headers: {
        range: '333-222'
      }
    })
    t.equal(res.statusCode, 416, 'range error status code');
    t.equal(res.body, 'Requested range not satisfiable');
  });
});

test('partial range', (t) => {
  // 1 test is platform depedent "res.headers['content-range']"
  t.plan(4);
  const server = http.createServer(ecstatic(`${__dirname}/public/subdir`));
  t.on('end', () => { server.close(); });

  server.listen(0, async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/e.html`;

    const res = await client.get(uri, {
      headers: {
        range: '3-'
      }
    })
    t.equal(res.statusCode, 206, 'partial content status code');
    t.equal(eol.lf(res.body), 'e!!</b>\n');
    t.equal(parseInt(res.headers['content-length'], 10), res.body.length);
    if (eol.lf(res.body) !== res.body) { // on Windows, depending on Git settings
      t.equal(res.headers['content-range'], 'bytes 3-11/12');
    } else {
      t.equal(res.headers['content-range'], 'bytes 3-10/11');
    }
  });
});

test('include last-modified, etag and cache-control headers', (t) => {
  t.plan(3);
  const server = http.createServer(ecstatic(`${__dirname}/public/subdir`));
  t.on('end', () => { server.close(); });

  server.listen(0, async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/e.html`;

    const res = await client.get(uri, {
      headers: {
        range: '3-5'
      }
    })
    t.ok(res.headers['cache-control']);
    t.ok(res.headers['last-modified']);
    t.ok(res.headers.etag);
  });
});
