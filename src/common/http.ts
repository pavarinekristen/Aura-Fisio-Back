import { ArgumentsHost, Catch, ExceptionFilter, HttpException, SetMetadata } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

/** `email` é vazio quando o paciente ainda é só prontuário, sem acesso ao app. */
export interface Principal { id: string; email: string; role: Role; full_name: string }
export interface AuthRequest extends Request { user: Principal }
export const Public = () => SetMetadata('public', true);
export const isStaff = (user: Principal) => user.role === 'admin' || user.role === 'professional';

/**
 * CHECK e EXCLUDE do banco não têm código próprio no Prisma: chegam como P2004/P2010
 * ou como erro desconhecido, e sem este mapa virariam 500. A chave é o nome da
 * constraint, que o Postgres inclui na mensagem.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  calendar_date_order: 'O fim do evento deve ser posterior ao início.',
  calendar_no_overlap: 'Já existe um atendimento nesse horário.',
  profile_cpf_format: 'CPF inválido: informe os 11 dígitos.',
  user_password_requires_email: 'Não é possível definir senha sem e-mail.',
  staff_requires_credentials: 'Profissionais e administradores precisam de e-mail e senha.',
  intake_pain_range: 'A intensidade da dor deve estar entre 0 e 10.',
  session_pain_range: 'O nível de dor deve estar entre 0 e 10.',
  checkin_pain_range: 'A dor informada deve estar entre 0 e 10.',
  session_number_positive: 'O número da sessão deve ser maior que zero.',
  clinic_settings_slot_positive: 'A duração do slot deve ser maior que zero.',
  clinic_settings_duration_positive: 'A duração padrão deve ser maior que zero.',
};

/** Resolve uma violação de CHECK (23514) ou EXCLUDE (23P01) para status + mensagem. */
function constraintFailure(error: unknown): { status: number; message: string } | null {
  const text = error instanceof Error ? error.message : '';
  if (!text) return null;
  for (const [name, message] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (text.includes(name)) return { status: name === 'calendar_no_overlap' ? 409 : 400, message };
  }
  if (text.includes('23P01')) return { status: 409, message: 'Conflito com um registro existente.' };
  if (text.includes('23514') || text.includes('violates check constraint')) {
    return { status: 400, message: 'Os dados enviados violam uma regra do banco.' };
  }
  return null;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) { res.end(); return; }
    let status = 500;
    let message = 'Erro interno ao processar a solicitação.';
    if (error instanceof HttpException) { status = error.getStatus(); message = error.message; }
    if (error instanceof ZodError) { status = 400; message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '); }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { status = 409; message = 'Registro já cadastrado.'; }
      if (error.code === 'P2003') { status = 400; message = 'Relacionamento inválido.'; }
      if (error.code === 'P2025') { status = 404; message = 'Registro não encontrado.'; }
    }
    if (status === 500) {
      const constraint = constraintFailure(error);
      if (constraint) { status = constraint.status; message = constraint.message; }
    }
    if (status === 500) console.error('Unhandled API error:', error instanceof Error ? error.name : 'Unknown');
    res.status(status).json({ statusCode: status, error: message, message });
  }
}
