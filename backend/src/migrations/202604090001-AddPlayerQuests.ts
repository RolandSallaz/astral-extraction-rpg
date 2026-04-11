import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPlayerQuests2026040900010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('players', 'quests');
    if (hasColumn) {
      return;
    }

    await queryRunner.addColumn(
      'players',
      new TableColumn({
        name: 'quests',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('players', 'quests');
    if (!hasColumn) {
      return;
    }

    await queryRunner.dropColumn('players', 'quests');
  }
}
