import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // JWT (required)
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  REFRESH_LIMIT: Joi.number().min(1).default(8),
  REFRESH_TTL_MS: Joi.number().min(1000).default(60000),

  // Database
  DB_TYPE: Joi.string().valid('postgres', 'oracle').default('postgres'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().default('collab_user'),
  DB_PASSWORD: Joi.string().default('collab_pass'),
  DB_NAME: Joi.string().default('collab_workspace'),
  DB_SYNCHRONIZE: Joi.string().valid('true', 'false').default('false'),
  DB_LOGGING: Joi.string().valid('true', 'false').default('false'),

  // Oracle (required only if DB_TYPE=oracle; allow empty values for postgres mode)
  ORACLE_USER: Joi.string().when('DB_TYPE', {
    is: 'oracle',
    then: Joi.required(),
    otherwise: Joi.allow('').optional(),
  }),
  ORACLE_PASSWORD: Joi.string().when('DB_TYPE', {
    is: 'oracle',
    then: Joi.required(),
    otherwise: Joi.allow('').optional(),
  }),
  ORACLE_CONNECTION_STRING: Joi.string().when('DB_TYPE', {
    is: 'oracle',
    then: Joi.required(),
    otherwise: Joi.allow('').optional(),
  }),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // Storage
  STORAGE_TYPE: Joi.string().valid('minio', 'oci').default('minio'),
  MINIO_ENDPOINT: Joi.string().default('localhost'),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_USE_SSL: Joi.string().valid('true', 'false').default('false'),
  MINIO_ACCESS_KEY: Joi.string().default('minioadmin'),
  MINIO_SECRET_KEY: Joi.string().default('minioadmin123'),
  MINIO_BUCKET_NAME: Joi.string().default('collab-workspace'),

  // CORS
  FRONTEND_URL: Joi.string().default('http://localhost:3001'),
});
