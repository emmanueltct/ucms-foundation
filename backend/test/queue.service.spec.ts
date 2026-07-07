import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueService } from '../src/queue/queue.service';
import { QUEUE_NAMES } from '../src/queue/queue.constants';

describe('QueueService', () => {
  let service: QueueService;

  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [QueueService, { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: mockQueue }],
    }).compile();
    service = moduleRef.get(QueueService);
  });

  it('enqueues a notification job with retry/backoff options', async () => {
    mockQueue.add.mockResolvedValue({ id: 'job-1' });

    await service.enqueueNotification({
      notificationId: 'notif-1',
      tenantId: 'tenant-1',
      channel: 'email',
      recipient: 'member@demo-church.test',
      body: 'Service starts at 9am',
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ tenantId: 'tenant-1', channel: 'email' }),
      expect.objectContaining({ attempts: 3 }),
    );
  });
});
