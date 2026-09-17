import { writeFile } from 'node:fs/promises';
import { createApp } from '../src/bootstrap';
async function main() {
  const { app, document } = await createApp();
  await writeFile('openapi.json', JSON.stringify(document!, null, 2));
  await app.close();
}
main().catch(error => { console.error('Falha ao gerar OpenAPI:', error.message); process.exitCode = 1; });
