import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { HealthController } from './health.controller';
import { LlmService } from './llm/llm.service';
import { ResearchService } from './research/research.service';
import { TutorController } from './tutor/tutor.controller';
import { TutorService } from './tutor/tutor.service';

@Module({
  imports: [
    // Configuration des variables d'environnement (.env)
    ConfigModule.forRoot({ isGlobal: true }),

    // Module de Monitoring (expose /metrics pour Prometheus)
    PrometheusModule.register(),
  ],
  controllers: [TutorController, HealthController],
  providers: [
    LlmService,
    ResearchService,
    TutorService,
    makeCounterProvider({
      name: 'tutor_questions_total',
      help: 'Questions traitées, par fournisseur IA et issue',
      labelNames: ['provider', 'outcome'],
    }),
    makeHistogramProvider({
      name: 'tutor_answer_duration_seconds',
      help: 'Durée totale de réponse (recherche + synthèse)',
      labelNames: ['provider'],
      buckets: [2, 5, 10, 20, 30, 45, 60, 90, 120, 180],
    }),
  ],
})
export class AppModule {}
