import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropLegacyGameConfigTables2026041100040 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = ['skill_balance', 'mob_balance', 'item_balance'];

    for (const tableName of tables) {
      const hasTable = await queryRunner.hasTable(tableName);
      if (!hasTable) {
        continue;
      }

      await queryRunner.query(`DROP TABLE "${tableName}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableStatements: Array<{ name: string; sql: string }> = [
      {
        name: 'skill_balance',
        sql: `
          CREATE TABLE "skill_balance" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "code" character varying NOT NULL,
            "damage" integer NOT NULL DEFAULT 0,
            "burnDamage" integer NOT NULL DEFAULT 0,
            "burnTicks" integer NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_skill_balance_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_skill_balance_code" UNIQUE ("code")
          )
        `,
      },
      {
        name: 'mob_balance',
        sql: `
          CREATE TABLE "mob_balance" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "code" character varying NOT NULL,
            "maxHealth" integer NOT NULL DEFAULT 1,
            "moveSpeed" integer NOT NULL DEFAULT 0,
            "aggroRange" integer NOT NULL DEFAULT 0,
            "leashRange" integer NOT NULL DEFAULT 0,
            "attackRange" integer NOT NULL DEFAULT 0,
            "attackDamage" integer NOT NULL DEFAULT 0,
            "attackCooldownMs" integer NOT NULL DEFAULT 0,
            "experienceReward" integer NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_mob_balance_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_mob_balance_code" UNIQUE ("code")
          )
        `,
      },
      {
        name: 'item_balance',
        sql: `
          CREATE TABLE "item_balance" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "itemId" character varying NOT NULL,
            "value" integer NOT NULL DEFAULT 0,
            "tooltipStats" jsonb NOT NULL DEFAULT '[]',
            "fireResistancePercent" integer NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_item_balance_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_item_balance_itemId" UNIQUE ("itemId")
          )
        `,
      },
    ];

    for (const statement of tableStatements) {
      const hasTable = await queryRunner.hasTable(statement.name);
      if (hasTable) {
        continue;
      }

      await queryRunner.query(statement.sql);
    }
  }
}
