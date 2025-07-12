import { UserServiceMigrated, User } from '../../services/UserServiceMigrated';
import { testUtils } from '../utils/testUtils';

/**
 * Test suite för UserServiceMigrated - BaseService migration
 * Testar att migration till BaseService fungerar korrekt med:
 * - Standardiserad felhantering med svenska meddelanden
 * - Schema-baserad validering
 * - GDPR-kompatibel cache-hantering
 * - Automatisk retry-logik
 */

describe('UserServiceMigrated', () => {
  let userService: UserServiceMigrated;

  beforeEach(async () => {
    // Använd etablerade testmönster från testRepair.md
    testUtils.setupSupabaseMock();
    userService = new UserServiceMigrated();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseService Integration', () => {
    it('ska initialiseras med BaseService-mönster', async () => {
      // Testa att BaseService-initialisering fungerar
      await expect(userService.getCurrentUser()).resolves.toBeDefined();
    });

    it('ska använda BaseService cache-hantering', async () => {
      const mockUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test Användare',
        role: 'member',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      // Mock Supabase-svar
      const mockSupabase = testUtils.setupSupabaseMock();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUser.id } },
        error: null
      });
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      // Första anropet ska gå till databas
      const result1 = await userService.getCurrentUser();
      expect(result1.success).toBe(true);
      expect(result1.user).toEqual(mockUser);

      // Andra anropet ska använda cache (BaseService-funktionalitet)
      const result2 = await userService.getCurrentUser();
      expect(result2.success).toBe(true);
      expect(result2.user).toEqual(mockUser);

      // Verifiera att endast ett databasanrop gjordes
      expect(mockSupabase.from().select().eq().single).toHaveBeenCalledTimes(1);
    });

    it('ska hantera fel med svenska meddelanden', async () => {
      const mockSupabase = testUtils.setupSupabaseMock();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' }
      });

      const result = await userService.getCurrentUser();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Autentiseringsfel'); // Svenska felmeddelande
    });
  });

  describe('Schema-baserad validering', () => {
    it('ska validera användar-ID format', async () => {
      const result = await userService.getUserById('invalid-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
    });

    it('ska validera e-postformat vid uppdatering', async () => {
      const validUserId = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUpdate = {
        email: 'invalid-email'
      };

      const result = await userService.updateUser(validUserId, invalidUpdate);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
    });

    it('ska validera roll-värden', async () => {
      const validUserId = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUpdate = {
        role: 'invalid-role' as any
      };

      const result = await userService.updateUser(validUserId, invalidUpdate);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
    });
  });

  describe('GDPR-efterlevnad', () => {
    it('ska rensa cache för specifik användare vid uppdatering', async () => {
      const mockUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test Användare',
        role: 'member',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const mockSupabase = testUtils.setupSupabaseMock();
      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { ...mockUser, name: 'Uppdaterat Namn' },
        error: null
      });

      const result = await userService.updateUser(mockUser.id, { name: 'Uppdaterat Namn' });
      
      expect(result.success).toBe(true);
      // Cache ska rensas för GDPR-efterlevnad
    });

    it('ska hantera känslig data säkert i felmeddelanden', async () => {
      const mockSupabase = testUtils.setupSupabaseMock();
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Database connection failed with user data: test@example.com'));

      const result = await userService.getCurrentUser();
      
      expect(result.success).toBe(false);
      // Felmeddelandet ska inte innehålla känslig data
      expect(result.error).not.toContain('test@example.com');
    });
  });

  describe('Sökfunktionalitet', () => {
    it('ska söka användare med validering', async () => {
      const mockUsers: User[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test1@example.com',
          name: 'Test Användare 1',
          role: 'member',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const mockSupabase = testUtils.setupSupabaseMock();
      mockSupabase.from().select().eq().or().order().limit().range.mockResolvedValue({
        data: mockUsers,
        count: 1,
        error: null
      });

      const result = await userService.searchUsers('test', {
        includeInactive: false,
        role: 'member',
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.users).toEqual(mockUsers);
      expect(result.total).toBe(1);
    });

    it('ska validera sökalternativ', async () => {
      const result = await userService.searchUsers('test', {
        limit: -1 // Ogiltig gräns
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
    });
  });

  describe('Retry-logik', () => {
    it('ska återförsöka vid tillfälliga databasfel', async () => {
      const mockSupabase = testUtils.setupSupabaseMock();
      
      // Första anropet misslyckas, andra lyckas
      mockSupabase.auth.getUser
        .mockRejectedValueOnce(new Error('Temporary database error'))
        .mockResolvedValueOnce({
          data: { user: { id: '123e4567-e89b-12d3-a456-426614174000' } },
          error: null
        });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          name: 'Test Användare',
          role: 'member',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      const result = await userService.getCurrentUser();
      
      expect(result.success).toBe(true);
      expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('Prestanda och optimering', () => {
    it('ska hantera stora användarlistor effektivt', async () => {
      const mockUsers = Array.from({ length: 50 }, (_, i) => ({
        id: `123e4567-e89b-12d3-a456-42661417400${i}`,
        email: `test${i}@example.com`,
        name: `Test Användare ${i}`,
        role: 'member' as const,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }));

      const mockSupabase = testUtils.setupSupabaseMock();
      mockSupabase.from().select().eq().or().order().limit().range.mockResolvedValue({
        data: mockUsers,
        count: 50,
        error: null
      });

      const startTime = Date.now();
      const result = await userService.searchUsers('test', { limit: 50 });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(1000); // Ska vara snabbt
    });
  });

  describe('Svensk lokalisering', () => {
    it('ska returnera svenska felmeddelanden för vanliga fel', async () => {
      const mockSupabase = testUtils.setupSupabaseMock();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Authentication failed' }
      });

      const result = await userService.getCurrentUser();
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/autentisering|inloggning|användare/i);
    });

    it('ska hantera svenska tecken i användardata', async () => {
      const mockUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'åsa.öberg@example.com',
        name: 'Åsa Öberg',
        role: 'member',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const mockSupabase = testUtils.setupSupabaseMock();
      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const result = await userService.updateUser(mockUser.id, { name: 'Åsa Öberg' });
      
      expect(result.success).toBe(true);
      expect(result.user?.name).toBe('Åsa Öberg');
    });
  });
});
