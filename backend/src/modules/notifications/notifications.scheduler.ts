import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleAutomaticTaskReminders(): Promise<void> {
    const summary = await this.notificationsService.runAutomaticTaskReminders();

    if (summary.created > 0) {
      this.logger.log(
        `Automatic reminders created ${summary.created}/${summary.scanned} task notifications`,
      );
    }
  }
}
