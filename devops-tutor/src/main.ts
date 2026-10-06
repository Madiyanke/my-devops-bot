import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LlmService } from './llm/llm.service';
import { PROVIDERS } from './llm/llm.catalog';
import { ResearchService } from './research/research.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');
  const server = app.get(LlmService).serverConfig();
  logger.log(
    server
      ? `IA serveur : ${PROVIDERS[server.provider].label} (${server.model})`
      : 'Aucune clé IA côté serveur : les utilisateurs devront fournir la leur.',
  );
  const engines = app
    .get(ResearchService)
    .enabledProviders()
    .map((p) => p.label);
  logger.log(`Moteurs de recherche : ${engines.join(', ')}`);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
