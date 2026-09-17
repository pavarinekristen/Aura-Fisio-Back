import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { z } from 'zod';

const db = new PrismaClient();
async function seed() {
  const config = z.object({
    ADMIN_EMAIL: z.string().email().transform(v => v.toLowerCase().trim()),
    ADMIN_NAME: z.string().min(1),
    ADMIN_PASSWORD: z.string().min(12),
  }).parse(process.env);
  const existing = await db.user.findUnique({ where: { email: config.ADMIN_EMAIL } });
  if (existing) {
    if (existing.role !== 'admin') throw new Error('The configured email already belongs to a non-admin account.');
    console.log('Administrador já existe; senha e dados preservados.');
    return;
  }
  await db.user.create({ data: {
    email: config.ADMIN_EMAIL, password_hash: await hash(config.ADMIN_PASSWORD), role: 'admin',
    profile: { create: { full_name: config.ADMIN_NAME, intake_completed: true } },
  } });
  console.log(`Administrador criado: ${config.ADMIN_EMAIL}. A senha está no arquivo local backend/.env.`);
}
seed().catch(() => { console.error('Seed falhou. Confira as variáveis ADMIN_* e a conexão do banco.'); process.exitCode = 1; }).finally(() => db.$disconnect());
