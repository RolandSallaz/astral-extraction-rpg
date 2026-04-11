import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';

@Module({
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
