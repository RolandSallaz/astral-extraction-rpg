import { Injectable } from '@nestjs/common';
import { RaidsService } from '../raids.service';

@Injectable()
export class GetRaidTemplatesQuery {
  constructor(private readonly raidsService: RaidsService) {}

  execute() {
    return this.raidsService.listTemplates();
  }
}
