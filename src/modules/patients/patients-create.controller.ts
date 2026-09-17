import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import type { AuthRequest } from '../../common/http';
@ApiTags('patients')
@Controller('patients')
export class PatientsCreateController {
  constructor(@Inject(UsersService) private users: UsersService) {}
  @Post()
  @ApiBody({ schema: { type: 'object', required: ['email', 'password', 'full_name'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, full_name: { type: 'string' }, phone: { type: 'string' } } } })
  async create(@Req() req: AuthRequest, @Body() body: unknown) { return { data: await this.users.create(req.user, body, true), error: null }; }
}
