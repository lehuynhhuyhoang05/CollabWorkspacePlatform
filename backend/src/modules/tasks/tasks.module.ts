import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Page } from '../pages/entities/page.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, WorkspaceMember, Page]),
    WorkspacesModule,
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
