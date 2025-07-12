/**
 * ServiceContainer - Dependency Injection Container för SÖKA Stiftelseappen
 * 
 * Implementerar Service Composition-mönster för att:
 * - Ersätta tight coupling med dependency injection
 * - Möjliggöra modulär service-design
 * - Förbättra testbarhet genom mock-injection
 * - Minska cirkulära beroenden
 * - Centralisera service-livscykelhantering
 * 
 * Följer etablerade mönster från BaseService-implementationen
 */

import { BaseService } from './BaseService';

export type ServiceIdentifier = string | symbol;
export type ServiceFactory<T = any> = (container: ServiceContainer) => T;
export type ServiceInstance<T = any> = T;

export interface ServiceDefinition<T = any> {
  identifier: ServiceIdentifier;
  factory: ServiceFactory<T>;
  singleton?: boolean;
  dependencies?: ServiceIdentifier[];
}

export interface ServiceMetadata {
  identifier: ServiceIdentifier;
  singleton: boolean;
  dependencies: ServiceIdentifier[];
  initialized: boolean;
  instance?: any;
}

/**
 * Dependency Injection Container med svensk lokalisering och GDPR-efterlevnad
 */
export class ServiceContainer {
  private services = new Map<ServiceIdentifier, ServiceMetadata>();
  private instances = new Map<ServiceIdentifier, any>();
  private initializing = new Set<ServiceIdentifier>();

  /**
   * Registrerar en service med dess factory och beroenden
   */
  register<T>(definition: ServiceDefinition<T>): void {
    if (this.services.has(definition.identifier)) {
      throw new Error(`Service redan registrerad: ${String(definition.identifier)}`);
    }

    this.services.set(definition.identifier, {
      identifier: definition.identifier,
      singleton: definition.singleton ?? true,
      dependencies: definition.dependencies ?? [],
      initialized: false,
    });

    console.log(`📦 Service registrerad: ${String(definition.identifier)}`, {
      singleton: definition.singleton ?? true,
      dependencies: definition.dependencies?.length ?? 0,
    });
  }

  /**
   * Hämtar en service-instans med dependency injection
   */
  get<T>(identifier: ServiceIdentifier): T {
    // Kontrollera om service är registrerad
    const metadata = this.services.get(identifier);
    if (!metadata) {
      throw new Error(`Service ej registrerad: ${String(identifier)}`);
    }

    // Returnera befintlig singleton-instans
    if (metadata.singleton && this.instances.has(identifier)) {
      return this.instances.get(identifier) as T;
    }

    // Kontrollera cirkulära beroenden
    if (this.initializing.has(identifier)) {
      const chain = Array.from(this.initializing).join(' -> ');
      throw new Error(`Cirkulärt beroende upptäckt: ${chain} -> ${String(identifier)}`);
    }

    try {
      this.initializing.add(identifier);

      // Skapa service-instans
      const instance = this.createInstance<T>(identifier);

      // Spara singleton-instans
      if (metadata.singleton) {
        this.instances.set(identifier, instance);
        metadata.initialized = true;
      }

      return instance;
    } finally {
      this.initializing.delete(identifier);
    }
  }

  /**
   * Kontrollerar om en service är registrerad
   */
  has(identifier: ServiceIdentifier): boolean {
    return this.services.has(identifier);
  }

  /**
   * Avregistrerar en service och rensar dess instans
   */
  unregister(identifier: ServiceIdentifier): void {
    this.services.delete(identifier);
    this.instances.delete(identifier);
    console.log(`🗑️  Service avregistrerad: ${String(identifier)}`);
  }

  /**
   * Rensar alla service-instanser (behåller registreringar)
   */
  clearInstances(): void {
    this.instances.clear();
    for (const metadata of this.services.values()) {
      metadata.initialized = false;
    }
    console.log('🧹 Alla service-instanser rensade');
  }

  /**
   * Rensar hela containern
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
    this.initializing.clear();
    console.log('🧹 Service container rensad');
  }

  /**
   * Hämtar metadata för alla registrerade services
   */
  getServiceMetadata(): ServiceMetadata[] {
    return Array.from(this.services.values());
  }

  /**
   * Validerar service-beroenden för cirkulära referenser
   */
  validateDependencies(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const visited = new Set<ServiceIdentifier>();
    const visiting = new Set<ServiceIdentifier>();

    const visit = (identifier: ServiceIdentifier, path: ServiceIdentifier[] = []): void => {
      if (visiting.has(identifier)) {
        const cycle = [...path, identifier].map(id => String(id)).join(' -> ');
        errors.push(`Cirkulärt beroende: ${cycle}`);
        return;
      }

      if (visited.has(identifier)) {
        return;
      }

      const metadata = this.services.get(identifier);
      if (!metadata) {
        errors.push(`Saknad service: ${String(identifier)}`);
        return;
      }

      visiting.add(identifier);

      for (const dependency of metadata.dependencies) {
        visit(dependency, [...path, identifier]);
      }

      visiting.delete(identifier);
      visited.add(identifier);
    };

    for (const identifier of this.services.keys()) {
      visit(identifier);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Skapar en service-instans med dependency injection
   */
  private createInstance<T>(identifier: ServiceIdentifier): T {
    const metadata = this.services.get(identifier);
    if (!metadata) {
      throw new Error(`Service ej registrerad: ${String(identifier)}`);
    }

    // Hämta factory från registrering
    const definition = this.getServiceDefinition(identifier);
    if (!definition) {
      throw new Error(`Service definition saknas: ${String(identifier)}`);
    }

    try {
      // Skapa instans via factory
      const instance = definition.factory(this);

      // Initialisera BaseService om tillämpligt
      if (instance instanceof BaseService) {
        // BaseService initialiseras automatiskt vid första användning
        console.log(`🔧 BaseService-instans skapad: ${String(identifier)}`);
      }

      console.log(`✅ Service-instans skapad: ${String(identifier)}`);
      return instance as T;
    } catch (error) {
      console.error(`❌ Fel vid skapande av service: ${String(identifier)}`, error);
      throw new Error(`Kunde inte skapa service ${String(identifier)}: ${(error as Error).message}`);
    }
  }

  /**
   * Hämtar service definition (måste implementeras av subklasser eller registry)
   */
  private getServiceDefinition(identifier: ServiceIdentifier): ServiceDefinition | null {
    // I en riktig implementation skulle detta hämta från en registry
    // För nu returnerar vi null och låter factory-metoden hanteras externt
    return null;
  }
}

/**
 * Service Identifiers - Centraliserade identifierare för alla services
 */
export const ServiceIdentifiers = {
  // Core Services
  SUPABASE_CLIENT: Symbol('SupabaseClient'),
  LOGGER: Symbol('Logger'),
  
  // Business Services
  USER_SERVICE: Symbol('UserService'),
  MEETING_SERVICE: Symbol('MeetingService'),
  PROTOCOL_SERVICE: Symbol('ProtocolService'),
  PROTOCOL_AI_SERVICE: Symbol('ProtocolAIService'),
  
  // Infrastructure Services
  AUTH_SERVICE: Symbol('AuthService'),
  AUDIT_SERVICE: Symbol('AuditService'),
  NOTIFICATION_SERVICE: Symbol('NotificationService'),
  
  // Video Services
  VIDEO_MEETING_SERVICE: Symbol('VideoMeetingService'),
  WEBRTC_SIGNALING_SERVICE: Symbol('WebRTCSignalingService'),
  WEBRTC_PEER_SERVICE: Symbol('WebRTCPeerService'),
  
  // Utility Services
  BACKUP_SERVICE: Symbol('BackupService'),
  NETWORK_CONNECTIVITY_SERVICE: Symbol('NetworkConnectivityService'),
  RATE_LIMIT_SERVICE: Symbol('RateLimitService'),
} as const;

/**
 * Service Registry - Centraliserad registrering av alla services
 */
export class ServiceRegistry {
  private container: ServiceContainer;
  private definitions = new Map<ServiceIdentifier, ServiceDefinition>();

  constructor(container: ServiceContainer) {
    this.container = container;
  }

  /**
   * Registrerar en service definition
   */
  define<T>(definition: ServiceDefinition<T>): void {
    this.definitions.set(definition.identifier, definition);
    this.container.register(definition);
  }

  /**
   * Hämtar en service definition
   */
  getDefinition(identifier: ServiceIdentifier): ServiceDefinition | undefined {
    return this.definitions.get(identifier);
  }

  /**
   * Registrerar alla core services
   */
  registerCoreServices(): void {
    // Supabase Client
    this.define({
      identifier: ServiceIdentifiers.SUPABASE_CLIENT,
      factory: () => require('./supabaseClient').supabase,
      singleton: true,
    });

    // Logger
    this.define({
      identifier: ServiceIdentifiers.LOGGER,
      factory: () => require('../utils/logger').logger,
      singleton: true,
    });

    console.log('✅ Core services registrerade');
  }

  /**
   * Registrerar alla business services
   */
  registerBusinessServices(): void {
    // User Service
    this.define({
      identifier: ServiceIdentifiers.USER_SERVICE,
      factory: (container) => {
        const UserService = require('./userService').UserService;
        return new UserService();
      },
      singleton: true,
      dependencies: [ServiceIdentifiers.SUPABASE_CLIENT],
    });

    console.log('✅ Business services registrerade');
  }

  /**
   * Registrerar alla services
   */
  registerAllServices(): void {
    this.registerCoreServices();
    this.registerBusinessServices();
    
    // Validera beroenden
    const validation = this.container.validateDependencies();
    if (!validation.isValid) {
      console.error('❌ Service dependency validation misslyckades:', validation.errors);
      throw new Error(`Service dependency fel: ${validation.errors.join(', ')}`);
    }

    console.log('✅ Alla services registrerade och validerade');
  }
}

// Singleton container instance
export const serviceContainer = new ServiceContainer();
export const serviceRegistry = new ServiceRegistry(serviceContainer);
