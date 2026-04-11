import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchAndAccessIndexes1774167600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;

    if (dbType === 'postgres') {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS "IDX_PAGES_WORKSPACE_DELETED_SORT" ON "pages" ("workspace_id", "is_deleted", "sort_order")',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS "IDX_BLOCKS_PAGE_SORT" ON "blocks" ("page_id", "sort_order")',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS "IDX_PAGES_TITLE_TRGM" ON "pages" USING GIN ("title" gin_trgm_ops)',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS "IDX_BLOCKS_CONTENT_TRGM" ON "blocks" USING GIN ("content" gin_trgm_ops)',
      );
      return;
    }

    if (dbType === 'oracle') {
      await this.runIgnoreAlreadyExists(
        queryRunner,
        'CREATE INDEX IDX_PAGES_WORKSPACE_DELETED_SORT ON pages (workspace_id, is_deleted, sort_order)',
      );
      await this.runIgnoreAlreadyExists(
        queryRunner,
        'CREATE INDEX IDX_BLOCKS_PAGE_SORT ON blocks (page_id, sort_order)',
      );
      await this.runIgnoreAlreadyExists(
        queryRunner,
        'CREATE INDEX IDX_PAGES_TITLE ON pages (title)',
      );
      return;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;

    if (dbType === 'postgres') {
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_BLOCKS_CONTENT_TRGM"');
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_PAGES_TITLE_TRGM"');
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_BLOCKS_PAGE_SORT"');
      await queryRunner.query(
        'DROP INDEX IF EXISTS "IDX_PAGES_WORKSPACE_DELETED_SORT"',
      );
      return;
    }

    if (dbType === 'oracle') {
      await this.runIgnoreNotExists(queryRunner, 'DROP INDEX IDX_PAGES_TITLE');
      await this.runIgnoreNotExists(
        queryRunner,
        'DROP INDEX IDX_BLOCKS_PAGE_SORT',
      );
      await this.runIgnoreNotExists(
        queryRunner,
        'DROP INDEX IDX_PAGES_WORKSPACE_DELETED_SORT',
      );
      return;
    }
  }

  private async runIgnoreAlreadyExists(
    queryRunner: QueryRunner,
    sql: string,
  ): Promise<void> {
    try {
      await queryRunner.query(sql);
    } catch (error) {
      const message = String(error);
      if (!message.includes('ORA-00955')) {
        throw error;
      }
    }
  }

  private async runIgnoreNotExists(
    queryRunner: QueryRunner,
    sql: string,
  ): Promise<void> {
    try {
      await queryRunner.query(sql);
    } catch (error) {
      const message = String(error);
      if (!message.includes('ORA-01418')) {
        throw error;
      }
    }
  }
}
