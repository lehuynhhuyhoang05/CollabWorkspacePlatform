import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPasswordResetColumns1774210000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const usersTable = await queryRunner.getTable('users');
    if (!usersTable) {
      return;
    }

    if (!usersTable.findColumnByName('passwordResetTokenHash')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'passwordResetTokenHash',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }

    if (!usersTable.findColumnByName('passwordResetExpiresAt')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'passwordResetExpiresAt',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const usersTable = await queryRunner.getTable('users');
    if (!usersTable) {
      return;
    }

    if (usersTable.findColumnByName('passwordResetExpiresAt')) {
      await queryRunner.dropColumn('users', 'passwordResetExpiresAt');
    }

    if (usersTable.findColumnByName('passwordResetTokenHash')) {
      await queryRunner.dropColumn('users', 'passwordResetTokenHash');
    }
  }
}
