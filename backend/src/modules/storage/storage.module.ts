import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MinioStorageService } from './minio-storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [
    {
      provide: 'STORAGE_SERVICE',
      useFactory: (config: ConfigService) => {
        const type = config.get<string>('STORAGE_TYPE', 'minio');
        // Phase 2: add OCI storage service when deploying to Oracle Cloud
        // if (type === 'oci') return new OciStorageService(config);
        return new MinioStorageService(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: ['STORAGE_SERVICE'],
})
export class StorageModule {}
