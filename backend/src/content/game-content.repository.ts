import { Injectable } from '@nestjs/common';
import { GameConfigFiles } from '../game-configs/game-config-files';

@Injectable()
export class GameContentRepository extends GameConfigFiles {}
