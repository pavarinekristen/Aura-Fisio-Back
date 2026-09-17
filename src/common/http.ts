import { ArgumentsHost, Catch, ExceptionFilter, HttpException, SetMetadata } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

export interface Principal { id: string; email: string; role: Role; full_name: string }
export interface AuthRequest extends Request { user: Principal }
export const Public = () => SetMetadata('public', true);
export const isStaff = (user: Principal) => user.role === 'admin' || user.role === 'professional';

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
    if (status === 500) console.error('Unhandled API error:', error instanceof Error ? error.name : 'Unknown');
    res.status(status).json({ statusCode: status, error: message, message });
  }
}
