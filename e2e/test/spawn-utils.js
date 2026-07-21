const { spawn } = require('node:child_process');
const net = require('node:net');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    srv.on('error', reject);
  });
}

async function spawnServer(args = [], cwd = process.cwd()) {
  let finalArgs = [...args];
  if (finalArgs.includes('--no-port-override')) {
    finalArgs = finalArgs.filter(a => a !== '--no-port-override');
  } else {
    const pIndex = finalArgs.indexOf('-p');
    if (pIndex === -1) {
      const port = await getFreePort();
      finalArgs.push('-p', port.toString());
    } else if (finalArgs[pIndex + 1] === '0') {
      const port = await getFreePort();
      finalArgs[pIndex + 1] = port.toString();
    }
  }

  return new Promise((resolve, reject) => {

    const binPath = require.resolve('@pkg-nec/http-server/bin/http-server');
    const child = spawn(process.execPath, [binPath, ...finalArgs], {
      cwd,
      detached: process.platform !== 'win32',
      env: {...process.env, FORCE_COLOR: '0', NODE_OPTIONS: '--no-warnings'}
    });

    let started = false;
    let outputBuffer = '';
    
    child.stderr.on('data', (data) => {
      console.error(`[spawnServer stderr]: ${data.toString()}`);
    });

    child.stdout.on('data', (data) => {
      if (started) {
        return;
      }

      outputBuffer += data.toString();
      // Match "Available on:  http://127.0.0.1:PORT" or "http://[::1]:PORT"
      const match = /Available on:[\s\S]+?http:\/\/(?:\[.*?\]|[^:]+):(\d+)/.exec(outputBuffer);
      if (match && !started) {
        started = true;
        resolve({ port: match[1], child });
      }
    });

    child.on('exit', (code, signal) => {
      if (!started) {
        console.error(`[spawnServer exit] Process exited prematurely with code ${code} signal ${signal}`);
        reject(new Error(`Server exited prematurely with code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error(`[spawnServer error] ${err.message}`);
      if (!started) reject(err);
    });
  });
}

function killServer(child) {
  return new Promise((resolve) => {
    child.on('exit', resolve);
    child.on('close', resolve);

    try {
      process.kill(-child.pid, 'SIGINT');
    } catch (e) {
      child.kill('SIGINT');
    }
  });
}

module.exports = { spawnServer, killServer, getFreePort };
