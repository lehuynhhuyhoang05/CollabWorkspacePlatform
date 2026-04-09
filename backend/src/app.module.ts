import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { getDatabaseConfig } from './config/database.config';
import { envValidationSchema } from './config/env.validation';

// Feature modules
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { PagesModule } from './modules/pages/pages.module';
import { BlocksModule } from './modules/blocks/blocks.module';
import { CommentsModule } from './modules/comments/comments.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { SearchModule } from './modules/search/search.module';
import { StorageModule } from './modules/storage/storage.module';
import { ShareModule } from './modules/share/share.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { GoogleIntegrationsModule } from './modules/google-integrations/google-integrations.module';

@Module({
  imports: [
    // Global config — validates env vars on startup
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true, // Fail fast on first missing var
      },
    }),

    // Rate limiting — 60 requests per minute per IP
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),

    // TypeORM — supports both PostgreSQL (Phase 1) and Oracle (Phase 2)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),

    // Core modules
    HealthModule,
    AuthModule,
    UsersModule,

    // Feature modules
    WorkspacesModule,
    PagesModule,
    BlocksModule,
    CommentsModule,
    CollaborationModule,
    SearchModule,
    StorageModule,
    ShareModule,
    TasksModule,
    NotificationsModule,
    GoogleIntegrationsModule,
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
