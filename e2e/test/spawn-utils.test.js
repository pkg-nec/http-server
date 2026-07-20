const tap = require('tap');
const { spawnServer, killServer } = require('./spawn-utils');

tap.test('should spawn and kill http-server', async (t) => {
  const { port, child } = await spawnServer(['-p', '0'], __dirname);
  t.ok(port, 'should parse dynamic port');
  t.ok(child, 'should return child process');

  const res = await fetch(`http://localhost:${port}`);
  t.equal(res.status, 200, 'server should respond');

  await killServer(child);
  t.end();
});
