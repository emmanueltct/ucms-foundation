import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../src/storage/storage.service';

const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/object'),
}));

describe('StorageService', () => {
  let service: StorageService;

  const mockConfig = { get: jest.fn((key: string, fallback?: string) => fallback) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [StorageService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();
    service = moduleRef.get(StorageService);
  });

  it('uploads an object and returns its key', async () => {
    const result = await service.uploadObject('tenants/t1/logos/logo.png', Buffer.from('x'), 'image/png');

    expect(mockSend).toHaveBeenCalled();
    expect(result).toEqual({ key: 'tenants/t1/logos/logo.png' });
  });

  it('produces a signed download URL', async () => {
    const url = await service.getSignedDownloadUrl('tenants/t1/receipts/r1.pdf');

    expect(url).toBe('https://signed.example/object');
  });

  it('deletes an object', async () => {
    await service.deleteObject('tenants/t1/logos/logo.png');

    expect(mockSend).toHaveBeenCalled();
  });
});
