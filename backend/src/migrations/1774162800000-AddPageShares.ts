import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPageShares1774162800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'page_shares',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'page_id',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'token',
            type: 'varchar',
            length: '96',
            isNullable: false,
          },
          {
            name: 'permission',
            type: 'varchar',
            length: '10',
            default: "'view'",
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'page_shares',
      new TableIndex({
        name: 'IDX_PAGE_SHARES_TOKEN_UNIQUE',
        columnNames: ['token'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'page_shares',
      new TableForeignKey({
        columnNames: ['page_id'],
        referencedTableName: 'pages',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'page_shares',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('page_shares');
    if (table) {
      const pageFk = table.foreignKeys.find((fk) => fk.columnNames.includes('page_id'));
      const userFk = table.foreignKeys.find((fk) => fk.columnNames.includes('user_id'));
      if (pageFk) {
        await queryRunner.dropForeignKey('page_shares', pageFk);
      }
      if (userFk) {
        await queryRunner.dropForeignKey('page_shares', userFk);
      }
    }

    await queryRunner.dropIndex('page_shares', 'IDX_PAGE_SHARES_TOKEN_UNIQUE');
    await queryRunner.dropTable('page_shares');
  }
}
