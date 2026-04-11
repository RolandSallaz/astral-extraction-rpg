import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class UseItemCodesForOwnership2026041100010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'player_items',
      new TableColumn({
        name: 'itemCode',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'container_items',
      new TableColumn({
        name: 'itemCode',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE player_items pi
      SET "itemCode" = it.code
      FROM item_templates it
      WHERE pi."templateId" = it.id
    `);

    await queryRunner.query(`
      UPDATE container_items ci
      SET "itemCode" = it.code
      FROM item_templates it
      WHERE ci."templateId" = it.id
    `);

    await queryRunner.changeColumn(
      'player_items',
      'itemCode',
      new TableColumn({
        name: 'itemCode',
        type: 'varchar',
        isNullable: false,
      }),
    );

    await queryRunner.changeColumn(
      'container_items',
      'itemCode',
      new TableColumn({
        name: 'itemCode',
        type: 'varchar',
        isNullable: false,
      }),
    );

    const playerItemsTable = await queryRunner.getTable('player_items');
    const playerTemplateForeignKey = playerItemsTable?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('templateId'),
    );
    if (playerTemplateForeignKey) {
      await queryRunner.dropForeignKey('player_items', playerTemplateForeignKey);
    }

    const containerItemsTable = await queryRunner.getTable('container_items');
    const containerTemplateForeignKey = containerItemsTable?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('templateId'),
    );
    if (containerTemplateForeignKey) {
      await queryRunner.dropForeignKey('container_items', containerTemplateForeignKey);
    }

    await queryRunner.dropColumn('player_items', 'templateId');
    await queryRunner.dropColumn('container_items', 'templateId');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'player_items',
      new TableColumn({
        name: 'templateId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'container_items',
      new TableColumn({
        name: 'templateId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE player_items pi
      SET "templateId" = it.id
      FROM item_templates it
      WHERE pi."itemCode" = it.code
    `);

    await queryRunner.query(`
      UPDATE container_items ci
      SET "templateId" = it.id
      FROM item_templates it
      WHERE ci."itemCode" = it.code
    `);

    await queryRunner.changeColumn(
      'player_items',
      'templateId',
      new TableColumn({
        name: 'templateId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.changeColumn(
      'container_items',
      'templateId',
      new TableColumn({
        name: 'templateId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.createForeignKey(
      'player_items',
      new TableForeignKey({
        columnNames: ['templateId'],
        referencedTableName: 'item_templates',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'container_items',
      new TableForeignKey({
        columnNames: ['templateId'],
        referencedTableName: 'item_templates',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.dropColumn('player_items', 'itemCode');
    await queryRunner.dropColumn('container_items', 'itemCode');
  }
}
