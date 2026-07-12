import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { LeadershipScopeService } from '../src/common/leadership-scope/leadership-scope.service';
import { AuthenticatedUser } from '../src/common/interfaces/request-context.interface';

describe('UsersService', () => {
  let service: UsersService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    role: { count: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
  };

  const mockAudit = { record: jest.fn() };
  const mockLeadershipScope = { isLeaderOf: jest.fn() };

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
    mockLeadershipScope.isLeaderOf.mockResolvedValue(false);
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LeadershipScopeService, useValue: mockLeadershipScope },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('create', () => {
    const newUserDto = { email: 'new@example.com', password: 'Password1', firstName: 'New', lastName: 'User' };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // email not taken
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user' });
    });

    // bcrypt.hash is real (not mocked) in this describe block, same as
    // AuthService's register/login tests — occasionally exceeds Jest's
    // 5000ms default under CPU load during a full-suite run; bumped to
    // match mfa.service.spec.ts's existing convention.
    it('a caller with user.create may register any user, unrestricted', async () => {
      const caller = { ...fullAccessUser, permissions: ['user.create'] };

      await expect(service.create(TENANT_ID, { ...newUserDto }, caller)).resolves.toBeDefined();
      expect(mockLeadershipScope.isLeaderOf).not.toHaveBeenCalled();
    }, 15000);

    it('a platform admin may register any user, unrestricted', async () => {
      const platformAdmin = { ...fullAccessUser, permissions: [], isPlatformAdmin: true };

      await expect(service.create(TENANT_ID, { ...newUserDto }, platformAdmin)).resolves.toBeDefined();
    }, 15000);

    it('rejects a caller with neither user.create nor a branch leadership appointment', async () => {
      const strangerUser = { ...fullAccessUser, permissions: [] };

      await expect(
        service.create(TENANT_ID, { ...newUserDto, assignedBranchId: 'branch-1' }, strangerUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a Branch Administrator who omits assignedBranchId entirely', async () => {
      const branchAdmin = { ...fullAccessUser, permissions: [] };
      mockLeadershipScope.isLeaderOf.mockResolvedValue(true);

      await expect(service.create(TENANT_ID, { ...newUserDto }, branchAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a Branch Administrator targeting a branch they do not lead', async () => {
      const branchAdmin = { ...fullAccessUser, permissions: [] };
      mockLeadershipScope.isLeaderOf.mockResolvedValue(false);

      await expect(
        service.create(TENANT_ID, { ...newUserDto, assignedBranchId: 'someone-elses-branch' }, branchAdmin),
      ).rejects.toThrow(ForbiddenException);
      expect(mockLeadershipScope.isLeaderOf).toHaveBeenCalledWith(TENANT_ID, branchAdmin.userId, 'branch', 'someone-elses-branch');
    });

    it('allows a Branch Administrator to register a user into a branch they lead', async () => {
      const branchAdmin = { ...fullAccessUser, permissions: [] };
      mockLeadershipScope.isLeaderOf.mockResolvedValue(true);

      const result = await service.create(TENANT_ID, { ...newUserDto, assignedBranchId: 'my-branch' }, branchAdmin);

      expect(mockLeadershipScope.isLeaderOf).toHaveBeenCalledWith(TENANT_ID, branchAdmin.userId, 'branch', 'my-branch');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assignedBranchId: 'my-branch' }) }),
      );
      expect(result).toBeDefined();
    }, 15000);
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

  describe('forcePasswordReset', () => {
    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'target-1', deletedAt: null });
      mockPrisma.user.update.mockResolvedValue({ id: 'target-1' });
    });

    // bcrypt.hash is real (not mocked) here, same as AuthService's register/
    // login tests — occasionally exceeds Jest's 5000ms default under CPU
    // load during a full-suite run; bumped to match mfa.service.spec.ts's
    // existing convention for its own CPU-bound (QR code) test.
    it('generates a new temporary password, hashes it, and returns the plaintext once', async () => {
      const result = await service.forcePasswordReset(TENANT_ID, 'target-1', fullAccessUser);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'target-1', tenantId: TENANT_ID } }),
      );
      expect(typeof result.temporaryPassword).toBe('string');
      expect(result.temporaryPassword.length).toBeGreaterThan(0);
      expect(result.user).toEqual({ id: 'target-1' });
    }, 15000);

    it("revokes every active refresh token for the user", async () => {
      await service.forcePasswordReset(TENANT_ID, 'target-1', fullAccessUser);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'target-1', tenantId: TENANT_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    }, 15000);

    it('audits the action when an actorUserId is given (tenant-scoped caller)', async () => {
      await service.forcePasswordReset(TENANT_ID, 'target-1', fullAccessUser);

      expect(mockAudit.record).toHaveBeenCalledWith(TENANT_ID, 'admin-1', 'user.password_force_reset', 'User', 'target-1');
    }, 15000);

    it('skips auditing when no actorUserId is given (cross-tenant Platform Admin caller)', async () => {
      await service.forcePasswordReset(TENANT_ID, 'target-1');

      expect(mockAudit.record).not.toHaveBeenCalled();
    }, 15000);

    it('is unrestricted (no delegation check) when no caller is given, matching the cross-tenant Platform Admin path', async () => {
      await expect(service.forcePasswordReset(TENANT_ID, 'target-1')).resolves.toBeDefined();
    }, 15000);
  });

  describe('department-delegated account management (deactivate/activate/lock/unlock/moveDepartment)', () => {
    const targetSelectResult = { id: 'target-1', deletedAt: null, assignedDepartmentRecordId: 'dept-1' };

    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue(targetSelectResult);
      mockPrisma.user.update.mockResolvedValue({ id: 'target-1' });
    });

    const leaderUser: AuthenticatedUser = { ...fullAccessUser, userId: 'leader-1', permissions: [] };
    const strangerUser: AuthenticatedUser = { ...fullAccessUser, userId: 'stranger-1', permissions: [] };

    function mockCallerRecord(record: { assignedDepartmentRecordId: string | null; departmentRole: string | null }) {
      mockPrisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.id === leaderUser.userId || where.id === strangerUser.userId) return record;
        return targetSelectResult;
      });
    }

    it('a caller with user.update may deactivate/activate/lock/unlock/move any user, unrestricted', async () => {
      await expect(service.deactivate(TENANT_ID, 'target-1', fullAccessUser)).resolves.toBeDefined();
      await expect(service.activate(TENANT_ID, 'target-1', fullAccessUser)).resolves.toBeDefined();
      await expect(service.lock(TENANT_ID, 'target-1', 'suspicious activity', fullAccessUser)).resolves.toBeDefined();
      await expect(service.unlock(TENANT_ID, 'target-1', fullAccessUser)).resolves.toBeDefined();
      await expect(service.moveDepartment(TENANT_ID, 'target-1', 'dept-2', fullAccessUser)).resolves.toBeDefined();
    });

    it('rejects a caller with no user.update and no department leadership at all', async () => {
      mockCallerRecord({ assignedDepartmentRecordId: null, departmentRole: null });

      await expect(service.deactivate(TENANT_ID, 'target-1', strangerUser)).rejects.toThrow(ForbiddenException);
      await expect(service.lock(TENANT_ID, 'target-1', undefined, strangerUser)).rejects.toThrow(ForbiddenException);
    });

    it('allows a department leader to manage staff within their own department', async () => {
      mockCallerRecord({ assignedDepartmentRecordId: 'dept-1', departmentRole: 'leader' });

      await expect(service.deactivate(TENANT_ID, 'target-1', leaderUser)).resolves.toBeDefined();
      await expect(service.lock(TENANT_ID, 'target-1', 'left the church', leaderUser)).resolves.toBeDefined();
      await expect(service.moveDepartment(TENANT_ID, 'target-1', 'dept-2', leaderUser)).resolves.toBeDefined();
    });

    it('rejects a department leader acting on a user outside their own department', async () => {
      mockCallerRecord({ assignedDepartmentRecordId: 'dept-other', departmentRole: 'leader' });

      await expect(service.deactivate(TENANT_ID, 'target-1', leaderUser)).rejects.toThrow(ForbiddenException);
    });

    it('lock revokes every active refresh token and records the reason', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(targetSelectResult);

      await service.lock(TENANT_ID, 'target-1', 'compromised password', fullAccessUser);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { lockedAt: expect.any(Date), lockedReason: 'compromised password' } }),
      );
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'target-1', tenantId: TENANT_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockAudit.record).toHaveBeenCalledWith(
        TENANT_ID, fullAccessUser.userId, 'user.locked', 'User', 'target-1', { metadata: { reason: 'compromised password' } },
      );
    });

    it('unlock clears lockedAt/lockedReason', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(targetSelectResult);

      await service.unlock(TENANT_ID, 'target-1', fullAccessUser);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { lockedAt: null, lockedReason: null } }),
      );
    });

    it('moveDepartment clears the department (and resets departmentRole) when given null', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(targetSelectResult);

      await service.moveDepartment(TENANT_ID, 'target-1', null, fullAccessUser);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { assignedDepartmentRecordId: null, departmentRole: null } }),
      );
    });
  });
});
