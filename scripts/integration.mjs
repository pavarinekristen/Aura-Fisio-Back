import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const name = `biohub-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(20).toString('hex');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(result.stderr || 'Test command failed.');
  return result.stdout?.trim();
}
try {
  run('docker', ['run', '--detach', '--rm', '--name', name, '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=biohub_test', '-p', '127.0.0.1::5432', 'postgres:17-alpine']);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const probe = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not start.');
  const port = run('docker', ['port', name, '5432/tcp']).split(':').at(-1);
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:${password}@localhost:${port}/biohub_test`, ADMIN_EMAIL: 'admin@test.local', ADMIN_NAME: 'Test Admin', ADMIN_PASSWORD: 'Test-only-password-123', FRONTEND_ORIGIN: 'http://localhost:8080' };
  run(process.execPath, [root + 'node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env, stdio: 'inherit' });
  for (let i = 0; i < 2; i++) run(process.execPath, [root + 'node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'], { env, stdio: 'inherit' });
  run(process.execPath, [root + 'node_modules/vitest/vitest.mjs', 'run', 'test/integration.test.ts'], { env, stdio: 'inherit' });
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' }); }
