import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1774160738376 implements MigrationInterface {
  name = 'InitialSchema1774160738376';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" character varying(36) NOT NULL, "email" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "avatarUrl" character varying(500), "refreshTokenHash" character varying(500), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspace_members" ("id" character varying(36) NOT NULL, "workspace_id" character varying(36) NOT NULL, "user_id" character varying(36) NOT NULL, "role" character varying(20) NOT NULL DEFAULT 'viewer', "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4896b609c71ca5ad20ad662077b" UNIQUE ("workspace_id", "user_id"), CONSTRAINT "PK_22ab43ac5865cd62769121d2bc4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" character varying(36) NOT NULL, "name" character varying(255) NOT NULL, "icon" character varying(10), "owner_id" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "pages" ("id" character varying(36) NOT NULL, "workspace_id" character varying(36) NOT NULL, "parent_id" character varying(36), "title" character varying(500) NOT NULL DEFAULT 'Untitled', "icon" character varying(10), "cover_url" character varying(500), "is_deleted" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', "created_by" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8f21ed625aa34c8391d636b7d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "blocks" ("id" character varying(36) NOT NULL, "page_id" character varying(36) NOT NULL, "type" character varying(50) NOT NULL, "content" text, "sort_order" integer NOT NULL DEFAULT '0', "created_by" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8244fa1495c4e9222a01059244b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" character varying(36) NOT NULL, "block_id" character varying(36) NOT NULL, "user_id" character varying(36) NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "page_versions" ("id" character varying(36) NOT NULL, "page_id" character varying(36) NOT NULL, "snapshot" text NOT NULL, "created_by" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2300687d4f12928dd6cf97c7605" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_4a7c584ddfe855379598b5e20fd" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_4e83431119fa585fc7aa8b817db" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "FK_3bc45ecdd8fdc2108bb92516dde" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_e81517e2f307170573c9be6f581" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_65fc17f66b9d5e426eaf942dc86" FOREIGN KEY ("parent_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" ADD CONSTRAINT "FK_064ab67bb29a28d073db287fc6d" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "blocks" ADD CONSTRAINT "FK_af30f9b08123675edcf8c58b105" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "blocks" ADD CONSTRAINT "FK_35488729832339d9f933db0c2bc" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_4444059b7531104f74768b13d3b" FOREIGN KEY ("block_id") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_versions" ADD CONSTRAINT "FK_e0797ec63e135341486d20ab68b" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_versions" ADD CONSTRAINT "FK_98d42ea1a0ef393120ff2b2be61" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "page_versions" DROP CONSTRAINT "FK_98d42ea1a0ef393120ff2b2be61"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page_versions" DROP CONSTRAINT "FK_e0797ec63e135341486d20ab68b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_4444059b7531104f74768b13d3b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blocks" DROP CONSTRAINT "FK_35488729832339d9f933db0c2bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blocks" DROP CONSTRAINT "FK_af30f9b08123675edcf8c58b105"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_064ab67bb29a28d073db287fc6d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_65fc17f66b9d5e426eaf942dc86"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pages" DROP CONSTRAINT "FK_e81517e2f307170573c9be6f581"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT "FK_3bc45ecdd8fdc2108bb92516dde"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_4e83431119fa585fc7aa8b817db"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_4a7c584ddfe855379598b5e20fd"`,
    );
    await queryRunner.query(`DROP TABLE "page_versions"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP TABLE "blocks"`);
    await queryRunner.query(`DROP TABLE "pages"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(`DROP TABLE "workspace_members"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
