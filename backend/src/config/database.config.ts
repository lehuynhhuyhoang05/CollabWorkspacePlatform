import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const dbType = configService.get<string>('DB_TYPE', 'postgres');

  if (dbType === 'oracle') {
    return {
      type: 'oracle',
      username: configService.get<string>('ORACLE_USER'),
      password: configService.get<string>('ORACLE_PASSWORD'),
      connectString: configService.get<string>('ORACLE_CONNECTION_STRING'),
      synchronize: false,
      logging: configService.get<string>('DB_LOGGING') === 'true',
      entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    };
  }

  // Default: PostgreSQL (Phase 1 local development)
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USER', 'collab_user'),
    password: configService.get<string>('DB_PASSWORD', 'collab_pass'),
    database: configService.get<string>('DB_NAME', 'collab_workspace'),
    synchronize:
      configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
    logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
    entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  };
};
