import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GoogleIntegrationsController } from './google-integrations.controller';
import { GoogleIntegrationsService } from './google-integrations.service';
import { GoogleAccount } from './entities/google-account.entity';
import { GoogleCalendarSyncJob } from './entities/google-calendar-sync-job.entity';
import { GoogleIntegrationAuditLog } from './entities/google-integration-audit-log.entity';
import { Task } from '../tasks/entities/task.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      GoogleAccount,
      GoogleCalendarSyncJob,
      GoogleIntegrationAuditLog,
      Task,
      WorkspaceMember,
    ]),
    WorkspacesModule,
  ],
  controllers: [GoogleIntegrationsController],
  providers: [GoogleIntegrationsService],
  exports: [GoogleIntegrationsService],
})
export class GoogleIntegrationsModule {}
