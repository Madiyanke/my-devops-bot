import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class AppService {
  private openai: OpenAI;
  private readonly logger = new Logger(AppService.name);

  constructor(private configService: ConfigService) {
    // 1. Définition du Proxy
    // Correction Linter : On passe à la ligne pour respecter la largeur max
    const proxyUrl =
      this.configService.get<string>('HTTPS_PROXY') ||
      'http://cache.univ-pau.fr:3128';

    // 2. Création de l'Agent Proxy
    const agent = new HttpsProxyAgent(proxyUrl);

    this.logger.log(`OpenAI initialisé avec le proxy : ${proxyUrl}`);

    // 3. Configuration OpenAI
    // Correction TS : "as any" force TypeScript à accepter httpAgent
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      httpAgent: agent,
      imeout: 300 * 1000,
    } as any);
  }

  async getDevOpsAdvice(userQuestion: string): Promise<string> {
    try {
      const systemPrompt = `
        Tu es un Expert DevOps Senior et un excellent pédagogue.
        Ta mission : Aider des développeurs juniors ou intermédiaires à comprendre les concepts DevOps.
        
        Règles :
        1. Ton ton doit être encourageant, clair et empathique.
        2. Utilise des analogies simples.
        3. Ne donne pas juste du code, explique le "pourquoi".
        4. À la fin, fournis une section "📚 Pour aller plus loin" avec 2 liens.
      `;

      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuestion },
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("Réponse vide de l'IA");
      }
      return content;
    } catch (error) {
      this.logger.error('Erreur OpenAI', error);
      if (error instanceof Error) {
        this.logger.error(error.message);
      }
      throw new Error(
        'Désolé, je ne peux pas accéder à ma base de connaissances (Erreur Proxy/OpenAI).',
      );
    }
  }
}
