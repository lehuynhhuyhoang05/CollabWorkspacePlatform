import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { WorkspaceActivity } from './entities/workspace-activity.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { User } from '../users/entities/user.entity';
import { NotificationsScheduler } from './notifications.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      WorkspaceActivity,
      WorkspaceMember,
      Task,
      User,
    ]),
    WorkspacesModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
