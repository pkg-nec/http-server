'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');
const path = require('path');

const root = `${__dirname}/public`;
const baseDir = 'base';

require('fs').mkdirSync(`${root}/emptyDir`, {recursive: true});

const cases = require('./fixtures/common-cases-error');

test('core', (t) => {
  const filenames = Object.keys(cases);

  const server = http.createServer(
    ecstatic({
      root,
      gzip: true,
      baseDir,
      autoIndex: true,
      showDir: true,
      handleError: false,
    })
  );

  server.listen(async () => {
    const port = server.address().port;
    const promises = filenames.map(async (file) => {
      const uri = `http://localhost:${port}${path.join('/', baseDir, file)}`;
      const headers = cases[file].headers || {};

      const res = await client.get(uri, {
        redirect: 'manual',
        headers: headers,
      });

      const r = cases[file];
      t.equal(res.statusCode, r.code, `status code for \`${file}\``);

      if (r.type !== undefined) {
        t.equal(
            res.headers['content-type'].split(';')[0], r.type,
            `content-type for \`${file}\``
        );
      }

      if (r.body !== undefined) {
        t.equal(res.body, r.body, `body for \`${file}\``);
      }

      if (r.location !== undefined) {
        t.equal(res.headers.location, path.join('/', baseDir, r.location), `location for \`${file}\``);
      }
    });

    await Promise.all(promises);

    server.close();
    t.end();
  });
});
