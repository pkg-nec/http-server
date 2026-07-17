'use strict';

const test = require('tap').test;
const http = require('http');
const client = require('./lib/http-client');
const ecstatic = require('../lib/core');

test('custom contentType', (t) => {
  let server = null;
  try {
    server = http.createServer(ecstatic({
      root: `${__dirname}/public/`,
      mimetype: {
        'application/jon': ['opml'],
      },
    }));
  } catch (e) {
    t.fail(e.message);
    t.end();
  }

  t.plan(2);

  server.listen(0, async () => {
    const port = server.address().port;
    const res = await client.get(`http://localhost:${port}/custom_mime_type.opml`);
    t.equal(res.statusCode, 200, 'custom_mime_type.opml should be found');
    t.equal(res.headers['content-type'], 'application/jon');

    server.close(() => {
      t.end();
    });
  });
});
