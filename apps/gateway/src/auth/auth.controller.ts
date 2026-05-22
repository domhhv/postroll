import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  type RegisterResponse,
  registerRequestSchema,
  registerResponseSchema,
} from '@postroll/contracts';
// biome-ignore lint/style/useImportType: needed for the decorator
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: unknown): Promise<RegisterResponse> {
    const input = registerRequestSchema.parse(body);
    return registerResponseSchema.parse(await this.authService.register(input));
  }
}
