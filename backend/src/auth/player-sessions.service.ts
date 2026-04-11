import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerEntity } from '../players/entities/player.entity';
import { PlayerSessionEntity } from './entities/player-session.entity';

@Injectable()
export class PlayerSessionsService {
  constructor(
    @InjectRepository(PlayerSessionEntity)
    private readonly playerSessionsRepository: Repository<PlayerSessionEntity>,
    @InjectRepository(PlayerEntity)
    private readonly playersRepository: Repository<PlayerEntity>,
  ) {}

  async replaceSession(playerId: string, token: string) {
    await this.playerSessionsRepository.delete({ playerId });
    await this.playerSessionsRepository.save(
      this.playerSessionsRepository.create({
        playerId,
        token,
      }),
    );
  }

  async findPlayerByToken(token: string) {
    const session = await this.playerSessionsRepository.findOne({
      where: { token },
    });
    if (!session) {
      return null;
    }

    return this.playersRepository.findOne({
      where: { id: session.playerId },
      relations: {
        items: {
          socketedItems: true,
        },
      },
    });
  }
}
