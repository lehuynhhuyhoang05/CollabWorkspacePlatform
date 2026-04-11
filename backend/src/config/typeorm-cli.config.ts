import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

const dbType = process.env.DB_TYPE || 'postgres';

const dataSourceOptions: DataSourceOptions =
  dbType === 'oracle'
    ? {
        type: 'oracle',
        username: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD ?? undefined,
        connectString: process.env.ORACLE_CONNECTION_STRING,
        entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        synchronize: false,
        logging: process.env.DB_LOGGING === 'true',
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER || 'collab_user',
        password: process.env.DB_PASSWORD ?? 'collab_pass',
        database: process.env.DB_NAME || 'collab_workspace',
        entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        synchronize: false,
        logging: process.env.DB_LOGGING === 'true',
      };

export default new DataSource(dataSourceOptions);
