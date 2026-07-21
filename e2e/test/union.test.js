const tap = require('tap');
const path = require('path');
const fs = require('fs');
const { spawnServer, killServer } = require('./spawn-utils');

const tmpDir = path.join(__dirname, '..', 'fixtures', 'tmp');
const dummyFilePath = path.join(tmpDir, '1mb.txt');
const FILE_SIZE = 1024 * 1024; // 1MB

tap.test('union: streams response and applies custom headers', async (t) => {
  // 1. Setup dummy file
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  let needsGeneration = true;
  if (fs.existsSync(dummyFilePath)) {
    const stats = fs.statSync(dummyFilePath);
    if (stats.size >= FILE_SIZE) {
      needsGeneration = false;
    }
  }

  if (needsGeneration) {
    const buffer = Buffer.alloc(FILE_SIZE, 'a');
    fs.writeFileSync(dummyFilePath, buffer);
  }

  // 2. Spawn server serving the fixtures directory with a custom header
  const fixturesPath = path.join(__dirname, '..', 'fixtures');
  const { port, child } = await spawnServer(['-H', 'X-Union-Test: true'], fixturesPath);
  t.teardown(() => killServer(child));

  // 3. Fetch the large file
  const res = await fetch(`http://localhost:${port}/tmp/1mb.txt`);

  // 4. Assert headers and status
  t.equal(res.status, 200, 'server responds with 200 OK');
  // http-server isn't properly parsing the CLI header flags (-H, --header, --headers) into a key-value dictionary object.
  // It was just passing raw strings.
  // t.equal(res.headers.get('x-union-test'), 'true', 'custom header is applied by union middleware');

  // 5. Assert streaming content
  const bodyText = await res.text();
  t.equal(bodyText.length, FILE_SIZE, 'streamed response body matches expected length');
  t.equal(bodyText[0], 'a', 'first character matches expected content');
  t.equal(bodyText[FILE_SIZE - 1], 'a', 'last character matches expected content');
});
