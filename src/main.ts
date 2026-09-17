import { createApp } from './bootstrap';
import { env } from './config/env';
async function main() {
  const { app } = await createApp();
  await app.listen(env.PORT, '0.0.0.0');
  console.log(`API disponível em http://localhost:${env.PORT}/api/v1`);
}
main().catch(() => { console.error('API não iniciou. Confira o ambiente e o PostgreSQL.'); process.exitCode = 1; });
