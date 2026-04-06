# SKILL thêm — Storage Abstraction Layer
# Thêm vào .agent/SKILLS.md

## Skill 9: Storage Service — hoạt động cả local (MinIO) và production (Oracle OCI)

Dùng pattern Strategy — cùng interface, 2 implementation.
Config tự động chọn theo `STORAGE_TYPE` env var.

### storage.interface.ts
```typescript
export interface IStorageService {
  upload(userId: string, buffer: Buffer, mimeType: string, ext: string): Promise<string>;
  getUrl(objectName: string): Promise<string>;
  delete(objectName: string): Promise<void>;
}
```

### minio-storage.service.ts (local dev)
```typescript
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
      endPoint: config.get('MINIO_ENDPOINT'),
      port: parseInt(config.get('MINIO_PORT')),
      useSSL: config.get('MINIO_USE_SSL') === 'true',
      accessKey: config.get('MINIO_ACCESS_KEY'),
      secretKey: config.get('MINIO_SECRET_KEY'),
    });
    this.bucket = config.get('MINIO_BUCKET_NAME');
  }

  async upload(userId: string, buffer: Buffer, mimeType: string, ext: string): Promise<string> {
    const objectName = `${userId}/${uuidv4()}.${ext}`;
    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, { 'Content-Type': mimeType });
    return objectName;
  }

  async getUrl(objectName: string): Promise<string> {
    // Pre-signed URL hết hạn sau 1 giờ
    return this.client.presignedGetObject(this.bucket, objectName, 3600);
  }

  async delete(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
  }
}
```

### oci-storage.service.ts (production Oracle)
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as common from 'oci-common';
import * as os from 'oci-objectstorage';
import { v4 as uuidv4 } from 'uuid';
import { IStorageService } from './storage.interface';

@Injectable()
export class OciStorageService implements IStorageService {
  private client: os.ObjectStorageClient;
  private namespace: string;
  private bucket: string;

  constructor(private config: ConfigService) {
    const provider = new common.SimpleAuthenticationDetailsProvider(
      config.get('OCI_TENANCY_OCID'),
      config.get('OCI_USER_OCID'),
      config.get('OCI_FINGERPRINT'),
      config.get('OCI_PRIVATE_KEY'),
      null,
      common.Region.fromRegionId(config.get('OCI_REGION')),
    );
    this.client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });
    this.namespace = config.get('OCI_NAMESPACE');
    this.bucket = config.get('OCI_BUCKET_NAME');
  }

  async upload(userId: string, buffer: Buffer, mimeType: string, ext: string): Promise<string> {
    const objectName = `${userId}/${uuidv4()}.${ext}`;
    await this.client.putObject({
      namespaceName: this.namespace,
      bucketName: this.bucket,
      objectName,
      putObjectBody: buffer,
      contentType: mimeType,
    });
    return objectName;
  }

  async getUrl(objectName: string): Promise<string> {
    const response = await this.client.createPreauthenticatedRequest({
      namespaceName: this.namespace,
      bucketName: this.bucket,
      createPreauthenticatedRequestDetails: {
        name: `par-${Date.now()}`,
        objectName,
        accessType: os.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectRead,
        timeExpires: new Date(Date.now() + 3600 * 1000),
      },
    });
    return `https://objectstorage.${this.config.get('OCI_REGION')}.oraclecloud.com${response.preauthenticatedRequest.accessUri}`;
  }

  async delete(objectName: string): Promise<void> {
    await this.client.deleteObject({
      namespaceName: this.namespace,
      bucketName: this.bucket,
      objectName,
    });
  }
}
```

### storage.module.ts — tự chọn implementation theo env
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MinioStorageService } from './minio-storage.service';
import { OciStorageService } from './oci-storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [
    {
      provide: 'STORAGE_SERVICE',
      useFactory: (config: ConfigService) => {
        const type = config.get('STORAGE_TYPE'); // 'minio' | 'oci'
        if (type === 'oci') return new OciStorageService(config);
        return new MinioStorageService(config); // default: minio (local)
      },
      inject: [ConfigService],
    },
  ],
  exports: ['STORAGE_SERVICE'],
})
export class StorageModule {}
```

### Dùng trong service khác
```typescript
// Inject bằng token string
constructor(
  @Inject('STORAGE_SERVICE') private readonly storage: IStorageService,
) {}

// Dùng
const objectName = await this.storage.upload(userId, buffer, 'image/jpeg', 'jpg');
const url = await this.storage.getUrl(objectName);
```
