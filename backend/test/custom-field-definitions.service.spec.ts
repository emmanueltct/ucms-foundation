import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CustomFieldDefinitionsService } from '../src/custom-fields/custom-field-definitions.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CustomFieldDefinitionsService', () => {
  let service: CustomFieldDefinitionsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    customFieldDefinition: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [CustomFieldDefinitionsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(CustomFieldDefinitionsService);
  });

  describe('create', () => {
    it.each(['select', 'radio', 'multiselect'])('rejects a "%s" field with no options', async (fieldType) => {
      await expect(
        service.create(TENANT_ID, { entityType: 'member', fieldKey: 'gift', label: 'Gift', fieldType } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a "lookup" field with no lookupEntityType', async () => {
      await expect(
        service.create(TENANT_ID, { entityType: 'member', fieldKey: 'emergency_contact', label: 'Emergency Contact', fieldType: 'lookup' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a lookup field when lookupEntityType is provided', async () => {
      mockPrisma.customFieldDefinition.findUnique.mockResolvedValue(null);
      mockPrisma.customFieldDefinition.create.mockResolvedValue({ id: 'cf-2' });

      await service.create(TENANT_ID, {
        entityType: 'member',
        fieldKey: 'emergency_contact',
        label: 'Emergency Contact',
        fieldType: 'lookup',
        lookupEntityType: 'member',
      } as any);

      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lookupEntityType: 'member' }) }),
      );
    });

    it('rejects a duplicate (entityType, fieldKey) pair within the tenant', async () => {
      mockPrisma.customFieldDefinition.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(TENANT_ID, { entityType: 'member', fieldKey: 'confirmation_date', label: 'Confirmation', fieldType: 'date' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a text field when the key is free', async () => {
      mockPrisma.customFieldDefinition.findUnique.mockResolvedValue(null);
      mockPrisma.customFieldDefinition.create.mockResolvedValue({ id: 'cf-1' });

      await service.create(TENANT_ID, { entityType: 'member', fieldKey: 'baptism_church', label: 'Baptism Church', fieldType: 'text' } as any);

      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID, fieldKey: 'baptism_church' }) }),
      );
    });
  });

  describe('update', () => {
    it('rejects clearing the options of an existing "select" field down to empty', async () => {
      mockPrisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'cf-1', tenantId: TENANT_ID, fieldType: 'select' });

      await expect(service.update(TENANT_ID, 'cf-1', { options: [] } as any)).rejects.toThrow(BadRequestException);
    });

    it('allows updating the label without touching options', async () => {
      mockPrisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'cf-1', tenantId: TENANT_ID, fieldType: 'text' });
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'cf-1', label: 'New Label' });

      await service.update(TENANT_ID, 'cf-1', { label: 'New Label' } as any);

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ label: 'New Label' }) }),
      );
    });
  });

  describe('deactivate / reactivate', () => {
    it('soft-toggles isActive rather than deleting the row', async () => {
      mockPrisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'cf-1', tenantId: TENANT_ID });
      mockPrisma.customFieldDefinition.update.mockResolvedValue({ id: 'cf-1', isActive: false });

      const result = await service.deactivate(TENANT_ID, 'cf-1');

      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith({ where: { id: 'cf-1' }, data: { isActive: false } });
      expect(result.isActive).toBe(false);
    });
  });
});
