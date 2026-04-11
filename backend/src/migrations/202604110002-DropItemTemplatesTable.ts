import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropItemTemplatesTable2026041100020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('item_templates');
    if (!hasTable) {
      return;
    }

    await queryRunner.query('DROP TABLE "item_templates"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('item_templates');
    if (hasTable) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "item_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "slot" character varying,
        "iconPath" character varying,
        "value" integer NOT NULL DEFAULT 0,
        "stackable" boolean NOT NULL DEFAULT false,
        "maxStack" integer NOT NULL DEFAULT 1,
        "data" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_item_templates_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_item_templates_code" UNIQUE ("code")
      )
    `);
  }
}
