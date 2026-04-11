import { Logger } from '@nestjs/common';
import { NotificationsScheduler } from './notifications.scheduler';
import { NotificationsService } from './notifications.service';

describe('NotificationsScheduler', () => {
  let scheduler: NotificationsScheduler;
  let notificationsService: jest.Mocked<
    Pick<NotificationsService, 'runAutomaticTaskReminders'>
  >;

  beforeEach(() => {
    notificationsService = {
      runAutomaticTaskReminders: jest.fn(),
    };

    scheduler = new NotificationsScheduler(
      notificationsService as unknown as NotificationsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls automatic reminder scan every cron tick', async () => {
    notificationsService.runAutomaticTaskReminders.mockResolvedValueOnce({
      scanned: 3,
      created: 1,
    });

    await scheduler.handleAutomaticTaskReminders();

    expect(
      notificationsService.runAutomaticTaskReminders,
    ).toHaveBeenCalledTimes(1);
  });

  it('logs only when new reminders are created', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    notificationsService.runAutomaticTaskReminders
      .mockResolvedValueOnce({ scanned: 2, created: 1 })
      .mockResolvedValueOnce({ scanned: 2, created: 0 });

    await scheduler.handleAutomaticTaskReminders();
    await scheduler.handleAutomaticTaskReminders();

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith(
      'Automatic reminders created 1/2 task notifications',
    );
  });
});
