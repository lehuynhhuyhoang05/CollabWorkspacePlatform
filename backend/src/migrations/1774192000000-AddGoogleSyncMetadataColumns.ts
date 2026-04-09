import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddGoogleSyncMetadataColumns1774192000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tasksTable = await queryRunner.getTable('tasks');
    if (!tasksTable) {
      return;
    }

    const maybeAddColumn = async (column: TableColumn): Promise<void> => {
      if (!tasksTable.findColumnByName(column.name)) {
        await queryRunner.addColumn('tasks', column);
      }
    };

    await maybeAddColumn(
      new TableColumn({
        name: 'google_event_etag',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await maybeAddColumn(
      new TableColumn({
        name: 'google_event_updated_at',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await maybeAddColumn(
      new TableColumn({
        name: 'google_task_last_synced_at',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await maybeAddColumn(
      new TableColumn({
        name: 'google_last_pulled_at',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await maybeAddColumn(
      new TableColumn({
        name: 'google_sync_conflict_at',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await maybeAddColumn(
      new TableColumn({
        name: 'google_sync_conflict_message',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tasksTable = await queryRunner.getTable('tasks');
    if (!tasksTable) {
      return;
    }

    const maybeDropColumn = async (columnName: string): Promise<void> => {
      const refreshedTasksTable = await queryRunner.getTable('tasks');
      if (refreshedTasksTable?.findColumnByName(columnName)) {
        await queryRunner.dropColumn('tasks', columnName);
      }
    };

    await maybeDropColumn('google_sync_conflict_message');
    await maybeDropColumn('google_sync_conflict_at');
    await maybeDropColumn('google_last_pulled_at');
    await maybeDropColumn('google_task_last_synced_at');
    await maybeDropColumn('google_event_updated_at');
    await maybeDropColumn('google_event_etag');
  }
}
