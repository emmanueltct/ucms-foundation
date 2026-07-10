import { Test } from '@nestjs/testing';
import { BranchScopeService } from '../src/common/branch-scope/branch-scope.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { BranchesService } from '../src/branches/branches.service';

describe('BranchScopeService', () => {
  let service: BranchScopeService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    user: { findFirst: jest.fn() },
  };

  const mockBranchesService = {
    findDescendants: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchScopeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BranchesService, useValue: mockBranchesService },
      ],
    }).compile();
    service = moduleRef.get(BranchScopeService);
  });

  it('returns null (unrestricted) when the user has no assignedBranchId', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: null });

    const result = await service.resolveVisibleBranchIds(TENANT_ID, 'user-1');

    expect(result).toBeNull();
    expect(mockBranchesService.findDescendants).not.toHaveBeenCalled();
  });

  it('returns null when the user does not exist in this tenant', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const result = await service.resolveVisibleBranchIds(TENANT_ID, 'user-1');

    expect(result).toBeNull();
  });

  it('returns the assigned branch plus every descendant when assignedBranchId is set', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: 'branch-diocese' });
    mockBranchesService.findDescendants.mockResolvedValue([{ id: 'branch-district' }, { id: 'branch-parish' }]);

    const result = await service.resolveVisibleBranchIds(TENANT_ID, 'user-1');

    expect(mockBranchesService.findDescendants).toHaveBeenCalledWith(TENANT_ID, 'branch-diocese');
    expect(result).toEqual(['branch-diocese', 'branch-district', 'branch-parish']);
  });
});
