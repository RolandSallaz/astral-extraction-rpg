import { Injectable } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../auth.service';

@Injectable()
export class LoginPlayerUseCase {
  constructor(private readonly authService: AuthService) {}

  execute(input: LoginDto) {
    return this.authService.login(input);
  }
}
