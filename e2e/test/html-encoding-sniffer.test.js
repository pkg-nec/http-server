const tap = require('tap');
const path = require('path');
const { spawnServer, killServer } = require('./spawn-utils');

tap.test('html-encoding-sniffer: detects character set correctly', async (t) => {
  const fixturesPath = path.join(__dirname, '..', 'fixtures');
  const { port, child } = await spawnServer([], fixturesPath);
  t.teardown(() => killServer(child));

  const utf8Res = await fetch(`http://localhost:${port}/utf8.html`);
  t.equal(utf8Res.headers.get('content-type'), 'text/html; charset=utf-8', 'should detect utf-8');

  // Stable cross-version test: iso-8859-6 does NOT alias to windows-1252 in the WHATWG Encoding Standard.
  const arabicRes = await fetch(`http://localhost:${port}/arabic.html`);
  t.equal(arabicRes.headers.get('content-type'), 'text/html; charset=iso-8859-6', 'should detect iso-8859-6 without aliasing');

  // BEHAVIOR CHANGE NOTIFICATION:
  // In @pkg-nec/http-server < 14.2.0, the sniffer returned 'iso-8859-1'.
  // In @pkg-nec/http-server >= 14.2.0, the underlying sniffer was upgraded to conform to the WHATWG Encoding Standard.
  // The WHATWG standard explicitly dictates that 'iso-8859-1' MUST be treated as an alias for 'windows-1252'.
  // Thus, we expect 'windows-1252' (or fallback 'iso-8859-1' for older versions).
  const isoRes = await fetch(`http://localhost:${port}/iso.html`);
  const contentType = isoRes.headers.get('content-type');
  t.ok(
    contentType === 'text/html; charset=windows-1252' || contentType === 'text/html; charset=iso-8859-1',
    `should detect iso-8859-1 (aliased to windows-1252 due to WHATWG spec on v14.2.0+). Actual: ${contentType}`
  );
});

tap.test('html-encoding-sniffer: defaults to UTF-8 for non-HTML text files', async (t) => {
  const fixturesPath = path.join(__dirname, '..', 'fixtures');
  const { port, child } = await spawnServer([], fixturesPath);
  t.teardown(() => killServer(child));

  const jsRes = await fetch(`http://localhost:${port}/script.js`);
  t.match(jsRes.headers.get('content-type'), /charset=UTF-8/i, 'JS files should default to UTF-8');

  const jsonRes = await fetch(`http://localhost:${port}/data.json`);
  t.match(jsonRes.headers.get('content-type'), /charset=UTF-8/i, 'JSON files should default to UTF-8');
});
