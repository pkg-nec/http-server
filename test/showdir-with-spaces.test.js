'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');
const path = require('path');

const root = `${__dirname}/public`;
const baseDir = 'base';

test('directory listing when directory name contains spaces', (t) => {
  require('portfinder').getPort((err, port) => {
    const uri = `http://localhost:${port}${path.join('/', baseDir, 'subdir_with%20space')}`;

    const server = http.createServer(
      ecstatic({
        root,
        baseDir,
        showDir: true,
        autoIndex: false,
      })
    );

    server.listen(port, async () => {
      const res = await client.get(uri);
      t.ok(/href="\.\/index.html"/.test(res.body), 'We found the right href');

      server.close();

      t.end();
    });
  });
});
