import { Body, Controller, Get, Inject, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import type { AuthRequest } from '../../common/http';
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private users: UsersService) {}
  @Post() async create(@Req() req: AuthRequest, @Body() body: unknown) { return { data: await this.users.create(req.user, body), error: null }; }
  @Get('roles') async roles(@Req() req: AuthRequest, @Query('role') role?: string) { return { data: await this.users.roles(req.user, role), error: null }; }
}
