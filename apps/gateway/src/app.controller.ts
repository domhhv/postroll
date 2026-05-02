import { Controller, Get } from '@nestjs/common';
// biome-ignore lint/style/useImportType: needed for the decorator
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): Promise<string> {
    return this.appService.getHello();
  }
}
