export interface IStorageService {
  upload(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    ext: string,
  ): Promise<string>;
  getUrl(objectName: string): Promise<string>;
  delete(objectName: string): Promise<void>;
}
