import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface Candidate { user_id: string; full_name: string; score: number }
export interface MatchResult {
  status: 'matched' | 'ambiguous' | 'not_found';
  patient_id: string | null;
  candidates: Candidate[];
}

export interface MatchInput {
  patient_id?: string | null;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}

/** Aceita o vencedor apenas quando ele se destaca do segundo colocado. */
const MIN_SCORE = 0.6;
const MIN_LEAD = 0.15;

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Resolve qual paciente o profissional quis dizer, consultando o banco em vez de
 * despejar a lista inteira no prompt — que era o que estourava o contexto.
 */
@Injectable()
export class PatientMatcher {
  private readonly logger = new Logger(PatientMatcher.name);
  /** Vira true na primeira falha de pg_trgm, para não repetir a consulta cara. */
  private trigramUnavailable = false;

  constructor(@Inject(PrismaService) private db: PrismaService) {}

  async match(input: MatchInput): Promise<MatchResult> {
    const none: MatchResult = { status: 'not_found', patient_id: null, candidates: [] };

    if (input.patient_id) {
      const user = await this.db.user.findFirst({ where: { id: input.patient_id, role: 'patient' }, select: { id: true } });
      if (user) return { status: 'matched', patient_id: user.id, candidates: [] };
    }
    // Identificadores exatos vencem qualquer similaridade de nome.
    if (input.cpf) {
      const profile = await this.db.profile.findUnique({ where: { cpf: input.cpf }, select: { user_id: true } });
      if (profile) return { status: 'matched', patient_id: profile.user_id, candidates: [] };
    }
    if (input.email) {
      const user = await this.db.user.findFirst({ where: { email: input.email.toLowerCase(), role: 'patient' }, select: { id: true } });
      if (user) return { status: 'matched', patient_id: user.id, candidates: [] };
    }
    if (input.phone) {
      const profiles = await this.db.profile.findMany({ where: { phone: input.phone }, select: { user_id: true }, take: 2 });
      if (profiles.length === 1) return { status: 'matched', patient_id: profiles[0].user_id, candidates: [] };
    }
    if (!input.name?.trim()) return none;

    const candidates = await this.byName(input.name.trim());
    if (!candidates.length) return none;
    const [top, second] = candidates;
    const clearWinner = top.score >= MIN_SCORE && (!second || top.score - second.score >= MIN_LEAD);
    return clearWinner
      ? { status: 'matched', patient_id: top.user_id, candidates }
      : { status: 'ambiguous', patient_id: null, candidates };
  }

  private async byName(name: string): Promise<Candidate[]> {
    if (!this.trigramUnavailable) {
      try {
        return await this.db.$queryRaw<Candidate[]>`
          SELECT p.user_id, p.full_name,
                 similarity(unaccent(lower(p.full_name)), unaccent(lower(${name}))) AS score
          FROM profiles p
          JOIN users u ON u.id = p.user_id
          WHERE u.role = 'patient'
            AND unaccent(lower(p.full_name)) % unaccent(lower(${name}))
          ORDER BY score DESC, p.full_name ASC
          LIMIT 5`;
      } catch (error) {
        // pg_trgm/unaccent exigem superusuário; em Postgres gerenciado podem faltar.
        this.trigramUnavailable = true;
        this.logger.warn(`Busca por similaridade indisponível (${error instanceof Error ? error.name : 'desconhecido'}). Usando comparação em memória.`);
      }
    }
    return this.byNameFallback(name);
  }

  /** Plano B sem extensões: filtra por token no banco e pontua em memória. */
  private async byNameFallback(name: string): Promise<Candidate[]> {
    const tokens = fold(name).split(/\s+/).filter(t => t.length >= 3);
    if (!tokens.length) return [];
    const rows = await this.db.profile.findMany({
      where: { user: { role: 'patient' }, OR: tokens.map(token => ({ full_name: { contains: token, mode: 'insensitive' as const } })) },
      select: { user_id: true, full_name: true },
      take: 200,
    });
    return rows
      .map(row => ({ user_id: row.user_id, full_name: row.full_name, score: similarity(fold(row.full_name), fold(name)) }))
      .filter(row => row.score > 0.3)
      .sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name))
      .slice(0, 5);
  }
}

/** Dice sobre bigramas: mesma escala aproximada do `similarity()` do pg_trgm. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const bigrams = (text: string) => {
    const set = new Set<string>();
    for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
    return set;
  };
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared++;
  return (2 * shared) / (left.size + right.size);
}
