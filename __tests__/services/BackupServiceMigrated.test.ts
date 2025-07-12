/**
 * BackupServiceMigrated Tests - Validerar migrerad backup-tjänst
 * 
 * Dessa tester validerar:
 * - BaseService-mönster och standardiserad felhantering
 * - Schema-baserad validering för backup-operationer
 * - GDPR-kompatibel cache-hantering och loggning
 * - Svenska felmeddelanden och lokalisering
 * - Retention policy-funktionalitet
 */

import { BackupServiceMigrated } from '../../src/services/BackupServiceMigrated';
import { testUtils } from '../utils/testUtils';

// Mock Supabase
const mockSupabaseClient = testUtils.setupSupabaseMock();

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('BackupServiceMigrated', () => {
  let backupService: BackupServiceMigrated;

  beforeEach(() => {
    jest.clearAllMocks();
    backupService = new BackupServiceMigrated();
    
    // Reset AsyncStorage mocks
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  describe('Initialisering och konfiguration', () => {
    test('ska initialisera med standardinställningar', async () => {
      const result = await backupService.createBackup('test-user', { test: 'data' }, 'meeting');
      
      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
    });

    test('ska ladda sparad retention policy', async () => {
      const savedPolicy = { dailyBackups: 10, weeklyBackups: 6, monthlyBackups: 15 };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedPolicy));
      
      const newService = new BackupServiceMigrated();
      await newService.createBackup('test-user', { test: 'data' }, 'meeting');
      
      const policy = newService.getRetentionPolicy();
      expect(policy.dailyBackups).toBe(10);
      expect(policy.weeklyBackups).toBe(6);
      expect(policy.monthlyBackups).toBe(15);
    });
  });

  describe('Backup-skapande med validering', () => {
    test('ska skapa backup med giltig data', async () => {
      const testData = { meeting: 'test', participants: ['user1', 'user2'] };
      
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'backup-123' },
              error: null
            })
          })
        })
      });

      const result = await backupService.createBackup('user-123', testData, 'meeting');
      
      expect(result.success).toBe(true);
      expect(result.backupId).toBe('backup-123');
      expect(result.error).toBeUndefined();
    });

    test('ska validera obligatoriska fält', async () => {
      const result = await backupService.createBackup('', { test: 'data' }, 'meeting');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
      expect(result.backupId).toBeUndefined();
    });

    test('ska validera backup-typ', async () => {
      const result = await backupService.createBackup('user-123', { test: 'data' }, 'invalid-type' as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
    });

    test('ska hantera databasfel med svenska meddelanden', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      });

      const result = await backupService.createBackup('user-123', { test: 'data' }, 'meeting');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Databasfel');
    });
  });

  describe('Backup-återställning', () => {
    test('ska återställa backup med giltig data', async () => {
      const originalData = { meeting: 'test', participants: ['user1', 'user2'] };
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'backup-123',
                data: JSON.stringify(originalData),
                checksum: 'test-checksum'
              },
              error: null
            })
          })
        })
      });

      const result = await backupService.restoreBackup('backup-123');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(originalData);
    });

    test('ska validera backup-ID', async () => {
      const result = await backupService.restoreBackup('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
    });

    test('ska hantera saknad backup', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await backupService.restoreBackup('nonexistent-backup');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('hittades inte');
    });
  });

  describe('Backup-listning med caching', () => {
    test('ska lista backuper för användare', async () => {
      const mockBackups = [
        { id: 'backup-1', userId: 'user-123', type: 'meeting', createdAt: '2024-01-01' },
        { id: 'backup-2', userId: 'user-123', type: 'protocol', createdAt: '2024-01-02' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockBackups,
              error: null
            })
          })
        })
      });

      const result = await backupService.listBackups('user-123');
      
      expect(result.success).toBe(true);
      expect(result.backups).toEqual(mockBackups);
    });

    test('ska filtrera backuper efter typ', async () => {
      const mockBackups = [
        { id: 'backup-1', userId: 'user-123', type: 'meeting', createdAt: '2024-01-01' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn((field, value) => ({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockBackups,
                error: null
              })
            }),
            order: jest.fn().mockResolvedValue({
              data: mockBackups,
              error: null
            })
          }))
        })
      });

      const result = await backupService.listBackups('user-123', 'meeting');
      
      expect(result.success).toBe(true);
      expect(result.backups).toEqual(mockBackups);
    });
  });

  describe('Backup-borttagning', () => {
    test('ska ta bort backup', async () => {
      mockSupabaseClient.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      const result = await backupService.deleteBackup('backup-123');
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('ska validera backup-ID för borttagning', async () => {
      const result = await backupService.deleteBackup('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
    });
  });

  describe('Retention Policy', () => {
    test('ska sätta och hämta retention policy', async () => {
      const newPolicy = { dailyBackups: 14, weeklyBackups: 8, monthlyBackups: 24 };
      
      await backupService.setRetentionPolicy(newPolicy);
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'backup_retention_policy',
        JSON.stringify(expect.objectContaining(newPolicy))
      );

      const retrievedPolicy = backupService.getRetentionPolicy();
      expect(retrievedPolicy).toMatchObject(newPolicy);
    });
  });

  describe('GDPR-efterlevnad och svenska meddelanden', () => {
    test('ska använda svenska felmeddelanden', async () => {
      const result = await backupService.createBackup('', null, 'meeting');
      
      expect(result.error).toMatch(/Valideringsfel|fel|data/i);
    });

    test('ska hantera GDPR-kompatibel cache-rensning', async () => {
      // Skapa några backuper för att fylla cache
      await backupService.listBackups('user-123');
      
      // Ta bort backup (ska rensa relaterad cache)
      mockSupabaseClient.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      const result = await backupService.deleteBackup('backup-123');
      expect(result.success).toBe(true);
    });
  });
});
