import { Module } from '@nestjs/common';
import { ProtocolsController } from './protocols.controller';
import { ProtocolsService } from './protocols.service';
import { ProtocolsRepository } from './protocols.repository';
@Module({ controllers: [ProtocolsController], providers: [ProtocolsService, ProtocolsRepository], exports: [ProtocolsService] })
export class ProtocolsModule {}
