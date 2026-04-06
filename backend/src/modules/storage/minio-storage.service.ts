import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { IStorageService } from './storage.interface';

@Injectable()
export class MinioStorageService implements IStorageService {
  private client: Minio.Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(config.get<string>('MINIO_PORT', '9000')),
      useSSL: config.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin123'),
    });
    this.bucket = config.get<string>('MINIO_BUCKET_NAME', 'collab-workspace');
  }

  async upload(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    ext: string,
  ): Promise<string> {
    const objectName = `${userId}/${uuidv4()}.${ext}`;
    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return objectName;
  }

  async getUrl(objectName: string): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectName, 3600);
  }

  async delete(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
  }
}
