import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { Public, type AuthRequest } from '../../common/http';
import { env } from '../../config/env';
import { AuthService, SESSION_COOKIE, SESSION_MAX_AGE } from './auth.service';

export class UserResponse {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['admin', 'professional', 'patient'] }) role!: 'admin' | 'professional' | 'patient';
  @ApiProperty() full_name!: string;
}
const cookie = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api' };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  @Public() @Post('login') @HttpCode(200)
  @ApiBody({ schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } } })
  @ApiOkResponse({ type: UserResponse })
  async login(@Body() body: unknown, @Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const data = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) }).strict().parse(body);
    const result = await this.auth.login(data.email, data.password, req.ip ?? 'unknown');
    res.cookie(SESSION_COOKIE, result.token, { ...cookie, maxAge: SESSION_MAX_AGE });
    return result.user;
  }
  @Get('me') @ApiOkResponse({ type: UserResponse })
  me(@Req() req: AuthRequest) { return req.user; }
  @Public() @Post('logout') @HttpCode(204)
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, cookie);
  }
}
