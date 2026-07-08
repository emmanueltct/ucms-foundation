import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomFieldsService } from '../src/custom-fields/custom-fields.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CustomFieldsService', () => {
  let service: CustomFieldsService;

  const TENANT_ID = 'tenant-1';
  const ENTITY_TYPE = 'member';

  const mockPrisma = {
    customFieldDefinition: { findMany: jest.fn() },
    customFieldValue: { findMany: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction = jest.fn((ops: any[]) => Promise.all(ops));
    const moduleRef = await Test.createTestingModule({
      providers: [CustomFieldsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(CustomFieldsService);
  });

  const textField = { id: 'def-1', fieldKey: 'baptism_church', label: 'Baptism Church', fieldType: 'text', options: null, isRequired: false };
  const numberField = { id: 'def-2', fieldKey: 'age_estimate', label: 'Age Estimate', fieldType: 'number', options: null, isRequired: false };
  const booleanField = { id: 'def-3', fieldKey: 'is_baptized', label: 'Is Baptized', fieldType: 'boolean', options: null, isRequired: false };
  const dateField = { id: 'def-4', fieldKey: 'confirmation_date', label: 'Confirmation Date', fieldType: 'date', options: null, isRequired: true };
  const selectField = {
    id: 'def-5',
    fieldKey: 'spiritual_gift',
    label: 'Spiritual Gift',
    fieldType: 'select',
    options: [{ key: 'teaching', label: 'Teaching' }],
    isRequired: false,
  };

  describe('getValues / getValuesForMany', () => {
    it('getValues collapses rows into a fieldKey -> value map', async () => {
      mockPrisma.customFieldValue.findMany.mockResolvedValue([
        { fieldKey: 'baptism_church', value: 'St. Mary' },
        { fieldKey: 'is_baptized', value: true },
      ]);

      const result = await service.getValues(TENANT_ID, ENTITY_TYPE, 'member-1');

      expect(result).toEqual({ baptism_church: 'St. Mary', is_baptized: true });
    });

    it('getValuesForMany short-circuits with no query for an empty id list', async () => {
      const result = await service.getValuesForMany(TENANT_ID, ENTITY_TYPE, []);

      expect(result).toEqual({});
      expect(mockPrisma.customFieldValue.findMany).not.toHaveBeenCalled();
    });

    it('getValuesForMany groups rows by entityId', async () => {
      mockPrisma.customFieldValue.findMany.mockResolvedValue([
        { entityId: 'm1', fieldKey: 'baptism_church', value: 'St. Mary' },
        { entityId: 'm2', fieldKey: 'baptism_church', value: 'St. Joseph' },
      ]);

      const result = await service.getValuesForMany(TENANT_ID, ENTITY_TYPE, ['m1', 'm2']);

      expect(result).toEqual({ m1: { baptism_church: 'St. Mary' }, m2: { baptism_church: 'St. Joseph' } });
    });
  });

  describe('setValues', () => {
    it('rejects a fieldKey with no matching active definition', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([textField]);

      await expect(
        service.setValues(TENANT_ID, ENTITY_TYPE, 'member-1', { not_a_real_field: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['text', textField, 123],
      ['number', numberField, 'not-a-number'],
      ['boolean', booleanField, 'yes'],
      ['date', dateField, 'not-a-date'],
    ] as const)('rejects a %s value with the wrong type', async (_label, field, badValue) => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([field]);

      await expect(
        service.setValues(TENANT_ID, ENTITY_TYPE, 'member-1', { [field.fieldKey]: badValue }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a select value that is not one of the declared options', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([selectField]);

      await expect(
        service.setValues(TENANT_ID, ENTITY_TYPE, 'member-1', { spiritual_gift: 'not_an_option' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts null/undefined without a type check, for clearing an optional field', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([textField]);
      mockPrisma.customFieldValue.upsert.mockResolvedValue({});

      await expect(service.setValues(TENANT_ID, ENTITY_TYPE, 'member-1', { baptism_church: null })).resolves.not.toThrow();
    });

    it('upserts every provided key inside one transaction', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([textField, selectField]);
      mockPrisma.customFieldValue.upsert.mockResolvedValue({});

      await service.setValues(TENANT_ID, ENTITY_TYPE, 'member-1', {
        baptism_church: 'St. Mary',
        spiritual_gift: 'teaching',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.arrayContaining([expect.anything(), expect.anything()]));
      expect(mockPrisma.customFieldValue.upsert).toHaveBeenCalledTimes(2);
    });

    it('is a no-op when values is empty', async () => {
      await service.setValues(TENANT_ID, ENTITY_TYPE, 'member-1', {});

      expect(mockPrisma.customFieldDefinition.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('assertRequiredFieldsProvided', () => {
    it('rejects when a required field is missing entirely', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([dateField]);

      await expect(service.assertRequiredFieldsProvided(TENANT_ID, ENTITY_TYPE, {})).rejects.toThrow(BadRequestException);
    });

    it('rejects when a required field is present but empty', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([dateField]);

      await expect(
        service.assertRequiredFieldsProvided(TENANT_ID, ENTITY_TYPE, { confirmation_date: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes when every required field has a value', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue([dateField, textField]);

      await expect(
        service.assertRequiredFieldsProvided(TENANT_ID, ENTITY_TYPE, { confirmation_date: '2020-06-01' }),
      ).resolves.not.toThrow();
    });
  });
});
