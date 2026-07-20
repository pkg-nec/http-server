const tap = require('tap');
const { spawnServer, killServer } = require('./spawn-utils');
const http = require('http');

tap.test('portfinder: falls back to next available port', async (t) => {
  // Block the default portfinder basePort (8080)
  const blocker = http.createServer((req, res) => res.end('blocked'));
  t.teardown(() => {
    if (blocker.listening) blocker.close();
  });
  await new Promise((resolve, reject) => {
    blocker.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve();
      else reject(err);
    });
    blocker.listen(8080, resolve);
  });

  // Spawn http-server without a port arg, which should trigger portfinder from 8080
  const { port, child } = await spawnServer(['--no-port-override'], __dirname);
  t.teardown(() => killServer(child));

  // It should NOT be 8080 since it's blocked, it should fall back (likely 8081)
  t.not(port, '8080', 'should fall back from blocked port 8080');
  t.ok(parseInt(port, 10) > 8080, 'should find a higher open port');

  t.end();
});
