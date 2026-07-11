import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthenticatedUser } from '../src/common/interfaces/request-context.interface';

describe('UsersService', () => {
  let service: UsersService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    user: { findFirst: jest.fn() },
    userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    role: { count: jest.fn() },
  };

  const fullAccessUser: AuthenticatedUser = {
    userId: 'admin-1',
    tenantId: TENANT_ID,
    email: 'admin@example.com',
    isPlatformAdmin: false,
    permissions: ['user.update'],
    roles: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('assignRoles', () => {
    const targetSelectResult = { id: 'target-1', deletedAt: null, assignedDepartmentRecordId: 'dept-1' };

    beforeEach(() => {
      // findOne (via publicSelect) is called twice: once up front, once to return the final result.
      mockPrisma.user.findFirst.mockResolvedValue(targetSelectResult);
    });

    it('a caller with user.update may assign any role to any user, unrestricted', async () => {
      await service.assignRoles(TENANT_ID, 'target-1', ['role-1', 'role-2'], fullAccessUser);

      expect(mockPrisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'target-1' } });
      expect(mockPrisma.userRole.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'target-1', roleId: 'role-1' },
          { userId: 'target-1', roleId: 'role-2' },
        ],
      });
      expect(mockPrisma.role.count).not.toHaveBeenCalled();
    });

    it('a platform admin may assign any role to any user, unrestricted', async () => {
      const platformAdmin = { ...fullAccessUser, permissions: [], isPlatformAdmin: true };

      await expect(service.assignRoles(TENANT_ID, 'target-1', ['role-1'], platformAdmin)).resolves.toBeDefined();
    });

    it('rejects a caller with no user.update and no department leadership at all', async () => {
      const strangerUser: AuthenticatedUser = { ...fullAccessUser, userId: 'stranger-1', permissions: [] };
      mockPrisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.id === 'stranger-1') return { assignedDepartmentRecordId: null, departmentRole: null };
        return targetSelectResult;
      });

      await expect(service.assignRoles(TENANT_ID, 'target-1', ['role-1'], strangerUser)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.userRole.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects a department leader assigning roles to a user outside their own department', async () => {
      const leaderUser: AuthenticatedUser = { ...fullAccessUser, userId: 'leader-1', permissions: [] };
      mockPrisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.id === 'leader-1') return { assignedDepartmentRecordId: 'dept-other', departmentRole: 'leader' };
        return targetSelectResult; // target's department is 'dept-1'
      });

      await expect(service.assignRoles(TENANT_ID, 'target-1', ['role-1'], leaderUser)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a department leader assigning a non-delegable role, even within their own department', async () => {
      const leaderUser: AuthenticatedUser = { ...fullAccessUser, userId: 'leader-1', permissions: [] };
      mockPrisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.id === 'leader-1') return { assignedDepartmentRecordId: 'dept-1', departmentRole: 'leader' };
        return targetSelectResult;
      });
      mockPrisma.role.count.mockResolvedValue(0); // 'role-1' is not delegable

      await expect(service.assignRoles(TENANT_ID, 'target-1', ['role-1'], leaderUser)).rejects.toThrow(ForbiddenException);
    });

    it('allows a department leader to assign a delegable role to staff within their own department', async () => {
      const leaderUser: AuthenticatedUser = { ...fullAccessUser, userId: 'leader-1', permissions: [] };
      mockPrisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.id === 'leader-1') return { assignedDepartmentRecordId: 'dept-1', departmentRole: 'leader' };
        return targetSelectResult;
      });
      mockPrisma.role.count.mockResolvedValue(1); // the one requested role is delegable

      await service.assignRoles(TENANT_ID, 'target-1', ['role-1'], leaderUser);

      expect(mockPrisma.role.count).toHaveBeenCalledWith({ where: { id: { in: ['role-1'] }, tenantId: TENANT_ID, isDelegable: true } });
      expect(mockPrisma.userRole.createMany).toHaveBeenCalled();
    });

    it('rejects department "staff" (not "leader") from assigning roles even within their own department', async () => {
      const staffUser: AuthenticatedUser = { ...fullAccessUser, userId: 'staff-1', permissions: [] };
      mockPrisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.id === 'staff-1') return { assignedDepartmentRecordId: 'dept-1', departmentRole: 'staff' };
        return targetSelectResult;
      });

      await expect(service.assignRoles(TENANT_ID, 'target-1', ['role-1'], staffUser)).rejects.toThrow(ForbiddenException);
    });
  });
});
