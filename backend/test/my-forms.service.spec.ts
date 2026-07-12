import { Test } from '@nestjs/testing';
import { MyFormsService } from '../src/my-forms/my-forms.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EligibilityResolverService } from '../src/common/eligibility/eligibility-resolver.service';

describe('MyFormsService', () => {
  let service: MyFormsService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    dynamicModuleDefinition: { findFirst: jest.fn() },
    dynamicModuleRecord: { findMany: jest.fn() },
    visitor: { findMany: jest.fn() },
    member: { findMany: jest.fn() },
  };
  const mockEligibilityResolver = { resolveResourcesFor: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([]);
    mockPrisma.visitor.findMany.mockResolvedValue([]);
    mockPrisma.member.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        MyFormsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EligibilityResolverService, useValue: mockEligibilityResolver },
      ],
    }).compile();
    service = moduleRef.get(MyFormsService);
  });

  it('resolves eligible form resource assignments filtered to the form resourceType', async () => {
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([]);

    await service.list(TENANT_ID, USER_ID);

    expect(mockEligibilityResolver.resolveResourcesFor).toHaveBeenCalledWith(TENANT_ID, USER_ID, 'dynamic_module_definition');
  });

  it('returns one entry per unique form definition, with the definition\'s own label/statuses', async () => {
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([
      { id: 'ra-1', resourceKey: 'form-1', dueAt: null },
    ]);
    mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({
      id: 'form-1', key: 'ict-audit', label: 'ICT Equipment Audit', description: 'Quarterly audit', statuses: ['draft', 'submitted', 'approved'],
    });

    const result = await service.list(TENANT_ID, USER_ID);

    expect(result).toEqual([
      expect.objectContaining({ definitionId: 'form-1', key: 'ict-audit', label: 'ICT Equipment Audit', dueAt: null, myRecords: [] }),
    ]);
  });

  it('skips a resolved assignment whose form definition no longer exists (deleted)', async () => {
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([{ id: 'ra-1', resourceKey: 'deleted-form', dueAt: null }]);
    mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue(null);

    const result = await service.list(TENANT_ID, USER_ID);

    expect(result).toEqual([]);
  });

  it('includes the caller\'s own submitted records for that form, most recent first', async () => {
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([{ id: 'ra-1', resourceKey: 'form-1', dueAt: null }]);
    mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', key: 'ict-audit', label: 'ICT Audit', description: null, statuses: ['draft'] });
    mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([{ id: 'rec-1', status: 'submitted', createdAt: new Date(), updatedAt: new Date() }]);

    const result = await service.list(TENANT_ID, USER_ID);

    expect(mockPrisma.dynamicModuleRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID, moduleDefinitionId: 'form-1', createdByUserId: USER_ID, deletedAt: null } }),
    );
    expect(result[0].myRecords).toHaveLength(1);
  });

  it('deduplicates the same form reached through multiple scopes, keeping the soonest deadline', async () => {
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([
      { id: 'ra-1', resourceKey: 'form-1', dueAt: new Date('2026-08-15T00:00:00.000Z') },
      { id: 'ra-2', resourceKey: 'form-1', dueAt: new Date('2026-08-01T00:00:00.000Z') },
    ]);
    mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', key: 'ict-audit', label: 'ICT Audit', description: null, statuses: ['draft'] });

    const result = await service.list(TENANT_ID, USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].dueAt).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });

  it('keeps a visitor-attached request as its own entry, separate from a generic assignment of the same form', async () => {
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([
      { id: 'ra-1', resourceKey: 'form-1', dueAt: null, scopeEntityType: 'branch', scopeEntityId: 'branch-1' },
      { id: 'ra-2', resourceKey: 'form-1', dueAt: null, scopeEntityType: 'visitor', scopeEntityId: 'visitor-1' },
    ]);
    mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', key: 'follow-up', label: 'Follow-up', description: null, statuses: ['draft'] });
    mockPrisma.visitor.findMany.mockResolvedValue([{ id: 'visitor-1', firstName: 'Jane', lastName: 'Doe' }]);

    const result = await service.list(TENANT_ID, USER_ID);

    expect(result).toHaveLength(2);
    const generic = result.find((r) => r.attachedToEntityType === null);
    const attached = result.find((r) => r.attachedToEntityType === 'visitor');
    expect(generic).toBeDefined();
    expect(attached).toEqual(
      expect.objectContaining({ attachedToEntityType: 'visitor', attachedToEntityId: 'visitor-1', attachedToEntityLabel: 'Jane Doe' }),
    );
  });

  it('keeps two different visitors\' requests for the same form as two separate entries', async () => {
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([
      { id: 'ra-1', resourceKey: 'form-1', dueAt: null, scopeEntityType: 'visitor', scopeEntityId: 'visitor-1' },
      { id: 'ra-2', resourceKey: 'form-1', dueAt: null, scopeEntityType: 'visitor', scopeEntityId: 'visitor-2' },
    ]);
    mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', key: 'follow-up', label: 'Follow-up', description: null, statuses: ['draft'] });
    mockPrisma.visitor.findMany.mockResolvedValue([
      { id: 'visitor-1', firstName: 'Jane', lastName: 'Doe' },
      { id: 'visitor-2', firstName: 'John', lastName: 'Smith' },
    ]);

    const result = await service.list(TENANT_ID, USER_ID);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.attachedToEntityLabel).sort()).toEqual(['Jane Doe', 'John Smith']);
  });

  it('matches completion for an entity-attached request by attachment, not by creator', async () => {
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([
      { id: 'ra-1', resourceKey: 'form-1', dueAt: null, scopeEntityType: 'member', scopeEntityId: 'member-1' },
    ]);
    mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', key: 'pastoral-care', label: 'Pastoral Care', description: null, statuses: ['draft'] });
    mockPrisma.member.findMany.mockResolvedValue([{ id: 'member-1', firstName: 'Alice', lastName: 'Uwase' }]);
    mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([{ id: 'rec-1', status: 'submitted', createdAt: new Date(), updatedAt: new Date() }]);

    const result = await service.list(TENANT_ID, USER_ID);

    expect(mockPrisma.dynamicModuleRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, moduleDefinitionId: 'form-1', attachedToEntityType: 'member', attachedToEntityId: 'member-1', deletedAt: null },
      }),
    );
    expect(result[0].attachedToEntityLabel).toBe('Alice Uwase');
    expect(result[0].myRecords).toHaveLength(1);
  });
});
