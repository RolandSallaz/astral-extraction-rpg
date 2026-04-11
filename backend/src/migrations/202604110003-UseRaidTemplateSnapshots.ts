import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UseRaidTemplateSnapshots2026041100030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('raid_runs', [
      new TableColumn({
        name: 'templateCode',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'templateName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'biome',
        type: 'varchar',
        default: "'crypt'",
      }),
      new TableColumn({
        name: 'minPlayers',
        type: 'int',
        default: 1,
      }),
      new TableColumn({
        name: 'maxPlayers',
        type: 'int',
        default: 4,
      }),
      new TableColumn({
        name: 'width',
        type: 'int',
        default: 30,
      }),
      new TableColumn({
        name: 'height',
        type: 'int',
        default: 20,
      }),
    ]);

    await queryRunner.query(`
      UPDATE raid_runs rr
      SET
        "templateCode" = rt.code,
        "templateName" = rt.name,
        "biome" = rt.biome,
        "minPlayers" = rt."minPlayers",
        "maxPlayers" = rt."maxPlayers",
        "width" = rt.width,
        "height" = rt.height
      FROM raid_templates rt
      WHERE rr."templateId" = rt.id
    `);

    await queryRunner.changeColumn(
      'raid_runs',
      'templateCode',
      new TableColumn({
        name: 'templateCode',
        type: 'varchar',
        isNullable: false,
      }),
    );

    await queryRunner.changeColumn(
      'raid_runs',
      'templateName',
      new TableColumn({
        name: 'templateName',
        type: 'varchar',
        isNullable: false,
      }),
    );

    const raidRunsTable = await queryRunner.getTable('raid_runs');
    const templateForeignKey = raidRunsTable?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('templateId'),
    );
    if (templateForeignKey) {
      await queryRunner.dropForeignKey('raid_runs', templateForeignKey);
    }

    const hasTemplateId = raidRunsTable?.columns.some((column) => column.name === 'templateId');
    if (hasTemplateId) {
      await queryRunner.dropColumn('raid_runs', 'templateId');
    }

    const hasTemplatesTable = await queryRunner.hasTable('raid_templates');
    if (hasTemplatesTable) {
      await queryRunner.query('DROP TABLE "raid_templates"');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTemplatesTable = await queryRunner.hasTable('raid_templates');
    if (!hasTemplatesTable) {
      await queryRunner.query(`
        CREATE TABLE "raid_templates" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "code" character varying NOT NULL,
          "name" character varying NOT NULL,
          "description" text NOT NULL DEFAULT '',
          "biome" character varying NOT NULL DEFAULT 'crypt',
          "minPlayers" integer NOT NULL DEFAULT 1,
          "maxPlayers" integer NOT NULL DEFAULT 4,
          "width" integer NOT NULL DEFAULT 30,
          "height" integer NOT NULL DEFAULT 20,
          "isActive" boolean NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_raid_templates_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_raid_templates_code" UNIQUE ("code")
        )
      `);
    }

    await queryRunner.addColumn(
      'raid_runs',
      new TableColumn({
        name: 'templateId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      INSERT INTO raid_templates (
        code,
        name,
        description,
        biome,
        "minPlayers",
        "maxPlayers",
        width,
        height,
        "isActive"
      )
      SELECT DISTINCT
        rr."templateCode",
        rr."templateName",
        '',
        rr.biome,
        rr."minPlayers",
        rr."maxPlayers",
        rr.width,
        rr.height,
        true
      FROM raid_runs rr
      WHERE rr."templateCode" IS NOT NULL
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE raid_runs rr
      SET "templateId" = rt.id
      FROM raid_templates rt
      WHERE rr."templateCode" = rt.code
    `);

    await queryRunner.changeColumn(
      'raid_runs',
      'templateId',
      new TableColumn({
        name: 'templateId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.query(`
      ALTER TABLE "raid_runs"
      ADD CONSTRAINT "FK_raid_runs_templateId"
      FOREIGN KEY ("templateId") REFERENCES "raid_templates"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.dropColumn('raid_runs', 'templateCode');
    await queryRunner.dropColumn('raid_runs', 'templateName');
    await queryRunner.dropColumn('raid_runs', 'biome');
    await queryRunner.dropColumn('raid_runs', 'minPlayers');
    await queryRunner.dropColumn('raid_runs', 'maxPlayers');
    await queryRunner.dropColumn('raid_runs', 'width');
    await queryRunner.dropColumn('raid_runs', 'height');
  }
}
