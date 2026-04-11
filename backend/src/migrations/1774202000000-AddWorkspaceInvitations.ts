import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddWorkspaceInvitations1774202000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'workspace_invitations',
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
          },
          {
            name: 'inviter_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'invitee_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'role',
            type: 'varchar',
            length: '20',
            default: `'editor'`,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: `'pending'`,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'responded_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createForeignKeys('workspace_invitations', [
      new TableForeignKey({
        columnNames: ['workspace_id'],
        referencedTableName: 'workspaces',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['inviter_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['invitee_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndices('workspace_invitations', [
      new TableIndex({
        name: 'IDX_WORKSPACE_INVITATIONS_INVITEE_STATUS',
        columnNames: ['invitee_id', 'status'],
      }),
      new TableIndex({
        name: 'IDX_WORKSPACE_INVITATIONS_WORKSPACE_STATUS',
        columnNames: ['workspace_id', 'status'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('workspace_invitations');
    if (table) {
      for (const foreignKey of table.foreignKeys) {
        await queryRunner.dropForeignKey('workspace_invitations', foreignKey);
      }
    }

    await queryRunner.dropIndex(
      'workspace_invitations',
      'IDX_WORKSPACE_INVITATIONS_INVITEE_STATUS',
    );
    await queryRunner.dropIndex(
      'workspace_invitations',
      'IDX_WORKSPACE_INVITATIONS_WORKSPACE_STATUS',
    );
    await queryRunner.dropTable('workspace_invitations');
  }
}
