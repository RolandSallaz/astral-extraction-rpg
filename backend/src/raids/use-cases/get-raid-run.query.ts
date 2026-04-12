import { Injectable } from '@nestjs/common';
import { RaidsService } from '../raids.service';

@Injectable()
export class GetRaidRunQuery {
  constructor(private readonly raidsService: RaidsService) {}

  execute(id: string) {
    return this.raidsService.getRun(id);
  }
}
