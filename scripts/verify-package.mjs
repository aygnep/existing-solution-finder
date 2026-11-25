// Verify only a local tarball. Never publish or start a persistent service.
import { spawnSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'fixseek-package-'));
let gateway;
const env = { ...process.env, FIXSEEK_ENV_FILE: join(temp, 'no-env'),
  GITHUB_TOKEN: '', WEB_SEARCH_API_KEY: '', TYPESAFE_API_KEY: '' };
function run(command, args, cwd = temp) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, `${command} failed: ${result.stderr}`);
  return result.stdout;
}
try {
  const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temp], root))[0];
  const files = packed.files.map((file) => file.path);
  for (const file of ['dist/cli/index.js', 'dist/web/gateway.js', 'web/dist/index.html',
    '.env.example', 'skills/fixseek/SKILL.md', 'docs/LOCAL_INSTALL.md', 'LICENSE']) {
    assert.ok(files.includes(file), `Missing package file: ${file}`);
  }
  assert.ok(!files.some((file) => /(?:^|\/)\.env$|\.pem$|\.key$|^benchmarks\//.test(file)));
  run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', join(temp, packed.filename)]);
  const installed = join(temp, 'node_modules/fixseek');
  await access(join(temp, 'node_modules/.bin/fixseek'));
  await access(join(temp, 'node_modules/.bin/fixseek-web'));
  assert.equal(JSON.parse(run(process.execPath, [join(installed, 'dist/cli/index.js'), 'doctor'])).ok, true);
  const secret = 'ghp_fakeCredential123456789';
  const cli = run(process.execPath, [join(installed, 'dist/cli/index.js'), '--mock', '--json', `reasoning_content error Claude Code token=${secret}`]);
  assert.ok(!cli.includes(secret));
  assert.ok(JSON.parse(cli).result.candidates.length > 0);
  let occupied = false;
  try { await fetch('http://127.0.0.1:4174/health', { signal: AbortSignal.timeout(500) }); occupied = true; } catch { /* Port is free. */ }
  assert.ok(!occupied, 'Port 4174 must be free for isolated package verification');
  gateway = spawn(process.execPath, [join(installed, 'dist/web/gateway.js')], { cwd: temp, env, stdio: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (gateway.exitCode !== null) throw new Error('Packaged gateway exited before startup (port 4174 must be free).');
    try {
      const health = await fetch('http://127.0.0.1:4174/health');
      ready = health.ok;
      if (ready) break;
    } catch { /* Wait for startup. */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(ready, 'Packaged gateway did not become ready');
  const page = await fetch('http://127.0.0.1:4174/');
  assert.equal(page.status, 200);
  const html = await page.text();
  const asset = html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(asset, 'No compiled UI script');
  assert.equal((await fetch(new URL(asset, 'http://127.0.0.1:4174'))).status, 200);
  const response = await fetch('http://127.0.0.1:4174/api/discover', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      problem: `reasoning_content error Claude Code token=${secret}`, stack: [], constraints: [],
      providers: ['github'], mode: 'mock', maxResults: 5,
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(!body.includes(secret));
  assert.ok(JSON.parse(body).candidates.length > 0);
  const template = await readFile(join(installed, '.env.example'), 'utf8');
  assert.ok(template.includes('GITHUB_TOKEN=\n'));
  console.log(JSON.stringify({ ok: true, node: process.versions.node,
    files: files.length, productionInstall: true, cli: true, webAssets: true,
    mockApi: true, redaction: true, skill: true }));
} finally {
  if (gateway && gateway.exitCode === null) {
    const stopped = new Promise((done) => gateway.once('exit', done));
    gateway.kill('SIGTERM');
    const timeout = setTimeout(() => gateway.kill('SIGKILL'), 3000);
    await stopped;
    clearTimeout(timeout);
  }
  await rm(temp, { recursive: true, force: true });
}
