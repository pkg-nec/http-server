'use strict';

const test = require('tap').test;
const ecstatic = require('../lib/core');
const http = require('http');
const client = require('./lib/http-client');
const path = require('path');

const root = `${__dirname}/public`;
const baseDir = 'base';

test('directory listing with query string specified', (t) => {
  const server = http.createServer(
    ecstatic({
      root,
      baseDir,
      showDir: true,
      autoIndex: false,
    })
  );

  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}${path.join('/', baseDir, '?a=1&b=2')}`;
    const res = await client.get(uri);
    t.match(res.body, /href="\.\/subdir\/\?a=1&#x26;b=2"/, 'We found the encoded href');
    t.notMatch(res.body, /a=1&b=2/, 'We didn\'t find the unencoded query string value');

    server.close();

    t.end();
  });
});
