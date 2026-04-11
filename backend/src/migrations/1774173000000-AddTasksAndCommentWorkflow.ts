import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddTasksAndCommentWorkflow1774173000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const commentsTable = await queryRunner.getTable('comments');

    if (commentsTable) {
      if (!commentsTable.findColumnByName('is_resolved')) {
        await queryRunner.addColumn(
          'comments',
          new TableColumn({
            name: 'is_resolved',
            type: 'boolean',
            isNullable: false,
            default: false,
          }),
        );
      }

      if (!commentsTable.findColumnByName('resolved_by_user_id')) {
        await queryRunner.addColumn(
          'comments',
          new TableColumn({
            name: 'resolved_by_user_id',
            type: 'varchar',
            length: '36',
            isNullable: true,
          }),
        );
      }

      if (!commentsTable.findColumnByName('resolved_at')) {
        await queryRunner.addColumn(
          'comments',
          new TableColumn({
            name: 'resolved_at',
            type: 'timestamp',
            isNullable: true,
          }),
        );
      }

      if (!commentsTable.findColumnByName('reopened_by_user_id')) {
        await queryRunner.addColumn(
          'comments',
          new TableColumn({
            name: 'reopened_by_user_id',
            type: 'varchar',
            length: '36',
            isNullable: true,
          }),
        );
      }

      if (!commentsTable.findColumnByName('reopened_at')) {
        await queryRunner.addColumn(
          'comments',
          new TableColumn({
            name: 'reopened_at',
            type: 'timestamp',
            isNullable: true,
          }),
        );
      }

      const resolvedByFkExists = commentsTable.foreignKeys.some(
        (fk) =>
          fk.columnNames.length === 1 &&
          fk.columnNames[0] === 'resolved_by_user_id',
      );

      if (!resolvedByFkExists) {
        await queryRunner.createForeignKey(
          'comments',
          new TableForeignKey({
            columnNames: ['resolved_by_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        );
      }

      const reopenedByFkExists = commentsTable.foreignKeys.some(
        (fk) =>
          fk.columnNames.length === 1 &&
          fk.columnNames[0] === 'reopened_by_user_id',
      );

      if (!reopenedByFkExists) {
        await queryRunner.createForeignKey(
          'comments',
          new TableForeignKey({
            columnNames: ['reopened_by_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        );
      }
    }

    const tasksTable = await queryRunner.getTable('tasks');

    if (!tasksTable) {
      await queryRunner.createTable(
        new Table({
          name: 'tasks',
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
              name: 'title',
              type: 'varchar',
              length: '255',
              isNullable: false,
            },
            {
              name: 'description',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'status',
              type: 'varchar',
              length: '20',
              default: "'todo'",
              isNullable: false,
            },
            {
              name: 'priority',
              type: 'varchar',
              length: '20',
              default: "'medium'",
              isNullable: false,
            },
            {
              name: 'due_date',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'assignee_id',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'created_by',
              type: 'varchar',
              length: '36',
              isNullable: false,
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
        true,
      );

      await queryRunner.createForeignKeys('tasks', [
        new TableForeignKey({
          columnNames: ['workspace_id'],
          referencedTableName: 'workspaces',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['assignee_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
        new TableForeignKey({
          columnNames: ['created_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
        }),
      ]);

      await queryRunner.createIndex(
        'tasks',
        new TableIndex({
          name: 'IDX_TASKS_WORKSPACE_STATUS_DUE',
          columnNames: ['workspace_id', 'status', 'due_date'],
        }),
      );

      await queryRunner.createIndex(
        'tasks',
        new TableIndex({
          name: 'IDX_TASKS_ASSIGNEE',
          columnNames: ['assignee_id'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tasksTable = await queryRunner.getTable('tasks');

    if (tasksTable) {
      const workspaceIndex = tasksTable.indices.find(
        (index) => index.name === 'IDX_TASKS_WORKSPACE_STATUS_DUE',
      );
      if (workspaceIndex) {
        await queryRunner.dropIndex('tasks', workspaceIndex);
      }

      const assigneeIndex = tasksTable.indices.find(
        (index) => index.name === 'IDX_TASKS_ASSIGNEE',
      );
      if (assigneeIndex) {
        await queryRunner.dropIndex('tasks', assigneeIndex);
      }

      await queryRunner.dropTable('tasks');
    }

    const commentsTable = await queryRunner.getTable('comments');

    if (commentsTable) {
      const resolvedByFk = commentsTable.foreignKeys.find(
        (fk) =>
          fk.columnNames.length === 1 &&
          fk.columnNames[0] === 'resolved_by_user_id',
      );
      if (resolvedByFk) {
        await queryRunner.dropForeignKey('comments', resolvedByFk);
      }

      const reopenedByFk = commentsTable.foreignKeys.find(
        (fk) =>
          fk.columnNames.length === 1 &&
          fk.columnNames[0] === 'reopened_by_user_id',
      );
      if (reopenedByFk) {
        await queryRunner.dropForeignKey('comments', reopenedByFk);
      }

      if (commentsTable.findColumnByName('reopened_at')) {
        await queryRunner.dropColumn('comments', 'reopened_at');
      }
      if (commentsTable.findColumnByName('reopened_by_user_id')) {
        await queryRunner.dropColumn('comments', 'reopened_by_user_id');
      }
      if (commentsTable.findColumnByName('resolved_at')) {
        await queryRunner.dropColumn('comments', 'resolved_at');
      }
      if (commentsTable.findColumnByName('resolved_by_user_id')) {
        await queryRunner.dropColumn('comments', 'resolved_by_user_id');
      }
      if (commentsTable.findColumnByName('is_resolved')) {
        await queryRunner.dropColumn('comments', 'is_resolved');
      }
    }
  }
}
