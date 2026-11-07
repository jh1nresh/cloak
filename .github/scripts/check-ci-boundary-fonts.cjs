const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns').promises;
assert.equal(process.getuid(), 1000);
for (const path of ['/source', '/var/run/docker.sock', '/work/.git']) {
  assert.equal(fs.existsSync(path), false, `Private host/history mount forbidden: ${path}`);
}
for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'NODE_AUTH_TOKEN', 'NPM_TOKEN']) {
  assert.equal(process.env[name], undefined, 'Credential environment forbidden');
}
function blocked(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => { socket.destroy(); resolve(); }, 1200);
    socket.once('connect', () => {
      clearTimeout(timer); socket.destroy(); reject(new Error(`Forbidden connection reachable: ${host}:${port}`));
    });
    socket.once('error', () => { clearTimeout(timer); socket.destroy(); resolve(); });
  });
}
function fontTls(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Font TLS timeout')); }, 10000);
    socket.once('secureConnect', () => { clearTimeout(timer); socket.end(); resolve(); });
    socket.once('error', error => { clearTimeout(timer); socket.destroy(); reject(error); });
  });
}
(async () => {
  const gateway = process.env.CI_GATEWAY;
  assert.equal(gateway, '172.31.244.1');
  await Promise.all([blocked('1.1.1.1', 443), blocked('10.0.0.1', 443),
    blocked('169.254.169.254', 80), blocked(gateway, 80)]);
  const resolver = new dns.Resolver({ timeout: 1500, tries: 1 });
  let dnsFailed = false;
  try { await resolver.resolve4(`ci-${Date.now()}-${process.pid}.example.com`); }
  catch (error) {
    assert.ok(['ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL'].includes(error.code), `Unexpected external DNS answer: ${error.code}`);
    dnsFailed = true;
  }
  assert.equal(dnsFailed, true, 'External DNS unexpectedly resolved');
  await Promise.all(['fonts.googleapis.com', 'fonts.gstatic.com'].map(fontTls));
  console.log('Bounded font connections verified; arbitrary/public/private/metadata/host probes blocked; no host history/socket/credentials');
})().catch(error => { console.error(error); process.exitCode = 1; });
