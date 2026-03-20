import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  ClassSerializerInterceptor,
  Logger,
  VersioningType,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ──── Global Prefix ────
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'], // Health check at root /health
  });

  // ──── Security ────
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ──── Global Pipes ────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ──── Global Interceptors & Filters ────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)), // Makes @Exclude() work
    new TransformInterceptor(),
  );

  // ──── Swagger API Documentation ────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Collaborative Workspace API')
      .setDescription(
        'Nền tảng ghi chú và cộng tác theo nhóm — API Documentation',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT access token',
          in: 'header',
        },
        'access-token',
      )
      .addTag('Auth', 'Đăng ký, đăng nhập, refresh token')
      .addTag('Users', 'Quản lý profile')
      .addTag('Workspaces', 'Quản lý workspace & members')
      .addTag('Pages', 'Quản lý pages & version history')
      .addTag('Blocks', 'Quản lý blocks (Tiptap content)')
      .addTag('Comments', 'Comments trên blocks')
      .addTag('Search', 'Full-text search')
      .addTag('Storage', 'Upload & quản lý files')
      .addTag('Health', 'Health check')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
    logger.log(`📖 Swagger UI available at http://localhost:${process.env.PORT || 3000}/api/docs`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Application running on http://localhost:${port}`);
  logger.log(`🔗 API prefix: /api/v1`);
}

bootstrap();
