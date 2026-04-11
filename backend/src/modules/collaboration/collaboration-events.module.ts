import { Module } from '@nestjs/common';
import { CollaborationEventsService } from './collaboration-events.service';

@Module({
  providers: [CollaborationEventsService],
  exports: [CollaborationEventsService],
})
export class CollaborationEventsModule {}