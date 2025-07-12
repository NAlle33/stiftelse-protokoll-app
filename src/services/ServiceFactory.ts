/**
 * ServiceFactory - Conditional Service Loading för BaseService Migration
 * 
 * Denna factory möjliggör säker övergång från legacy-tjänster till migrerade
 * BaseService-implementationer baserat på feature flags. Inkluderar fallback-logik,
 * felhantering och monitoring för migration.
 * 
 * Följer GDPR-efterlevnad och svensk lokalisering för alla tjänster.
 */

import { FEATURE_FLAGS, FeatureFlagManager } from '../config/featureFlags';
import { shouldUseMigratedService, getCurrentRolloutConfig } from '../config/productionFeatureFlags';
import { rollbackManager } from '../utils/rollbackManager';
import { BaseService } from './BaseService';

/**
 * Interface för service factory-resultat
 */
export interface ServiceFactoryResult<T> {
  service: T;
  isMigrated: boolean;
  serviceName: string;
  loadTime: number;
  fallbackUsed: boolean;
}

/**
 * Interface för migration monitoring
 */
export interface MigrationEvent {
  serviceName: string;
  isMigrated: boolean;
  success: boolean;
  loadTime: number;
  error?: Error;
  fallbackUsed: boolean;
  timestamp: string;
  environment: string;
}

/**
 * Migration monitoring och logging
 */
class MigrationMonitor {
  private static events: MigrationEvent[] = [];

  static logMigrationEvent(event: Omit<MigrationEvent, 'timestamp' | 'environment'>): void {
    if (!FEATURE_FLAGS.ENABLE_MIGRATION_LOGGING) {
      return;
    }

    const fullEvent: MigrationEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };

    this.events.push(fullEvent);

    // Logga händelse
    const status = event.success ? '✅' : '❌';
    const serviceType = event.isMigrated ? 'Migrerad' : 'Legacy';
    const fallback = event.fallbackUsed ? ' (fallback)' : '';
    
    console.log(`${status} Service Factory: ${event.serviceName} (${serviceType}${fallback}) - ${event.loadTime}ms`);
    
    if (event.error) {
      console.error(`   Fel: ${event.error.message}`);
    }

    // Varna för fallback-användning
    if (event.fallbackUsed && FEATURE_FLAGS.ENABLE_MIGRATION_WARNINGS) {
      console.warn(`⚠️  Fallback använd för ${event.serviceName}: ${event.error?.message || 'Okänt fel'}`);
    }
  }

  static getMigrationMetrics(): {
    totalLoads: number;
    successfulMigrations: number;
    fallbackUsage: number;
    averageLoadTime: number;
    errorRate: number;
  } {
    if (this.events.length === 0) {
      return {
        totalLoads: 0,
        successfulMigrations: 0,
        fallbackUsage: 0,
        averageLoadTime: 0,
        errorRate: 0,
      };
    }

    const totalLoads = this.events.length;
    const successfulMigrations = this.events.filter(e => e.success && e.isMigrated).length;
    const fallbackUsage = this.events.filter(e => e.fallbackUsed).length;
    const totalLoadTime = this.events.reduce((sum, e) => sum + e.loadTime, 0);
    const errors = this.events.filter(e => !e.success).length;

    return {
      totalLoads,
      successfulMigrations,
      fallbackUsage,
      averageLoadTime: Math.round(totalLoadTime / totalLoads),
      errorRate: Math.round((errors / totalLoads) * 100),
    };
  }

  static clearMetrics(): void {
    this.events = [];
  }
}

/**
 * ServiceFactory - Huvudklass för conditional service loading
 */
export class ServiceFactory {
  /**
   * Skapar UserService baserat på feature flags
   */
  static async getUserService(): Promise<ServiceFactoryResult<any>> {
    const startTime = Date.now();
    const serviceName = 'UserService';
    
    try {
      if (FEATURE_FLAGS.USE_MIGRATED_USER_SERVICE) {
        // Försök ladda migrerad service
        try {
          const { UserServiceMigrated } = await import('./UserServiceMigrated');
          const service = new UserServiceMigrated();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: true,
            success: true,
            loadTime,
            fallbackUsed: false,
          });

          return {
            service,
            isMigrated: true,
            serviceName,
            loadTime,
            fallbackUsed: false,
          };
        } catch (error) {
          // Fallback till legacy service
          console.warn(`⚠️  Fel vid laddning av UserServiceMigrated, använder legacy: ${error.message}`);
          
          const { UserService } = await import('./userService');
          const service = new UserService();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: false,
            success: true,
            loadTime,
            error: error as Error,
            fallbackUsed: true,
          });

          return {
            service,
            isMigrated: false,
            serviceName,
            loadTime,
            fallbackUsed: true,
          };
        }
      } else {
        // Använd legacy service
        const { UserService } = await import('./userService');
        const service = new UserService();
        const loadTime = Date.now() - startTime;

        MigrationMonitor.logMigrationEvent({
          serviceName,
          isMigrated: false,
          success: true,
          loadTime,
          fallbackUsed: false,
        });

        return {
          service,
          isMigrated: false,
          serviceName,
          loadTime,
          fallbackUsed: false,
        };
      }
    } catch (error) {
      const loadTime = Date.now() - startTime;
      
      MigrationMonitor.logMigrationEvent({
        serviceName,
        isMigrated: false,
        success: false,
        loadTime,
        error: error as Error,
        fallbackUsed: false,
      });

      throw new Error(`Kunde inte ladda ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Skapar VideoMeetingService baserat på feature flags
   */
  static async getVideoMeetingService(): Promise<ServiceFactoryResult<any>> {
    const startTime = Date.now();
    const serviceName = 'VideoMeetingService';
    
    try {
      if (FEATURE_FLAGS.USE_MIGRATED_VIDEO_SERVICE) {
        try {
          const { VideoMeetingServiceMigrated } = await import('./VideoMeetingServiceMigrated');
          const service = new VideoMeetingServiceMigrated();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: true,
            success: true,
            loadTime,
            fallbackUsed: false,
          });

          return {
            service,
            isMigrated: true,
            serviceName,
            loadTime,
            fallbackUsed: false,
          };
        } catch (error) {
          console.warn(`⚠️  Fel vid laddning av VideoMeetingServiceMigrated, använder legacy: ${error.message}`);
          
          const { VideoMeetingService } = await import('./videoMeetingService');
          const service = new VideoMeetingService();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: false,
            success: true,
            loadTime,
            error: error as Error,
            fallbackUsed: true,
          });

          return {
            service,
            isMigrated: false,
            serviceName,
            loadTime,
            fallbackUsed: true,
          };
        }
      } else {
        const { VideoMeetingService } = await import('./videoMeetingService');
        const service = new VideoMeetingService();
        const loadTime = Date.now() - startTime;

        MigrationMonitor.logMigrationEvent({
          serviceName,
          isMigrated: false,
          success: true,
          loadTime,
          fallbackUsed: false,
        });

        return {
          service,
          isMigrated: false,
          serviceName,
          loadTime,
          fallbackUsed: false,
        };
      }
    } catch (error) {
      const loadTime = Date.now() - startTime;
      
      MigrationMonitor.logMigrationEvent({
        serviceName,
        isMigrated: false,
        success: false,
        loadTime,
        error: error as Error,
        fallbackUsed: false,
      });

      throw new Error(`Kunde inte ladda ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Skapar WebRTCSignalingService baserat på feature flags
   */
  static async getWebRTCSignalingService(): Promise<ServiceFactoryResult<any>> {
    const startTime = Date.now();
    const serviceName = 'WebRTCSignalingService';
    
    try {
      if (FEATURE_FLAGS.USE_MIGRATED_SIGNALING_SERVICE) {
        try {
          const { WebRTCSignalingServiceMigrated } = await import('./WebRTCSignalingServiceMigrated');
          const service = new WebRTCSignalingServiceMigrated();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: true,
            success: true,
            loadTime,
            fallbackUsed: false,
          });

          return {
            service,
            isMigrated: true,
            serviceName,
            loadTime,
            fallbackUsed: false,
          };
        } catch (error) {
          console.warn(`⚠️  Fel vid laddning av WebRTCSignalingServiceMigrated, använder legacy: ${error.message}`);
          
          const { WebRTCSignalingService } = await import('./webrtcSignalingService');
          const service = new WebRTCSignalingService();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: false,
            success: true,
            loadTime,
            error: error as Error,
            fallbackUsed: true,
          });

          return {
            service,
            isMigrated: false,
            serviceName,
            loadTime,
            fallbackUsed: true,
          };
        }
      } else {
        const { WebRTCSignalingService } = await import('./webrtcSignalingService');
        const service = new WebRTCSignalingService();
        const loadTime = Date.now() - startTime;

        MigrationMonitor.logMigrationEvent({
          serviceName,
          isMigrated: false,
          success: true,
          loadTime,
          fallbackUsed: false,
        });

        return {
          service,
          isMigrated: false,
          serviceName,
          loadTime,
          fallbackUsed: false,
        };
      }
    } catch (error) {
      const loadTime = Date.now() - startTime;
      
      MigrationMonitor.logMigrationEvent({
        serviceName,
        isMigrated: false,
        success: false,
        loadTime,
        error: error as Error,
        fallbackUsed: false,
      });

      throw new Error(`Kunde inte ladda ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Skapar BackupService baserat på feature flags och production rollout
   */
  static async getBackupService(userId?: string, sessionId?: string): Promise<ServiceFactoryResult<any>> {
    const startTime = Date.now();
    const serviceName = 'BackupService';

    try {
      // Kontrollera både feature flags och production rollout
      const useFeatureFlag = FEATURE_FLAGS.USE_MIGRATED_BACKUP_SERVICE;
      const useProductionRollout = shouldUseMigratedService(serviceName, userId, sessionId);

      if (useFeatureFlag || useProductionRollout) {
        try {
          const { BackupServiceMigrated } = await import('./BackupServiceMigrated');
          const service = new BackupServiceMigrated();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: true,
            success: true,
            loadTime,
            fallbackUsed: false,
          });

          return {
            service,
            isMigrated: true,
            serviceName,
            loadTime,
            fallbackUsed: false,
          };
        } catch (error) {
          console.warn(`⚠️  Fel vid laddning av BackupServiceMigrated, använder legacy: ${error.message}`);

          const { BackupService } = await import('./backupService');
          const service = new BackupService();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: false,
            success: true,
            loadTime,
            error: error as Error,
            fallbackUsed: true,
          });

          return {
            service,
            isMigrated: false,
            serviceName,
            loadTime,
            fallbackUsed: true,
          };
        }
      } else {
        const { backupService } = await import('./backupService');
        const loadTime = Date.now() - startTime;

        MigrationMonitor.logMigrationEvent({
          serviceName,
          isMigrated: false,
          success: true,
          loadTime,
          fallbackUsed: false,
        });

        return {
          service: backupService,
          isMigrated: false,
          serviceName,
          loadTime,
          fallbackUsed: false,
        };
      }
    } catch (error) {
      const loadTime = Date.now() - startTime;

      MigrationMonitor.logMigrationEvent({
        serviceName,
        isMigrated: false,
        success: false,
        loadTime,
        error: error as Error,
        fallbackUsed: false,
      });

      throw new Error(`Kunde inte ladda ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Skapar NetworkConnectivityService baserat på feature flags och production rollout
   */
  static async getNetworkConnectivityService(userId?: string, sessionId?: string): Promise<ServiceFactoryResult<any>> {
    const startTime = Date.now();
    const serviceName = 'NetworkConnectivityService';

    try {
      // Kontrollera både feature flags och production rollout
      const useFeatureFlag = FEATURE_FLAGS.USE_MIGRATED_NETWORK_SERVICE;
      const useProductionRollout = shouldUseMigratedService(serviceName, userId, sessionId);

      if (useFeatureFlag || useProductionRollout) {
        try {
          const { NetworkConnectivityServiceMigrated } = await import('./NetworkConnectivityServiceMigrated');
          const service = new NetworkConnectivityServiceMigrated();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: true,
            success: true,
            loadTime,
            fallbackUsed: false,
          });

          return {
            service,
            isMigrated: true,
            serviceName,
            loadTime,
            fallbackUsed: false,
          };
        } catch (error) {
          console.warn(`⚠️  Fel vid laddning av NetworkConnectivityServiceMigrated, använder legacy: ${error.message}`);

          const { networkConnectivityService } = await import('./networkConnectivityService');
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: false,
            success: true,
            loadTime,
            error: error as Error,
            fallbackUsed: true,
          });

          return {
            service: networkConnectivityService,
            isMigrated: false,
            serviceName,
            loadTime,
            fallbackUsed: true,
          };
        }
      } else {
        const { networkConnectivityService } = await import('./networkConnectivityService');
        const loadTime = Date.now() - startTime;

        MigrationMonitor.logMigrationEvent({
          serviceName,
          isMigrated: false,
          success: true,
          loadTime,
          fallbackUsed: false,
        });

        return {
          service: networkConnectivityService,
          isMigrated: false,
          serviceName,
          loadTime,
          fallbackUsed: false,
        };
      }
    } catch (error) {
      const loadTime = Date.now() - startTime;

      MigrationMonitor.logMigrationEvent({
        serviceName,
        isMigrated: false,
        success: false,
        loadTime,
        error: error as Error,
        fallbackUsed: false,
      });

      throw new Error(`Kunde inte ladda ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Skapar WebRTCPeerService baserat på feature flags
   */
  static async getWebRTCPeerService(): Promise<ServiceFactoryResult<any>> {
    const startTime = Date.now();
    const serviceName = 'WebRTCPeerService';

    try {
      if (FEATURE_FLAGS.USE_MIGRATED_WEBRTC_PEER_SERVICE) {
        try {
          const { WebRTCPeerServiceMigrated } = await import('./WebRTCPeerServiceMigrated');
          const service = new WebRTCPeerServiceMigrated();
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: true,
            success: true,
            loadTime,
            fallbackUsed: false,
          });

          return {
            service,
            isMigrated: true,
            serviceName,
            loadTime,
            fallbackUsed: false,
          };
        } catch (error) {
          console.warn(`⚠️  Fel vid laddning av WebRTCPeerServiceMigrated, använder legacy: ${error.message}`);

          const { webrtcPeerService } = await import('./webrtcPeerService');
          const loadTime = Date.now() - startTime;

          MigrationMonitor.logMigrationEvent({
            serviceName,
            isMigrated: false,
            success: true,
            loadTime,
            error: error as Error,
            fallbackUsed: true,
          });

          return {
            service: webrtcPeerService,
            isMigrated: false,
            serviceName,
            loadTime,
            fallbackUsed: true,
          };
        }
      } else {
        const { webrtcPeerService } = await import('./webrtcPeerService');
        const loadTime = Date.now() - startTime;

        MigrationMonitor.logMigrationEvent({
          serviceName,
          isMigrated: false,
          success: true,
          loadTime,
          fallbackUsed: false,
        });

        return {
          service: webrtcPeerService,
          isMigrated: false,
          serviceName,
          loadTime,
          fallbackUsed: false,
        };
      }
    } catch (error) {
      const loadTime = Date.now() - startTime;

      MigrationMonitor.logMigrationEvent({
        serviceName,
        isMigrated: false,
        success: false,
        loadTime,
        error: error as Error,
        fallbackUsed: false,
      });

      throw new Error(`Kunde inte ladda ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Hämtar migration metrics för monitoring
   */
  static getMigrationMetrics() {
    return MigrationMonitor.getMigrationMetrics();
  }

  /**
   * Rensar migration metrics
   */
  static clearMigrationMetrics(): void {
    MigrationMonitor.clearMetrics();
  }

  /**
   * Genererar migration rapport
   */
  static generateMigrationReport(): string {
    const metrics = MigrationMonitor.getMigrationMetrics();
    const flagStatus = FeatureFlagManager.getMigrationStatus();

    return `
# Service Migration Report

## Feature Flag Status
- **Totala tjänster**: ${flagStatus.totalServices}
- **Migrerade tjänster**: ${flagStatus.migratedServices} (${flagStatus.migrationPercentage}%)
- **Aktiva migreringar**: ${flagStatus.activeMigrations.join(', ') || 'Inga'}

## Runtime Metrics
- **Totala laddningar**: ${metrics.totalLoads}
- **Framgångsrika migreringar**: ${metrics.successfulMigrations}
- **Fallback-användning**: ${metrics.fallbackUsage}
- **Genomsnittlig laddningstid**: ${metrics.averageLoadTime}ms
- **Felfrekvens**: ${metrics.errorRate}%

## Rekommendationer
${metrics.fallbackUsage > 0 ? '⚠️  Fallback används - kontrollera migrerade tjänster' : '✅ Inga fallbacks - migration fungerar korrekt'}
${metrics.errorRate > 5 ? '❌ Hög felfrekvens - undersök tjänstefel' : '✅ Låg felfrekvens - stabil migration'}
${metrics.averageLoadTime > 1000 ? '⚠️  Långsam laddning - optimera tjänster' : '✅ Snabb laddning - bra prestanda'}
`;
  }
}

// Exportera monitoring för extern användning
export { MigrationMonitor };
