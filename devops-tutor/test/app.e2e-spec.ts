import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('DevOps Mentor API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.GEMINI_API_KEY = 'AIzaTestSecretValue';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /health', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ status: 'ok' }));
  });

  it('GET /tutor/config ne divulgue aucune clé', async () => {
    const res = await request(app.getHttpServer())
      .get('/tutor/config')
      .expect(200);
    const body = res.body as { server: unknown; providers: unknown[] };
    expect(JSON.stringify(body)).not.toContain('AIzaTestSecretValue');
    expect(body.server).toMatchObject({ provider: 'gemini' });
    expect(body.providers.length).toBeGreaterThan(5);
  });

  it('POST /tutor/ask valide le message', () => {
    return request(app.getHttpServer())
      .post('/tutor/ask')
      .send({ message: '' })
      .expect(400);
  });
});
