import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('GoodevaDeskBootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Enable Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // OpenAPI / Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('GoodevaDesk API')
    .setDescription(
      'Internal Customer Support Desk API with Multi-Tenant Isolation, LLM Auto-Classification (Gemini & Groq), and Redis Caching.',
    )
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Provide your Organization API Key here',
      },
      'x-api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'GoodevaDesk API Docs',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 GoodevaDesk server is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation available at: http://localhost:${port}/docs`);
}

bootstrap();
