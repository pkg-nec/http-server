'use strict';

const test = require('tap').test;
const http = require('http');
const client = require('./lib/http-client');
const ecstatic = require('../lib/core');

function setup(opts) {
  return http.createServer(ecstatic(opts));
}

test('throws when custom contentType .types file does not exist', (t) => {
  t.plan(1);

  t.throws(
    setup.bind(null, {
      root: `${__dirname}/public/`,
      mimeTypes: 'this_file_does_not_exist.types',
    })
  );
});

test('custom contentType via .types file', (t) => {
  let server = null;
  try {
    server = setup({
      root: `${__dirname}/public`,
      'mime-types': `${__dirname}/public/custom_mime_type.types`,
    });
  } catch (e) {
    t.fail(e.message);
    t.end();
  }

  t.plan(2);

  server.listen(0, async () => {
    const port = server.address().port;
    const res = await client.get(`http://localhost:${port}/custom_mime_type.opml`);
    t.equal(res.statusCode, 200, 'custom_mime_type.opml should be found');
    t.equal(res.headers['content-type'], 'application/foo');

    server.close(() => {
      t.end();
    });
  });
});
