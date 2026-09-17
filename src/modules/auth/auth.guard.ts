import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { env } from '../../config/env';
import type { AuthRequest } from '../../common/http';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private auth: AuthService, @Inject(Reflector) private reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== env.FRONTEND_ORIGIN) {
      throw new ForbiddenException('Origem da requisição não autorizada.');
    }
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    req.user = await this.auth.authenticate(req.cookies?.[SESSION_COOKIE]);
    return true;
  }
}
