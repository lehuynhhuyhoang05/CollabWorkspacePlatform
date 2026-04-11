import { BadRequestException } from '@nestjs/common';
import { StorageController } from './storage.controller';
import type { IStorageService } from './storage.interface';

describe('StorageController', () => {
  let controller: StorageController;
  let storage: jest.Mocked<IStorageService>;

  beforeEach(() => {
    storage = {
      upload: jest.fn(),
      getUrl: jest.fn(),
      delete: jest.fn(),
    };

    controller = new StorageController(storage);
  });

  afterEach(() => jest.clearAllMocks());

  it('upload should reject when file is missing', async () => {
    await expect(controller.upload(undefined as any, 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('upload should reject unsupported mime type', async () => {
    const file = {
      size: 100,
      mimetype: 'application/pdf',
      originalname: 'file.pdf',
      buffer: Buffer.from('x'),
    } as any;

    await expect(controller.upload(file, 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('upload should store file and return objectName/url', async () => {
    const file = {
      size: 100,
      mimetype: 'image/png',
      originalname: 'avatar.png',
      buffer: Buffer.from('img'),
    } as any;

    storage.upload.mockResolvedValueOnce('u1/object.png');
    storage.getUrl.mockResolvedValueOnce('http://signed-url');

    const result = await controller.upload(file, 'u1');

    expect(storage.upload).toHaveBeenCalledWith(
      'u1',
      file.buffer,
      'image/png',
      'png',
    );
    expect(result).toEqual({
      objectName: 'u1/object.png',
      url: 'http://signed-url',
    });
  });

  it('remove should reject deleting key outside user namespace', async () => {
    await expect(controller.remove('other-user/key.png', 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('remove should delete own key', async () => {
    await controller.remove('u1/key.png', 'u1');
    expect(storage.delete).toHaveBeenCalledWith('u1/key.png');
  });
});
