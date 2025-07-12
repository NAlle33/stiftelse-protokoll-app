/**
 * OptimizedServiceRegistry Migration Test - Service Layer BaseService Migration
 * 
 * Testar integration av migrerade BaseService-tjänster med OptimizedServiceRegistry.
 * Verifierar dependency injection, layered architecture och conditional loading.
 */

import { OptimizedServiceRegistry } from '../../services/OptimizedServiceRegistry';
import { ServiceContainer, ServiceIdentifiers } from '../../services/ServiceContainer';
import { ServiceFactory } from '../../services/ServiceFactory';
import { FEATURE_FLAGS } from '../../config/featureFlags';

// Mock ServiceFactory för kontrollerad testning
jest.mock('../../services/ServiceFactory');
const mockServiceFactory = ServiceFactory as jest.Mocked<typeof ServiceFactory>;

// Mock feature flags
jest.mock('../../config/featureFlags', () => ({
  FEATURE_FLAGS: {
    USE_MIGRATED_USER_SERVICE: true,
    USE_MIGRATED_VIDEO_SERVICE: false,
    USE_MIGRATED_SIGNALING_SERVICE: true,
    ENABLE_MIGRATION_LOGGING: true,
    ENABLE_SERVICE_DEBUG_MODE: true,
  },
  FeatureFlagManager: {
    isServiceMigrationEnabled: jest.fn(),
    logFeatureFlagStatus: jest.fn(),
    validateConfiguration: jest.fn(() => ({ isValid: true, errors: [] })),
    getMigrationStatus: jest.fn(() => ({
      totalServices: 3,
      migratedServices: 2,
      migrationPercentage: 67,
      activeMigrations: ['UserService', 'WebRTCSignalingService']
    }))
  }
}));

describe('OptimizedServiceRegistry Migration Integration', () => {
  let serviceContainer: ServiceContainer;
  let optimizedRegistry: OptimizedServiceRegistry;

  beforeEach(() => {
    // Skapa ny service container för varje test
    serviceContainer = new ServiceContainer();
    optimizedRegistry = new OptimizedServiceRegistry(serviceContainer);

    // Reset mocks
    jest.clearAllMocks();

    // Setup ServiceFactory mocks
    mockServiceFactory.getUserService.mockResolvedValue({
      service: { serviceName: 'UserService', isMigrated: true },
      isMigrated: true,
      serviceName: 'UserService',
      loadTime: 50,
      fallbackUsed: false
    });

    mockServiceFactory.getVideoMeetingService.mockResolvedValue({
      service: { serviceName: 'VideoMeetingService', isMigrated: false },
      isMigrated: false,
      serviceName: 'VideoMeetingService',
      loadTime: 75,
      fallbackUsed: true
    });

    mockServiceFactory.getWebRTCSignalingService.mockResolvedValue({
      service: { serviceName: 'WebRTCSignalingService', isMigrated: true },
      isMigrated: true,
      serviceName: 'WebRTCSignalingService',
      loadTime: 60,
      fallbackUsed: false
    });
  });

  describe('Service Registration', () => {
    test('should register all services with conditional loading', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      // Kontrollera att dependency validation passerar
      const validation = serviceContainer.validateDependencies();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should maintain layered architecture with migrated services', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      const initOrder = optimizedRegistry.getInitializationOrder();
      
      // Kontrollera att conditional services är markerade korrekt
      expect(initOrder).toContain('UserService (conditional)');
      expect(initOrder).toContain('VideoMeetingService (conditional, lazy)');
      expect(initOrder).toContain('WebRTCSignalingService (conditional, lazy)');
    });

    test('should handle service factory errors gracefully', async () => {
      // Mock ServiceFactory för att kasta fel
      mockServiceFactory.getUserService.mockRejectedValue(new Error('Migration failed'));

      // Registry bör fortfarande kunna registrera andra services
      await expect(optimizedRegistry.registerAllOptimizedServices()).resolves.not.toThrow();
    });
  });

  describe('Dependency Injection', () => {
    test('should inject correct dependencies for migrated services', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      // Kontrollera att UserService har rätt dependencies
      const userServiceDef = serviceContainer.getServiceDefinition(ServiceIdentifiers.USER_SERVICE);
      expect(userServiceDef?.dependencies).toContain(ServiceIdentifiers.SUPABASE_CLIENT);
    });

    test('should maintain singleton pattern for migrated services', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      // Kontrollera att alla migrerade services är singletons
      const userServiceDef = serviceContainer.getServiceDefinition(ServiceIdentifiers.USER_SERVICE);
      const videoServiceDef = serviceContainer.getServiceDefinition(ServiceIdentifiers.VIDEO_MEETING_SERVICE);
      const signalingServiceDef = serviceContainer.getServiceDefinition(ServiceIdentifiers.WEBRTC_SIGNALING_SERVICE);

      expect(userServiceDef?.singleton).toBe(true);
      expect(videoServiceDef?.singleton).toBe(true);
      expect(signalingServiceDef?.singleton).toBe(true);
    });

    test('should resolve services correctly through container', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      // Mock Supabase client för dependency injection
      serviceContainer.register(ServiceIdentifiers.SUPABASE_CLIENT, () => ({ client: 'mock' }), true);
      serviceContainer.register(ServiceIdentifiers.LOGGER, () => ({ log: jest.fn() }), true);

      // Försök resolva UserService
      const userService = await serviceContainer.resolve(ServiceIdentifiers.USER_SERVICE);
      expect(userService).toBeDefined();
      expect(mockServiceFactory.getUserService).toHaveBeenCalled();
    });
  });

  describe('Conditional Loading Integration', () => {
    test('should call ServiceFactory for conditional services', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      // Mock dependencies
      serviceContainer.register(ServiceIdentifiers.SUPABASE_CLIENT, () => ({ client: 'mock' }), true);

      // Resolva UserService - bör använda ServiceFactory
      await serviceContainer.resolve(ServiceIdentifiers.USER_SERVICE);
      expect(mockServiceFactory.getUserService).toHaveBeenCalled();
    });

    test('should log migration status during service loading', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await optimizedRegistry.registerAllOptimizedServices();

      // Mock dependencies
      serviceContainer.register(ServiceIdentifiers.SUPABASE_CLIENT, () => ({ client: 'mock' }), true);

      // Resolva service
      await serviceContainer.resolve(ServiceIdentifiers.USER_SERVICE);

      // Kontrollera att migration status loggades
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Laddade UserService (Migrerad)')
      );

      consoleSpy.mockRestore();
    });

    test('should handle fallback scenarios correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await optimizedRegistry.registerAllOptimizedServices();

      // Mock dependencies
      serviceContainer.register(ServiceIdentifiers.SUPABASE_CLIENT, () => ({ client: 'mock' }), true);
      serviceContainer.register(ServiceIdentifiers.MEETING_SERVICE, () => ({ meeting: 'mock' }), true);
      serviceContainer.register(ServiceIdentifiers.LOGGER, () => ({ log: jest.fn() }), true);

      // Resolva VideoMeetingService som använder fallback
      await serviceContainer.resolve(ServiceIdentifiers.VIDEO_MEETING_SERVICE);

      // Kontrollera att fallback loggades
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Laddade VideoMeetingService (Legacy)')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Monitoring', () => {
    test('should track service loading performance', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      // Mock dependencies
      serviceContainer.register(ServiceIdentifiers.SUPABASE_CLIENT, () => ({ client: 'mock' }), true);

      // Resolva service
      await serviceContainer.resolve(ServiceIdentifiers.USER_SERVICE);

      // Kontrollera att ServiceFactory anropades med performance tracking
      expect(mockServiceFactory.getUserService).toHaveBeenCalled();
    });

    test('should generate comprehensive dependency report', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      const report = optimizedRegistry.generateDependencyReport();

      // Kontrollera att rapporten innehåller migration information
      expect(report).toContain('BaseService Migration Status');
      expect(report).toContain('Conditional loading');
      expect(report).toContain('Feature flags');
      expect(report).toContain('Fallback support');
      expect(report).toContain('Migration monitoring');
    });

    test('should include conditional services in initialization order', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      const initOrder = optimizedRegistry.getInitializationOrder();
      const conditionalServices = initOrder.filter(service => service.includes('(conditional)'));

      expect(conditionalServices.length).toBeGreaterThan(0);
      expect(conditionalServices).toContain('UserService (conditional)');
    });
  });

  describe('Error Handling', () => {
    test('should handle ServiceFactory errors without breaking registry', async () => {
      // Mock ServiceFactory för att kasta fel för en service
      mockServiceFactory.getUserService.mockRejectedValue(new Error('UserService migration failed'));

      // Registry bör fortfarande kunna registrera andra services
      await expect(optimizedRegistry.registerAllOptimizedServices()).resolves.not.toThrow();

      // Andra services bör fortfarande vara registrerade
      const initOrder = optimizedRegistry.getInitializationOrder();
      expect(initOrder.length).toBeGreaterThan(0);
    });

    test('should validate dependencies correctly with conditional services', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      const validation = serviceContainer.validateDependencies();
      
      if (!validation.isValid) {
        console.log('Validation errors:', validation.errors);
      }

      expect(validation.isValid).toBe(true);
    });

    test('should handle missing dependencies gracefully', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      // Försök resolva service utan att registrera dependencies
      await expect(
        serviceContainer.resolve(ServiceIdentifiers.USER_SERVICE)
      ).rejects.toThrow();
    });
  });

  describe('GDPR Compliance', () => {
    test('should maintain GDPR compliance in dependency report', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      const report = optimizedRegistry.generateDependencyReport();

      // Kontrollera GDPR-relaterat innehåll
      expect(report).toContain('GDPR-efterlevnad');
      expect(report).toContain('BaseService-mönster för GDPR-säker datahantering');
      expect(report).toContain('Migration monitoring respekterar GDPR-dataminimering');
    });

    test('should not expose sensitive data in service metadata', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      const metadata = serviceContainer.getServiceMetadata();
      const metadataString = JSON.stringify(metadata);

      // Kontrollera att ingen känslig data exponeras
      expect(metadataString).not.toContain('password');
      expect(metadataString).not.toContain('secret');
      expect(metadataString).not.toContain('token');
    });
  });

  describe('Swedish Localization', () => {
    test('should use Swedish text in dependency report', async () => {
      await optimizedRegistry.registerAllOptimizedServices();

      const report = optimizedRegistry.generateDependencyReport();

      // Kontrollera svenska termer
      expect(report).toContain('Sammanfattning');
      expect(report).toContain('Prestanda-förbättringar');
      expect(report).toContain('Initialiserings-ordning');
      expect(report).toContain('GDPR-efterlevnad');
    });

    test('should use Swedish text in console logging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await optimizedRegistry.registerAllOptimizedServices();

      // Kontrollera svenska termer i loggning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registrerar')
      );

      consoleSpy.mockRestore();
    });
  });
});
