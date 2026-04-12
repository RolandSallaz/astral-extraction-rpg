import { Injectable } from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';
import { AuthService } from '../auth.service';

@Injectable()
export class RegisterPlayerUseCase {
  constructor(private readonly authService: AuthService) {}

  execute(input: RegisterDto) {
    return this.authService.register(input);
  }
}
