import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddNotificationsActivityAndTaskRelations1774179000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tasksTable = await queryRunner.getTable('tasks');

    if (tasksTable) {
      if (!tasksTable.findColumnByName('parent_task_id')) {
        await queryRunner.addColumn(
          'tasks',
          new TableColumn({
            name: 'parent_task_id',
            type: 'varchar',
            length: '36',
            isNullable: true,
          }),
        );
      }

      if (!tasksTable.findColumnByName('related_page_id')) {
        await queryRunner.addColumn(
          'tasks',
          new TableColumn({
            name: 'related_page_id',
            type: 'varchar',
            length: '36',
            isNullable: true,
          }),
        );
      }

      const refreshedTasksTable = await queryRunner.getTable('tasks');
      if (refreshedTasksTable) {
        const parentTaskFkExists = refreshedTasksTable.foreignKeys.some(
          (fk) =>
            fk.columnNames.length === 1 &&
            fk.columnNames[0] === 'parent_task_id',
        );

        if (!parentTaskFkExists) {
          await queryRunner.createForeignKey(
            'tasks',
            new TableForeignKey({
              columnNames: ['parent_task_id'],
              referencedTableName: 'tasks',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
          );
        }

        const relatedPageFkExists = refreshedTasksTable.foreignKeys.some(
          (fk) =>
            fk.columnNames.length === 1 &&
            fk.columnNames[0] === 'related_page_id',
        );

        if (!relatedPageFkExists) {
          await queryRunner.createForeignKey(
            'tasks',
            new TableForeignKey({
              columnNames: ['related_page_id'],
              referencedTableName: 'pages',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
          );
        }

        const parentTaskIndexExists = refreshedTasksTable.indices.some(
          (index) => index.name === 'IDX_TASKS_PARENT_TASK',
        );

        if (!parentTaskIndexExists) {
          await queryRunner.createIndex(
            'tasks',
            new TableIndex({
              name: 'IDX_TASKS_PARENT_TASK',
              columnNames: ['parent_task_id'],
            }),
          );
        }

        const relatedPageIndexExists = refreshedTasksTable.indices.some(
          (index) => index.name === 'IDX_TASKS_RELATED_PAGE',
        );

        if (!relatedPageIndexExists) {
          await queryRunner.createIndex(
            'tasks',
            new TableIndex({
              name: 'IDX_TASKS_RELATED_PAGE',
              columnNames: ['related_page_id'],
            }),
          );
        }
      }
    }

    const notificationsTable = await queryRunner.getTable('notifications');

    if (!notificationsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'notifications',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
            },
            {
              name: 'workspace_id',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'user_id',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'type',
              type: 'varchar',
              length: '40',
              isNullable: false,
            },
            {
              name: 'title',
              type: 'varchar',
              length: '255',
              isNullable: false,
            },
            {
              name: 'message',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'link_url',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'is_read',
              type: 'boolean',
              default: false,
              isNullable: false,
            },
            {
              name: 'read_at',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'created_by',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'entity_type',
              type: 'varchar',
              length: '40',
              isNullable: true,
            },
            {
              name: 'entity_id',
              type: 'varchar',
              length: '36',
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

      await queryRunner.createForeignKeys('notifications', [
        new TableForeignKey({
          columnNames: ['workspace_id'],
          referencedTableName: 'workspaces',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['created_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);

      await queryRunner.createIndex(
        'notifications',
        new TableIndex({
          name: 'IDX_NOTIFICATIONS_USER_READ_CREATED',
          columnNames: ['user_id', 'is_read', 'createdAt'],
        }),
      );

      await queryRunner.createIndex(
        'notifications',
        new TableIndex({
          name: 'IDX_NOTIFICATIONS_WORKSPACE_CREATED',
          columnNames: ['workspace_id', 'createdAt'],
        }),
      );
    }

    const activitiesTable = await queryRunner.getTable('workspace_activities');

    if (!activitiesTable) {
      await queryRunner.createTable(
        new Table({
          name: 'workspace_activities',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
            },
            {
              name: 'workspace_id',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'actor_user_id',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'type',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'message',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'entity_type',
              type: 'varchar',
              length: '40',
              isNullable: true,
            },
            {
              name: 'entity_id',
              type: 'varchar',
              length: '36',
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

      await queryRunner.createForeignKeys('workspace_activities', [
        new TableForeignKey({
          columnNames: ['workspace_id'],
          referencedTableName: 'workspaces',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['actor_user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
        }),
      ]);

      await queryRunner.createIndex(
        'workspace_activities',
        new TableIndex({
          name: 'IDX_WORKSPACE_ACTIVITIES_WORKSPACE_CREATED',
          columnNames: ['workspace_id', 'createdAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const activitiesTable = await queryRunner.getTable('workspace_activities');

    if (activitiesTable) {
      const activitiesIndex = activitiesTable.indices.find(
        (index) => index.name === 'IDX_WORKSPACE_ACTIVITIES_WORKSPACE_CREATED',
      );
      if (activitiesIndex) {
        await queryRunner.dropIndex('workspace_activities', activitiesIndex);
      }

      await queryRunner.dropTable('workspace_activities');
    }

    const notificationsTable = await queryRunner.getTable('notifications');

    if (notificationsTable) {
      const userReadIndex = notificationsTable.indices.find(
        (index) => index.name === 'IDX_NOTIFICATIONS_USER_READ_CREATED',
      );
      if (userReadIndex) {
        await queryRunner.dropIndex('notifications', userReadIndex);
      }

      const workspaceCreatedIndex = notificationsTable.indices.find(
        (index) => index.name === 'IDX_NOTIFICATIONS_WORKSPACE_CREATED',
      );
      if (workspaceCreatedIndex) {
        await queryRunner.dropIndex('notifications', workspaceCreatedIndex);
      }

      await queryRunner.dropTable('notifications');
    }

    const tasksTable = await queryRunner.getTable('tasks');

    if (tasksTable) {
      const parentTaskIndex = tasksTable.indices.find(
        (index) => index.name === 'IDX_TASKS_PARENT_TASK',
      );
      if (parentTaskIndex) {
        await queryRunner.dropIndex('tasks', parentTaskIndex);
      }

      const relatedPageIndex = tasksTable.indices.find(
        (index) => index.name === 'IDX_TASKS_RELATED_PAGE',
      );
      if (relatedPageIndex) {
        await queryRunner.dropIndex('tasks', relatedPageIndex);
      }

      const parentTaskFk = tasksTable.foreignKeys.find(
        (fk) =>
          fk.columnNames.length === 1 && fk.columnNames[0] === 'parent_task_id',
      );
      if (parentTaskFk) {
        await queryRunner.dropForeignKey('tasks', parentTaskFk);
      }

      const relatedPageFk = tasksTable.foreignKeys.find(
        (fk) =>
          fk.columnNames.length === 1 &&
          fk.columnNames[0] === 'related_page_id',
      );
      if (relatedPageFk) {
        await queryRunner.dropForeignKey('tasks', relatedPageFk);
      }

      if (tasksTable.findColumnByName('related_page_id')) {
        await queryRunner.dropColumn('tasks', 'related_page_id');
      }

      if (tasksTable.findColumnByName('parent_task_id')) {
        await queryRunner.dropColumn('tasks', 'parent_task_id');
      }
    }
  }
}
