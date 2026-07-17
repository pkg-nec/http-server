const client = require('./lib/http-client');

module.exports = (t, server, path, check) => {
  server.listen(async () => {
    const port = server.address().port;
    const uri = `http://localhost:${port}/${path}`;

    const res = await client.get(uri);
    t.equal(res.statusCode, 200);
    check(t, res.headers);
  });

  t.once('end', () => {
    server.close();
  });
}
