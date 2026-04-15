import { ConfigType, registerAs } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';

function parseBooleanEnv(value: string | undefined) {
  if (value == null) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

export const dbConfig = registerAs(
  'db',
  (): TypeOrmModuleOptions => {
    const dbSynchronizeOverride = parseBooleanEnv(process.env.DB_SYNCHRONIZE);

    return {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'mmorpg',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
      synchronize: dbSynchronizeOverride ?? process.env.NODE_ENV !== 'production',
      autoLoadEntities: true,
    };
  },
);

export type TDbConfig = ConfigType<typeof dbConfig>;

export const AppDataSource = new DataSource(dbConfig() as DataSourceOptions);
