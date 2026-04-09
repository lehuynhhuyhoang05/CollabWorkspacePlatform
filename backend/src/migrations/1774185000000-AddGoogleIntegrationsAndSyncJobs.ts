import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddGoogleIntegrationsAndSyncJobs1774185000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tasksTable = await queryRunner.getTable('tasks');

    if (tasksTable) {
      if (!tasksTable.findColumnByName('google_event_id')) {
        await queryRunner.addColumn(
          'tasks',
          new TableColumn({
            name: 'google_event_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          }),
        );
      }

      if (!tasksTable.findColumnByName('google_calendar_id')) {
        await queryRunner.addColumn(
          'tasks',
          new TableColumn({
            name: 'google_calendar_id',
            type: 'varchar',
            length: '120',
            isNullable: true,
          }),
        );
      }

      if (!tasksTable.findColumnByName('google_meet_url')) {
        await queryRunner.addColumn(
          'tasks',
          new TableColumn({
            name: 'google_meet_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          }),
        );
      }

      const refreshedTasksTable = await queryRunner.getTable('tasks');
      if (refreshedTasksTable) {
        const eventIndex = refreshedTasksTable.indices.find(
          (index) => index.name === 'IDX_TASKS_GOOGLE_EVENT_ID',
        );

        if (!eventIndex) {
          await queryRunner.createIndex(
            'tasks',
            new TableIndex({
              name: 'IDX_TASKS_GOOGLE_EVENT_ID',
              columnNames: ['google_event_id'],
            }),
          );
        }
      }
    }

    const googleAccountsTable = await queryRunner.getTable('google_accounts');

    if (!googleAccountsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'google_accounts',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
            },
            {
              name: 'user_id',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'google_email',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'access_token',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'refresh_token',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'token_expires_at',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'scopes',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'last_sync_at',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
          uniques: [
            {
              name: 'UQ_GOOGLE_ACCOUNTS_USER_ID',
              columnNames: ['user_id'],
            },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        'google_accounts',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    const syncJobsTable = await queryRunner.getTable('google_calendar_sync_jobs');

    if (!syncJobsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'google_calendar_sync_jobs',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
            },
            {
              name: 'user_id',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'workspace_id',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'task_id',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'type',
              type: 'varchar',
              length: '40',
              isNullable: false,
            },
            {
              name: 'payload',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'status',
              type: 'varchar',
              length: '20',
              default: `'pending'`,
              isNullable: false,
            },
            {
              name: 'attempts',
              type: 'int',
              default: 0,
              isNullable: false,
            },
            {
              name: 'max_attempts',
              type: 'int',
              default: 5,
              isNullable: false,
            },
            {
              name: 'next_retry_at',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'last_error',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'processed_at',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
      );

      await queryRunner.createForeignKeys('google_calendar_sync_jobs', [
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['workspace_id'],
          referencedTableName: 'workspaces',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['task_id'],
          referencedTableName: 'tasks',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);

      await queryRunner.createIndex(
        'google_calendar_sync_jobs',
        new TableIndex({
          name: 'IDX_GOOGLE_SYNC_JOBS_USER_STATUS_NEXT_RETRY',
          columnNames: ['user_id', 'status', 'next_retry_at'],
        }),
      );
    }

    const auditTable = await queryRunner.getTable('google_integration_audit_logs');

    if (!auditTable) {
      await queryRunner.createTable(
        new Table({
          name: 'google_integration_audit_logs',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
            },
            {
              name: 'user_id',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'workspace_id',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'job_id',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'provider',
              type: 'varchar',
              length: '30',
              default: `'google'`,
              isNullable: false,
            },
            {
              name: 'action',
              type: 'varchar',
              length: '60',
              isNullable: false,
            },
            {
              name: 'status',
              type: 'varchar',
              length: '20',
              isNullable: false,
            },
            {
              name: 'message',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'request_payload',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'response_payload',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
      );

      await queryRunner.createForeignKeys('google_integration_audit_logs', [
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
        new TableForeignKey({
          columnNames: ['workspace_id'],
          referencedTableName: 'workspaces',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
        new TableForeignKey({
          columnNames: ['job_id'],
          referencedTableName: 'google_calendar_sync_jobs',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);

      await queryRunner.createIndex(
        'google_integration_audit_logs',
        new TableIndex({
          name: 'IDX_GOOGLE_AUDIT_USER_CREATED',
          columnNames: ['user_id', 'createdAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const auditTable = await queryRunner.getTable('google_integration_audit_logs');

    if (auditTable) {
      const auditIndex = auditTable.indices.find(
        (index) => index.name === 'IDX_GOOGLE_AUDIT_USER_CREATED',
      );
      if (auditIndex) {
        await queryRunner.dropIndex('google_integration_audit_logs', auditIndex);
      }

      await queryRunner.dropTable('google_integration_audit_logs');
    }

    const syncJobsTable = await queryRunner.getTable('google_calendar_sync_jobs');

    if (syncJobsTable) {
      const jobsIndex = syncJobsTable.indices.find(
        (index) => index.name === 'IDX_GOOGLE_SYNC_JOBS_USER_STATUS_NEXT_RETRY',
      );
      if (jobsIndex) {
        await queryRunner.dropIndex('google_calendar_sync_jobs', jobsIndex);
      }

      await queryRunner.dropTable('google_calendar_sync_jobs');
    }

    const googleAccountsTable = await queryRunner.getTable('google_accounts');

    if (googleAccountsTable) {
      await queryRunner.dropTable('google_accounts');
    }

    const tasksTable = await queryRunner.getTable('tasks');

    if (tasksTable) {
      const eventIndex = tasksTable.indices.find(
        (index) => index.name === 'IDX_TASKS_GOOGLE_EVENT_ID',
      );

      if (eventIndex) {
        await queryRunner.dropIndex('tasks', eventIndex);
      }

      if (tasksTable.findColumnByName('google_meet_url')) {
        await queryRunner.dropColumn('tasks', 'google_meet_url');
      }

      if (tasksTable.findColumnByName('google_calendar_id')) {
        await queryRunner.dropColumn('tasks', 'google_calendar_id');
      }

      if (tasksTable.findColumnByName('google_event_id')) {
        await queryRunner.dropColumn('tasks', 'google_event_id');
      }
    }
  }
}
