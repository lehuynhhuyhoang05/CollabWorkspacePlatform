import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IStorageService } from './storage.interface';

interface UploadedStorageFile {
  size: number;
  mimetype: string;
  originalname: string;
  buffer: Buffer;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

@ApiTags('Storage')
@ApiBearerAuth('access-token')
@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    @Inject('STORAGE_SERVICE')
    private readonly storage: IStorageService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload file (ảnh, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async upload(
    @UploadedFile() file: UploadedStorageFile | undefined,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const ext = file.originalname.split('.').pop() || 'bin';
    const objectName = await this.storage.upload(
      userId,
      file.buffer,
      file.mimetype,
      ext,
    );
    const url = await this.storage.getUrl(objectName);

    return { objectName, url };
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Xoá file (chỉ owner)' })
  async remove(@Param('key') key: string, @CurrentUser('id') userId: string) {
    if (!key.startsWith(`${userId}/`)) {
      throw new BadRequestException('Bạn chỉ có thể xoá file của chính mình');
    }

    await this.storage.delete(key);
    return { message: 'File deleted' };
  }
}
