import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AppService {
  private openai: OpenAI;
  private readonly logger = new Logger(AppService.name);

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async getDevOpsAdvice(userQuestion: string): Promise<string> {
    try {
      // Le prompt système définit la personnalité de l'IA
      const systemPrompt = `
        Tu es un Expert DevOps Senior et un excellent pédagogue.
        Ta mission : Aider des développeurs juniors ou intermédiaires à comprendre les concepts DevOps (CI/CD, Docker, K8s, AWS, Terraform, Monitoring).
        
        Règles à suivre impérativement :
        1. Ton ton doit être encourageant, clair et empathique.
        2. Utilise des analogies simples pour expliquer des concepts complexes (ex: conteneurs vs machines virtuelles).
        3. Ne donne pas juste du code, explique le "pourquoi" et le "comment".
        4. À la toute fin de ta réponse, tu DOIS fournir une section "📚 Pour aller plus loin" avec 2 ou 3 liens vers des ressources de qualité (documentation officielle, tutoriels reconnus, articles de blog fiables).
      `;

      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuestion },
        ],
        model: 'gpt-3.5-turbo', // Ou 'gpt-3.5-turbo' pour réduire les coûts
        temperature: 0.7, // Créativité modérée pour rester pédagogique mais précis
      });

      // Correction : garantir que le retour n'est jamais null
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("Réponse vide de l'IA");
      }
      return content;
    } catch (error) {
      this.logger.error('Erreur OpenAI', error);
      throw new Error(
        'Désolé, je ne peux pas accéder à ma base de connaissances pour le moment.',
      );
    }
  }
}
