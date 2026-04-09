import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { WorkspaceActivity } from './entities/workspace-activity.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      WorkspaceActivity,
      WorkspaceMember,
      Task,
    ]),
    WorkspacesModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
