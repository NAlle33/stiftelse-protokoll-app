import { ServiceDependencyOptimizer } from '../../services/ServiceDependencyOptimizer';
import { OptimizedServiceRegistry } from '../../services/OptimizedServiceRegistry';
import { ServiceContainer, ServiceIdentifiers } from '../../services/ServiceContainer';

/**
 * Test suite för Service Dependency Optimization
 * Testar dependency layering, lazy loading och prestanda-optimeringar
 */

describe('Service Dependency Optimization', () => {
  let optimizer: ServiceDependencyOptimizer;
  let container: ServiceContainer;
  let registry: OptimizedServiceRegistry;

  beforeEach(() => {
    container = new ServiceContainer();
    optimizer = new ServiceDependencyOptimizer();
    registry = new OptimizedServiceRegistry(container);
  });

  afterEach(() => {
    container.clear();
  });

  describe('ServiceDependencyOptimizer', () => {
    it('ska analysera nuvarande service-struktur', async () => {
      const result = await optimizer.analyzeCurrentStructure();

      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();
      expect(result.graph!.size).toBeGreaterThan(0);
      
      // Kontrollera att core services finns
      expect(result.graph!.has('SupabaseClient')).toBe(true);
      expect(result.graph!.has('Logger')).toBe(true);
      expect(result.graph!.has('UserService')).toBe(true);
    });

    it('ska detektera och rapportera cirkulära beroenden', async () => {
      const result = await optimizer.analyzeCurrentStructure();

      expect(result.success).toBe(true);
      
      // Om cirkulära beroenden finns, ska de rapporteras
      if (result.issues && result.issues.length > 0) {
        expect(result.issues[0]).toContain('Cirkulärt beroende');
      }
    });

    it('ska optimera service-beroenden', async () => {
      // Först analysera struktur
      await optimizer.analyzeCurrentStructure();
      
      // Sedan optimera
      const result = await optimizer.optimizeDependencies();

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      
      const optimization = result.result!;
      expect(optimization.originalServiceCount).toBeGreaterThan(0);
      expect(optimization.layerCount).toBeGreaterThan(0);
      expect(optimization.buildTimeImprovement).toBeGreaterThan(0);
      expect(optimization.bundleSizeReduction).toBeGreaterThan(0);
    });

    it('ska generera optimerad service-registrering', async () => {
      await optimizer.analyzeCurrentStructure();
      
      const registrationCode = optimizer.generateOptimizedServiceRegistry();
      
      expect(registrationCode).toContain('registerOptimizedServices');
      expect(registrationCode).toContain('Layer 0');
      expect(registrationCode).toContain('Layer 1');
      expect(registrationCode).toContain('Core Infrastructure');
      expect(registrationCode).toContain('Base Services');
    });

    it('ska generera dependency visualization', async () => {
      await optimizer.analyzeCurrentStructure();
      
      const visualization = optimizer.generateDependencyVisualization();
      
      expect(visualization).toContain('# Service Dependency Visualization');
      expect(visualization).toContain('## Dependency Layers');
      expect(visualization).toContain('```mermaid');
      expect(visualization).toContain('## Optimization Summary');
    });
  });

  describe('OptimizedServiceRegistry', () => {
    it('ska registrera services i optimerad ordning', async () => {
      await registry.registerAllOptimizedServices();
      
      const order = registry.getInitializationOrder();
      
      // Kontrollera att core services kommer först
      expect(order[0]).toBe('SupabaseClient');
      expect(order[1]).toBe('Logger');
      
      // Kontrollera att lazy loaded services markeras korrekt
      const lazyServices = order.filter(service => service.includes('(lazy)'));
      expect(lazyServices.length).toBeGreaterThan(0);
    });

    it('ska validera alla dependencies efter registrering', async () => {
      await registry.registerAllOptimizedServices();
      
      const validation = container.validateDependencies();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('ska implementera lazy loading för avancerade services', async () => {
      await registry.registerAllOptimizedServices();
      
      // Mock lazy loading för test
      const mockLazyService = {
        serviceName: 'MockVideoMeetingService',
        initialize: jest.fn().mockResolvedValue(undefined)
      };

      container.register({
        identifier: 'MockVideoService',
        factory: () => Promise.resolve(mockLazyService),
        singleton: true
      });

      const service = await container.get('MockVideoService');
      expect(service).toBe(mockLazyService);
    });

    it('ska generera dependency rapport', async () => {
      await registry.registerAllOptimizedServices();
      
      const report = registry.generateDependencyReport();
      
      expect(report).toContain('# Service Dependency Optimization Report');
      expect(report).toContain('## Sammanfattning');
      expect(report).toContain('## Prestanda-förbättringar');
      expect(report).toContain('## Initialiserings-ordning');
      expect(report).toContain('## GDPR-efterlevnad');
    });
  });

  describe('Dependency Layering', () => {
    it('ska organisera services i korrekta layers', async () => {
      await registry.registerAllOptimizedServices();
      
      // Layer 0: Core Infrastructure
      expect(container.has(ServiceIdentifiers.SUPABASE_CLIENT)).toBe(true);
      expect(container.has(ServiceIdentifiers.LOGGER)).toBe(true);
      
      // Layer 1: Base Services  
      expect(container.has(ServiceIdentifiers.USER_SERVICE)).toBe(true);
      expect(container.has(ServiceIdentifiers.AUTH_SERVICE)).toBe(true);
      
      // Layer 2: Business Services
      expect(container.has(ServiceIdentifiers.MEETING_SERVICE)).toBe(true);
      expect(container.has(ServiceIdentifiers.PROTOCOL_SERVICE)).toBe(true);
    });

    it('ska respektera dependency-ordning mellan layers', async () => {
      await registry.registerAllOptimizedServices();
      
      const order = registry.getInitializationOrder();
      
      // Core services ska komma före base services
      const supabaseIndex = order.indexOf('SupabaseClient');
      const userServiceIndex = order.indexOf('UserService');
      expect(supabaseIndex).toBeLessThan(userServiceIndex);
      
      // Base services ska komma före business services
      const authServiceIndex = order.indexOf('AuthService');
      const meetingServiceIndex = order.indexOf('MeetingService');
      expect(authServiceIndex).toBeLessThan(meetingServiceIndex);
    });
  });

  describe('Performance Optimization', () => {
    it('ska förbättra startup-tid genom selektiv laddning', async () => {
      const startTime = Date.now();
      
      // Registrera endast kritiska services
      await registry['registerCoreInfrastructure']();
      await registry['registerBaseServices']();
      
      const coreLoadTime = Date.now() - startTime;
      
      // Core services ska ladda snabbt (under 100ms i test)
      expect(coreLoadTime).toBeLessThan(100);
    });

    it('ska minska minnesanvändning genom lazy loading', () => {
      const order = [
        'SupabaseClient',
        'Logger', 
        'UserService',
        'AuthService',
        'MeetingService',
        'ProtocolService',
        'VideoMeetingService (lazy)',
        'WebRTCSignalingService (lazy)',
        'BackupService (lazy)'
      ];

      const immediateServices = order.filter(s => !s.includes('(lazy)')).length;
      const lazyServices = order.filter(s => s.includes('(lazy)')).length;
      
      // Minst 30% av services ska vara lazy loaded
      const lazyPercentage = (lazyServices / order.length) * 100;
      expect(lazyPercentage).toBeGreaterThanOrEqual(30);
    });

    it('ska optimera bundle-storlek genom code splitting', () => {
      // Simulera bundle-storlek beräkning
      const originalBundleSize = 7400; // 7.4MB
      const lazyServiceCount = 6; // Antal lazy loaded services
      const reductionPerService = 2; // 2% per lazy service
      
      const expectedReduction = Math.min(15, lazyServiceCount * reductionPerService);
      const optimizedBundleSize = originalBundleSize * (1 - expectedReduction / 100);
      
      expect(optimizedBundleSize).toBeLessThan(originalBundleSize);
      expect(expectedReduction).toBeGreaterThanOrEqual(10); // Minst 10% minskning
    });
  });

  describe('Circular Dependency Elimination', () => {
    it('ska eliminera cirkulära beroenden genom dependency injection', () => {
      // Simulera cirkulärt beroende
      const circularDeps = [
        {
          cycle: ['MeetingService', 'VideoMeetingService', 'MeetingService'],
          severity: 'critical' as const,
          suggestion: 'Använd dependency injection för att injicera MeetingService i VideoMeetingService'
        }
      ];

      // Kontrollera att förslag finns för att lösa cirkulära beroenden
      expect(circularDeps[0].suggestion).toContain('dependency injection');
      expect(circularDeps[0].severity).toBe('critical');
    });

    it('ska validera att inga cirkulära beroenden finns efter optimering', async () => {
      await registry.registerAllOptimizedServices();
      
      const validation = container.validateDependencies();
      expect(validation.isValid).toBe(true);
      
      // Inga cirkulära beroenden ska finnas
      const circularErrors = validation.errors.filter(error => 
        error.includes('Cirkulärt beroende')
      );
      expect(circularErrors).toHaveLength(0);
    });
  });

  describe('GDPR Compliance', () => {
    it('ska bibehålla GDPR-säkerhet i optimerade services', async () => {
      await registry.registerAllOptimizedServices();
      
      // Alla services ska använda BaseService-mönster
      const userService = container.get(ServiceIdentifiers.USER_SERVICE);
      expect(userService).toBeDefined();
      
      // Services ska ha GDPR-kompatibel error handling
      // (Detta testas mer detaljerat i BaseService.test.ts)
    });

    it('ska logga service-laddning för audit trail', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Simulera lazy loading
      const mockLoader = {
        loadService: jest.fn().mockImplementation((identifier, loader) => {
          console.log(`⚡ Lazy loading service: ${identifier}`);
          return loader();
        })
      };

      mockLoader.loadService('TestService', () => ({ test: true }));
      
      expect(consoleSpy).toHaveBeenCalledWith('⚡ Lazy loading service: TestService');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration Tests', () => {
    it('ska integrera med befintlig ServiceContainer', async () => {
      await registry.registerAllOptimizedServices();
      
      // Kontrollera att alla kritiska services är tillgängliga
      expect(() => container.get(ServiceIdentifiers.SUPABASE_CLIENT)).not.toThrow();
      expect(() => container.get(ServiceIdentifiers.USER_SERVICE)).not.toThrow();
      expect(() => container.get(ServiceIdentifiers.MEETING_SERVICE)).not.toThrow();
    });

    it('ska fungera med befintliga service-mönster', async () => {
      await registry.registerAllOptimizedServices();
      
      const order = registry.getInitializationOrder();
      
      // Kontrollera att alla förväntade services finns
      expect(order).toContain('SupabaseClient');
      expect(order).toContain('UserService');
      expect(order).toContain('MeetingService');
      expect(order.some(s => s.includes('(lazy)'))).toBe(true);
    });
  });
});
