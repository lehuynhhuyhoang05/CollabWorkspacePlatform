import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CollaborationGateway } from './collaboration.gateway';
import { BlocksModule } from '../blocks/blocks.module';
import { PagesModule } from '../pages/pages.module';
import { CollaborationEventsModule } from './collaboration-events.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    CollaborationEventsModule,
    BlocksModule,
    PagesModule,
  ],
  providers: [CollaborationGateway],
})
export class CollaborationModule {}
