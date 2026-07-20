const tap = require('tap');
const path = require('path');
const { exec } = require('child_process');
const { spawnServer, killServer, getFreePort } = require('./spawn-utils');

tap.test('minimist: parses CLI flags correctly', async (t) => {
  const { port, child } = await spawnServer(['--cors', '-c-1'], __dirname);
  t.teardown(() => killServer(child));

  const res = await fetch(`http://localhost:${port}`);
  t.equal(res.status, 200, 'server responds successfully');
  t.equal(res.headers.get('access-control-allow-origin'), '*', 'CORS flag is respected');
  t.equal(res.headers.get('cache-control'), 'no-cache, no-store, must-revalidate', 'Cache flag is respected');
});

tap.test('minimist: parses --no-dotfiles correctly', async (t) => {
  const fixturesPath = path.join(__dirname, '..', 'fixtures');
  // Pass -d to ensure directory listings are enabled, plus --no-dotfiles
  const { port, child } = await spawnServer(['-d', '--no-dotfiles'], fixturesPath);
  t.teardown(() => killServer(child));

  // 1. Direct fetch should STILL return 200 (this is the actual behavior of http-server)
  const resFile = await fetch(`http://localhost:${port}/.hidden`);
  t.equal(resFile.status, 200, 'should return 200 for direct fetches of dotfiles even with --no-dotfiles');

  // 2. Directory listing should HIDE the dotfile
  const resDir = await fetch(`http://localhost:${port}/`);
  const html = await resDir.text();
  t.notMatch(html, /\.hidden/, 'directory listing should hide dotfiles when --no-dotfiles is passed');
});

tap.test('minimist: parses --tls alias correctly', async (t) => {
  // We expect this to immediately fail looking for cert.pem, proving it translated to SSL logic.
  // We don't use spawnServer because spawnServer waits for "Available on:" which will never happen.
  const port = await getFreePort();
  const binPath = require.resolve('@pkg-nec/http-server/bin/http-server');
  
  await new Promise((resolve) => {
    exec(`node ${binPath} -p ${port} --tls`, { cwd: __dirname }, (error, stdout, stderr) => {
      try {
        t.ok(error, 'process should exit with error');
        t.match(stdout, /Could not find certificate cert.pem/, 'should throw certificate missing error');
      } finally {
        resolve();
      }
    });
  });
});
