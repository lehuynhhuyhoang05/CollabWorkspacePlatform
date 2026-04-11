import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  ClassSerializerInterceptor,
  Logger,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configuredCorsOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedCorsOrigins = [...configuredCorsOrigins];

  if (process.env.NODE_ENV !== 'production') {
    for (const devOrigin of [
      'http://localhost:3001',
      'http://localhost:5173',
    ]) {
      if (!allowedCorsOrigins.includes(devOrigin)) {
        allowedCorsOrigins.push(devOrigin);
      }
    }
  }

  if (allowedCorsOrigins.length === 0) {
    allowedCorsOrigins.push('http://localhost:3001');
  }

  // ──── Global Prefix ────
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'], // Health check at root /health
  });

  // ──── Security ────
  app.use(helmet());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  logger.log(`CORS origins: ${allowedCorsOrigins.join(', ')}`);

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
      .addTag('Share', 'Chia sẻ trang bằng link token')
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
    logger.log(
      `📖 Swagger UI available at http://localhost:${process.env.PORT || 3000}/api/docs`,
    );
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Application running on http://localhost:${port}`);
  logger.log(`🔗 API prefix: /api/v1`);
}

void bootstrap();
