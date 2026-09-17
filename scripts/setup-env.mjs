import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const rootFile = path.join(root, '.env');
let rootEnv = existsSync(rootFile) ? readFileSync(rootFile, 'utf8') : '';
let password = rootEnv.match(/^POSTGRES_PASSWORD=(.+)$/m)?.[1]?.trim();
if (!password) {
  password = randomBytes(24).toString('hex');
  // The previous frontend credentials are no longer used by this workspace.
  rootEnv = `POSTGRES_PASSWORD=${password}\nPOSTGRES_PORT=55432\n`;
  writeFileSync(rootFile, rootEnv, { mode: 0o600 });
}
const backendFile = path.join(root, 'backend/.env');
if (!existsSync(backendFile)) {
  const template = readFileSync(path.join(root, 'backend/.env.example'), 'utf8')
    .replaceAll('configure-a-local-password', password)
    .replace('configure-at-least-12-characters', randomBytes(18).toString('base64url'));
  writeFileSync(backendFile, template, { mode: 0o600 });
}
const frontendFile = path.join(root, 'frontend/.env');
if (!existsSync(frontendFile)) writeFileSync(frontendFile, 'VITE_API_BASE_URL=/api/v1\n');
console.log('Ambiente local preparado. Consulte ADMIN_EMAIL e ADMIN_PASSWORD em backend/.env. Nenhuma senha existente foi alterada.');
