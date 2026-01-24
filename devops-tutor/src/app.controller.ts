import { Body, Controller, Post, ValidationPipe, UsePipes } from '@nestjs/common';
import { AppService } from './app.service';
import { ChatDto } from './dtos/chat.dto';

@Controller('tutor')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('ask')
  @UsePipes(new ValidationPipe())
  async askTutor(@Body() chatDto: ChatDto) {
    const response = await this.appService.getDevOpsAdvice(chatDto.message);
    return {
      tutor_response: response,
    };
  }
}