import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { dbConfig, TDbConfig } from './config/db.config';
import { GameConfigsModule } from './game-configs/game-configs.module';
import { ItemsModule } from './items/items.module';
import { PartiesModule } from './parties/parties.module';
import { PlayersModule } from './players/players.module';
import { RaidsModule } from './raids/raids.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [dbConfig]
    }),
    TypeOrmModule.forRootAsync({
      inject: [dbConfig.KEY],
      useFactory: (config: TDbConfig) => config
    }),
    GameConfigsModule,
    ItemsModule,
    PartiesModule,
    PlayersModule,
    RaidsModule,
    AuthModule
  ],
})
export class AppModule { }
