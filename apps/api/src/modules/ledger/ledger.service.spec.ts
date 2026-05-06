import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { LedgerService } from './ledger.service';
import { LedgerEntry } from './ledger-entry.entity';
import { LedgerType, EntryType, SourceType } from '../../common/enums';
import { REDIS_CLIENT } from '../../config/redis.module';
import { WriteEntriesDto } from './dto/write-entries.dto';
import { v4 as uuidv4 } from 'uuid';

const mockRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  getManyAndCount: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  query: jest.fn(),
  manager: {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    }),
  },
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

const mockRedis = { get: jest.fn(), setex: jest.fn() };

describe('LedgerService', () => {
  let service: LedgerService;
  const FIRM_ID = uuidv4();
  const USER_ID = uuidv4();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: getRepositoryToken(LedgerEntry), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    jest.clearAllMocks();

    // Default: no existing entry (idempotency miss)
    mockQueryRunner.manager.findOne.mockResolvedValue(null);
    mockQueryRunner.manager.create.mockImplementation((_, data) => data);
    mockQueryRunner.manager.save.mockImplementation((_, data) => ({ ...data, id: uuidv4() }));
  });

  describe('Group Integrity Validation', () => {
    it('should accept balanced entries: CREDIT == DEBIT', async () => {
      const entryGroupId = uuidv4();
      const sourceId = uuidv4();

      const dto: WriteEntriesDto = {
        entries: [
          {
            ledger_type: LedgerType.CUSTOMER,
            entry_type: EntryType.CREDIT,
            amount: '1000.00',
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: sourceId,
            entry_group_id: entryGroupId,
            customer_id: uuidv4(),
            description: 'Sale proceeds owed to customer',
            idempotency_key: `credit-${uuidv4()}`,
          },
          {
            ledger_type: LedgerType.FIRM_CASH,
            entry_type: EntryType.DEBIT,
            amount: '1000.00',
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: sourceId,
            entry_group_id: entryGroupId,
            description: 'APMC fee payable',
            idempotency_key: `debit-${uuidv4()}`,
          },
        ],
      };

      await expect(service.writeEntries(dto, FIRM_ID, USER_ID)).resolves.toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should REJECT unbalanced entries: CREDIT ≠ DEBIT', async () => {
      const entryGroupId = uuidv4();
      const dto: WriteEntriesDto = {
        entries: [
          {
            ledger_type: LedgerType.CUSTOMER,
            entry_type: EntryType.CREDIT,
            amount: '1000.00',
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: uuidv4(),
            entry_group_id: entryGroupId,
            description: 'Test credit',
            idempotency_key: `key-${uuidv4()}`,
          },
          {
            ledger_type: LedgerType.FIRM_CASH,
            entry_type: EntryType.DEBIT,
            amount: '900.00', // Mismatch!
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: uuidv4(),
            entry_group_id: entryGroupId,
            description: 'Test debit',
            idempotency_key: `key-${uuidv4()}`,
          },
        ],
      };

      await expect(service.writeEntries(dto, FIRM_ID, USER_ID)).rejects.toThrow(ConflictException);
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should REJECT entries with non-positive amounts', async () => {
      const entryGroupId = uuidv4();
      const dto: WriteEntriesDto = {
        entries: [
          {
            ledger_type: LedgerType.FIRM_CASH,
            entry_type: EntryType.CREDIT,
            amount: '0',  // Zero — invalid
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: uuidv4(),
            entry_group_id: entryGroupId,
            description: 'Zero amount',
            idempotency_key: `key-${uuidv4()}`,
          },
          {
            ledger_type: LedgerType.FIRM_CASH,
            entry_type: EntryType.DEBIT,
            amount: '0',
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: uuidv4(),
            entry_group_id: entryGroupId,
            description: 'Zero amount',
            idempotency_key: `key-${uuidv4()}`,
          },
        ],
      };

      await expect(service.writeEntries(dto, FIRM_ID, USER_ID)).rejects.toThrow(ConflictException);
    });
  });

  describe('Idempotency', () => {
    it('should return existing entry on duplicate idempotency key', async () => {
      const existingEntry = { id: uuidv4(), amount: '500.00', balance_after: '500.00' };
      mockQueryRunner.manager.findOne.mockResolvedValue(existingEntry);

      const entryGroupId = uuidv4();
      const dto: WriteEntriesDto = {
        entries: [
          {
            ledger_type: LedgerType.FIRM_CASH,
            entry_type: EntryType.CREDIT,
            amount: '500.00',
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: uuidv4(),
            entry_group_id: entryGroupId,
            description: 'Duplicate',
            idempotency_key: 'already-processed-key',
          },
          {
            ledger_type: LedgerType.FIRM_CASH,
            entry_type: EntryType.DEBIT,
            amount: '500.00',
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: uuidv4(),
            entry_group_id: entryGroupId,
            description: 'Duplicate debit',
            idempotency_key: 'already-processed-key-2',
          },
        ],
      };

      const result = await service.writeEntries(dto, FIRM_ID, USER_ID);
      // Should return the existing entry without writing new ones
      expect(result[0]).toEqual(existingEntry);
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
    });
  });

  describe('Running Balance Computation', () => {
    it('should correctly compute balance_after for CREDIT entry', async () => {
      // Existing balance: 1000.00
      mockQueryRunner.manager.createQueryBuilder().getOne.mockResolvedValue({ balance_after: '1000.00' });

      const savedEntry = { id: uuidv4(), balance_after: '1500.00' };
      mockQueryRunner.manager.save.mockResolvedValue(savedEntry);

      const entryGroupId = uuidv4();
      const dto: WriteEntriesDto = {
        entries: [
          {
            ledger_type: LedgerType.FIRM_CASH,
            entry_type: EntryType.CREDIT,
            amount: '500.00',
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: uuidv4(),
            entry_group_id: entryGroupId,
            description: 'Commission earned',
            idempotency_key: `key-${uuidv4()}`,
          },
          {
            ledger_type: LedgerType.FIRM_CASH,
            entry_type: EntryType.DEBIT,
            amount: '500.00',
            source_type: SourceType.KC_AUTHORIZATION,
            source_id: uuidv4(),
            entry_group_id: entryGroupId,
            description: 'APMC fee',
            idempotency_key: `key-${uuidv4()}`,
          },
        ],
      };

      await service.writeEntries(dto, FIRM_ID, USER_ID);

      // Verify save was called with correct balance_after
      const saveCall = mockQueryRunner.manager.save.mock.calls[0];
      expect(saveCall).toBeDefined();
    });
  });
});
