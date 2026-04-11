import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class ExtractPlayerSessions2026041100050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSessionsTable = await queryRunner.hasTable('player_sessions');
    if (!hasSessionsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'player_sessions',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'playerId',
              type: 'uuid',
              isNullable: false,
            },
            {
              name: 'token',
              type: 'varchar',
              isNullable: false,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
      );
      await queryRunner.createIndex(
        'player_sessions',
        new TableIndex({
          name: 'IDX_player_sessions_token',
          columnNames: ['token'],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKey(
        'player_sessions',
        new TableForeignKey({
          columnNames: ['playerId'],
          referencedTableName: 'players',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    const hasLegacySessionToken = await queryRunner.hasColumn('players', 'sessionToken');
    if (hasLegacySessionToken) {
      await queryRunner.query(`
        INSERT INTO "player_sessions" ("playerId", "token")
        SELECT "id", "sessionToken"
        FROM "players"
        WHERE "sessionToken" IS NOT NULL
        ON CONFLICT ("token") DO NOTHING
      `);
      await queryRunner.dropColumn('players', 'sessionToken');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasLegacySessionToken = await queryRunner.hasColumn('players', 'sessionToken');
    if (!hasLegacySessionToken) {
      await queryRunner.query(`
        ALTER TABLE "players"
        ADD COLUMN "sessionToken" character varying
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_players_session_token"
        ON "players" ("sessionToken")
        WHERE "sessionToken" IS NOT NULL
      `);
    }

    const hasSessionsTable = await queryRunner.hasTable('player_sessions');
    if (hasSessionsTable) {
      await queryRunner.query(`
        UPDATE "players" AS p
        SET "sessionToken" = s."token"
        FROM "player_sessions" AS s
        WHERE s."playerId" = p."id"
      `);
      await queryRunner.dropTable('player_sessions');
    }
  }
}
