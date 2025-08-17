import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // CORS configuration
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('JoonaPay Compliance Service API')
    .setDescription(
      'Regulatory compliance and verification service for JoonaPay platform. ' +
      'Handles KYC/KYB verification, document processing, sanctions screening, and compliance reporting. ' +
      'Integrates with Jumio, Onfido, WorldCheck, and ComplyAdvantage.'
    )
    .setVersion('1.0.0')
    .setContact('JoonaPay Development Team', 'https://joonapay.com', 'dev@joonapay.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addTag('KYC', 'Know Your Customer verification workflows')
    .addTag('KYB', 'Know Your Business verification workflows')
    .addTag('Documents', 'Document verification and processing')
    .addTag('Sanctions', 'Sanctions screening and watchlist checks')
    .addTag('Compliance', 'Compliance rules and reporting')
    .addTag('Jumio', 'Jumio integration for document verification')
    .addTag('Onfido', 'Onfido integration for identity verification')
    .addTag('WorldCheck', 'WorldCheck integration for sanctions screening')
    .addTag('ComplyAdvantage', 'ComplyAdvantage integration for enhanced screening')
    .addTag('Health', 'Service health and monitoring endpoints')
    .addTag('Metrics', 'Prometheus metrics and performance monitoring')
    .addServer('http://localhost:3003', 'Development server')
    .addServer('https://compliance.joonapay.com', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = configService.get<number>('PORT') || process.env.PORT || 3003;
  
  await app.listen(port);
  
  logger.log(`🚀 JoonaPay Compliance Service is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation available at: http://localhost:${port}/api/docs`);
  logger.log(`🔍 Health check available at: http://localhost:${port}/health`);
  logger.log(`📊 Metrics available at: http://localhost:${port}/metrics`);
}

bootstrap();
