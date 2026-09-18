import { Inject, Injectable, UnauthorizedException, HttpException } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import type { Principal } from '../../common/http';

export const SESSION_COOKIE = 'biohub_session';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private attempts = new Map<string, { count: number; until: number }>();
  private dummyHash = hash(randomBytes(32).toString('hex'));
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async login(email: string, password: string, address: string) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    const key = address;
    const entry = this.attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 };
    if (entry.count >= 10) throw new HttpException('Muitas tentativas. Aguarde 15 minutos.', 429);
    entry.count++;
    this.attempts.set(key, entry);
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: { profile: true } });
    const valid = await verify(user?.password_hash ?? await this.dummyHash, password);
    if (!user || !valid) throw new UnauthorizedException('E-mail ou senha inválidos.');
    this.attempts.delete(key);
    const token = randomBytes(32).toString('base64url');
    await this.db.authSession.deleteMany({ where: { expires_at: { lt: new Date() } } });
    await this.db.authSession.create({ data: { user_id: user.id, token_hash: digest(token), expires_at: new Date(now + SESSION_MAX_AGE) } });
    return { token, user: { id: user.id, email: user.email ?? '', role: user.role, full_name: user.profile?.full_name ?? '' } };
  }

  async authenticate(token?: string): Promise<Principal> {
    if (!token || token.length > 100) throw new UnauthorizedException('Entre na sua conta.');
    const session = await this.db.authSession.findUnique({ where: { token_hash: digest(token) }, include: { user: { include: { profile: true } } } });
    if (!session || session.expires_at <= new Date()) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    return { id: session.user.id, email: session.user.email ?? '', role: session.user.role, full_name: session.user.profile?.full_name ?? '' };
  }

  async logout(token?: string) {
    if (token) await this.db.authSession.deleteMany({ where: { token_hash: digest(token) } });
  }
}
