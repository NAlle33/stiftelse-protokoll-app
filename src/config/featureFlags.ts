/**
 * Feature Flags Configuration - Service Layer BaseService Migration
 * 
 * Denna konfiguration möjliggör gradvis rollout av migrerade BaseService-tjänster
 * med säker fallback till legacy-implementationer. Stöder miljövariabler för
 * produktionsdeploy och utvecklingsmiljö.
 * 
 * Följer GDPR-efterlevnad och svensk lokalisering för alla flaggor.
 */

import { Platform } from 'react-native';

/**
 * Interface för feature flags med svenska beskrivningar
 */
export interface FeatureFlags {
  // Service Migration Flags
  USE_MIGRATED_USER_SERVICE: boolean;
  USE_MIGRATED_VIDEO_SERVICE: boolean;
  USE_MIGRATED_SIGNALING_SERVICE: boolean;
  USE_MIGRATED_BACKUP_SERVICE: boolean;
  USE_MIGRATED_NETWORK_SERVICE: boolean;
  USE_MIGRATED_WEBRTC_PEER_SERVICE: boolean;
  
  // Migration Monitoring Flags
  ENABLE_MIGRATION_LOGGING: boolean;
  ENABLE_MIGRATION_METRICS: boolean;
  ENABLE_FALLBACK_MONITORING: boolean;
  
  // Development and Testing Flags
  ENABLE_SERVICE_DEBUG_MODE: boolean;
  FORCE_LEGACY_SERVICES: boolean;
  ENABLE_MIGRATION_WARNINGS: boolean;
}

/**
 * Default feature flags för utvecklingsmiljö
 */
const DEFAULT_FLAGS: FeatureFlags = {
  // Service Migration - Börja med false för säker rollout
  USE_MIGRATED_USER_SERVICE: false,
  USE_MIGRATED_VIDEO_SERVICE: false,
  USE_MIGRATED_SIGNALING_SERVICE: false,
  USE_MIGRATED_BACKUP_SERVICE: false,
  USE_MIGRATED_NETWORK_SERVICE: false,
  USE_MIGRATED_WEBRTC_PEER_SERVICE: false,
  
  // Migration Monitoring - Aktiverat för övervakning
  ENABLE_MIGRATION_LOGGING: true,
  ENABLE_MIGRATION_METRICS: true,
  ENABLE_FALLBACK_MONITORING: true,
  
  // Development - Aktiverat i utvecklingsmiljö
  ENABLE_SERVICE_DEBUG_MODE: __DEV__,
  FORCE_LEGACY_SERVICES: false,
  ENABLE_MIGRATION_WARNINGS: __DEV__,
};

/**
 * Miljöspecifika konfigurationer
 */
const ENVIRONMENT_OVERRIDES: Record<string, Partial<FeatureFlags>> = {
  development: {
    USE_MIGRATED_USER_SERVICE: true, // Testa migrerade tjänster i dev
    USE_MIGRATED_VIDEO_SERVICE: true, // Aktivera VideoMeetingServiceMigrated i dev
    USE_MIGRATED_SIGNALING_SERVICE: true, // Aktivera WebRTCSignalingServiceMigrated i dev
    USE_MIGRATED_BACKUP_SERVICE: true, // Aktivera nya migrerade tjänster i dev
    USE_MIGRATED_NETWORK_SERVICE: true,
    USE_MIGRATED_WEBRTC_PEER_SERVICE: true,
    ENABLE_SERVICE_DEBUG_MODE: true,
    ENABLE_MIGRATION_WARNINGS: true,
  },

  staging: {
    USE_MIGRATED_USER_SERVICE: true,
    USE_MIGRATED_VIDEO_SERVICE: true, // Aktivera för staging-testning
    USE_MIGRATED_SIGNALING_SERVICE: true, // Aktivera för staging-testning
    USE_MIGRATED_BACKUP_SERVICE: true, // Aktivera för staging-testning
    USE_MIGRATED_NETWORK_SERVICE: true,
    USE_MIGRATED_WEBRTC_PEER_SERVICE: true,
    ENABLE_MIGRATION_LOGGING: true,
    ENABLE_MIGRATION_METRICS: true,
  },

  production: {
    // Produktionsflags styrs av miljövariabler och gradvis rollout
    USE_MIGRATED_BACKUP_SERVICE: false, // Börja med false, styrs av productionFeatureFlags
    USE_MIGRATED_NETWORK_SERVICE: false,
    USE_MIGRATED_WEBRTC_PEER_SERVICE: false,
    ENABLE_SERVICE_DEBUG_MODE: false,
    ENABLE_MIGRATION_WARNINGS: false,
  },
};

/**
 * Läser miljövariabler för produktionskonfiguration
 */
function getEnvironmentFlags(): Partial<FeatureFlags> {
  if (typeof process === 'undefined' || !process.env) {
    return {};
  }

  return {
    USE_MIGRATED_USER_SERVICE: process.env.USE_MIGRATED_USER_SERVICE === 'true',
    USE_MIGRATED_VIDEO_SERVICE: process.env.USE_MIGRATED_VIDEO_SERVICE === 'true',
    USE_MIGRATED_SIGNALING_SERVICE: process.env.USE_MIGRATED_SIGNALING_SERVICE === 'true',
    USE_MIGRATED_BACKUP_SERVICE: process.env.USE_MIGRATED_BACKUP_SERVICE === 'true',
    USE_MIGRATED_NETWORK_SERVICE: process.env.USE_MIGRATED_NETWORK_SERVICE === 'true',
    USE_MIGRATED_WEBRTC_PEER_SERVICE: process.env.USE_MIGRATED_WEBRTC_PEER_SERVICE === 'true',
    ENABLE_MIGRATION_LOGGING: process.env.ENABLE_MIGRATION_LOGGING !== 'false',
    ENABLE_MIGRATION_METRICS: process.env.ENABLE_MIGRATION_METRICS !== 'false',
    FORCE_LEGACY_SERVICES: process.env.FORCE_LEGACY_SERVICES === 'true',
  };
}

/**
 * Bestämmer aktuell miljö
 */
function getCurrentEnvironment(): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV || 'development';
  }
  return __DEV__ ? 'development' : 'production';
}

/**
 * Skapar slutgiltig feature flags-konfiguration
 */
function createFeatureFlags(): FeatureFlags {
  const environment = getCurrentEnvironment();
  const environmentOverrides = ENVIRONMENT_OVERRIDES[environment] || {};
  const envFlags = getEnvironmentFlags();
  
  const flags: FeatureFlags = {
    ...DEFAULT_FLAGS,
    ...environmentOverrides,
    ...envFlags,
  };

  // Säkerhetsvalidering - tvinga legacy om FORCE_LEGACY_SERVICES är true
  if (flags.FORCE_LEGACY_SERVICES) {
    flags.USE_MIGRATED_USER_SERVICE = false;
    flags.USE_MIGRATED_VIDEO_SERVICE = false;
    flags.USE_MIGRATED_SIGNALING_SERVICE = false;
    flags.USE_MIGRATED_BACKUP_SERVICE = false;
    flags.USE_MIGRATED_NETWORK_SERVICE = false;
    flags.USE_MIGRATED_WEBRTC_PEER_SERVICE = false;
  }

  return flags;
}

/**
 * Exporterad feature flags-konfiguration
 */
export const FEATURE_FLAGS = createFeatureFlags();

/**
 * Utility-funktioner för feature flag-hantering
 */
export class FeatureFlagManager {
  /**
   * Kontrollerar om en specifik service-migration är aktiverad
   */
  static isServiceMigrationEnabled(serviceName: 'user' | 'video' | 'signaling' | 'backup' | 'network' | 'webrtc_peer'): boolean {
    switch (serviceName) {
      case 'user':
        return FEATURE_FLAGS.USE_MIGRATED_USER_SERVICE;
      case 'video':
        return FEATURE_FLAGS.USE_MIGRATED_VIDEO_SERVICE;
      case 'signaling':
        return FEATURE_FLAGS.USE_MIGRATED_SIGNALING_SERVICE;
      case 'backup':
        return FEATURE_FLAGS.USE_MIGRATED_BACKUP_SERVICE;
      case 'network':
        return FEATURE_FLAGS.USE_MIGRATED_NETWORK_SERVICE;
      case 'webrtc_peer':
        return FEATURE_FLAGS.USE_MIGRATED_WEBRTC_PEER_SERVICE;
      default:
        return false;
    }
  }

  /**
   * Loggar feature flag-status för debugging
   */
  static logFeatureFlagStatus(): void {
    if (!FEATURE_FLAGS.ENABLE_SERVICE_DEBUG_MODE) {
      return;
    }

    console.log('🏁 Feature Flags Status:');
    console.log(`  📱 Platform: ${Platform.OS}`);
    console.log(`  🌍 Environment: ${getCurrentEnvironment()}`);
    console.log(`  👤 User Service: ${FEATURE_FLAGS.USE_MIGRATED_USER_SERVICE ? 'Migrerad' : 'Legacy'}`);
    console.log(`  📹 Video Service: ${FEATURE_FLAGS.USE_MIGRATED_VIDEO_SERVICE ? 'Migrerad' : 'Legacy'}`);
    console.log(`  📡 Signaling Service: ${FEATURE_FLAGS.USE_MIGRATED_SIGNALING_SERVICE ? 'Migrerad' : 'Legacy'}`);
    console.log(`  📊 Migration Logging: ${FEATURE_FLAGS.ENABLE_MIGRATION_LOGGING ? 'Aktiverad' : 'Inaktiverad'}`);
    console.log(`  ⚠️  Force Legacy: ${FEATURE_FLAGS.FORCE_LEGACY_SERVICES ? 'Ja' : 'Nej'}`);
  }

  /**
   * Validerar feature flag-konfiguration
   */
  static validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Kontrollera att inte alla tjänster är migrerade samtidigt i produktion
    const environment = getCurrentEnvironment();
    if (environment === 'production') {
      const allMigrated = FEATURE_FLAGS.USE_MIGRATED_USER_SERVICE &&
                         FEATURE_FLAGS.USE_MIGRATED_VIDEO_SERVICE &&
                         FEATURE_FLAGS.USE_MIGRATED_SIGNALING_SERVICE;
      
      if (allMigrated && !process.env.ALLOW_FULL_MIGRATION) {
        errors.push('Alla tjänster kan inte migreras samtidigt i produktion utan ALLOW_FULL_MIGRATION=true');
      }
    }

    // Kontrollera att monitoring är aktiverat om migration är aktiverad
    const anyMigrationEnabled = FEATURE_FLAGS.USE_MIGRATED_USER_SERVICE ||
                               FEATURE_FLAGS.USE_MIGRATED_VIDEO_SERVICE ||
                               FEATURE_FLAGS.USE_MIGRATED_SIGNALING_SERVICE;

    if (anyMigrationEnabled && !FEATURE_FLAGS.ENABLE_MIGRATION_LOGGING) {
      errors.push('Migration logging bör vara aktiverad när tjänster migreras');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Hämtar migrationsstatus för rapportering
   */
  static getMigrationStatus(): {
    totalServices: number;
    migratedServices: number;
    migrationPercentage: number;
    activeMigrations: string[];
  } {
    const migrations = [
      { name: 'UserService', enabled: FEATURE_FLAGS.USE_MIGRATED_USER_SERVICE },
      { name: 'VideoService', enabled: FEATURE_FLAGS.USE_MIGRATED_VIDEO_SERVICE },
      { name: 'SignalingService', enabled: FEATURE_FLAGS.USE_MIGRATED_SIGNALING_SERVICE },
    ];

    const migratedServices = migrations.filter(m => m.enabled).length;
    const activeMigrations = migrations.filter(m => m.enabled).map(m => m.name);

    return {
      totalServices: migrations.length,
      migratedServices,
      migrationPercentage: Math.round((migratedServices / migrations.length) * 100),
      activeMigrations,
    };
  }
}

/**
 * Initialisering - logga status vid import
 */
if (FEATURE_FLAGS.ENABLE_SERVICE_DEBUG_MODE) {
  FeatureFlagManager.logFeatureFlagStatus();
  
  const validation = FeatureFlagManager.validateConfiguration();
  if (!validation.isValid) {
    console.warn('⚠️  Feature Flag Validation Warnings:');
    validation.errors.forEach(error => console.warn(`   - ${error}`));
  }
}
