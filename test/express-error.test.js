'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const express = require('express');
const client = require('./lib/http-client');
const path = require('path');

const root = `${__dirname}/public`;
const baseDir = 'base';

require('fs').mkdirSync(`${root}/emptyDir`, {recursive: true});

const cases = require('./fixtures/common-cases-error');

test('express', (t) => {
  require('portfinder').getPort((err, port) => {
    const filenames = Object.keys(cases);
    const app = express();

    app.use(ecstatic({
      root,
      gzip: true,
      baseDir,
      autoIndex: true,
      showDir: true,
      cache: 'no-cache',
      handleError: false,
    }));

    const server = http.createServer(app);

    server.listen(port, async () => {
      try {
        for (const file of filenames) {
          const uri = `http://localhost:${port}${path.join('/', baseDir, file)}`;
          const headers = cases[file].headers || {};

          const res = await client.get(uri, {
            redirect: 'manual',
            headers: headers
          })

          const r = cases[file];
          t.equal(res.statusCode, r.code, `status code for \`${file}\``);

          if (r.code === 200) {
            t.equal(res.headers['cache-control'], 'no-cache', `cache control for \`${file}\``);
          }

          if (r.type !== undefined) {
            t.equal(
              res.headers['content-type'].split(';')[0], r.type,
              `content-type for \`${file}\``
            );
          }

          if (r.body !== undefined) {
            t.equal(res.body, r.body, `body for \`${file}\``);
          }
        }
      } catch (err) {
        t.fail(err.toString());
      } finally {
        server.close();
        t.end();
      }
    });
  });
});
