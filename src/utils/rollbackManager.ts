/**
 * Rollback Manager - Automatisk rollback för Service Layer BaseService Migration
 * 
 * Hanterar automatisk rollback av migrerade tjänster vid problem:
 * - Övervakar felfrekvens och prestanda
 * - Triggar automatisk rollback vid tröskelvärden
 * - Loggar rollback-händelser för analys
 * - Stöder manuell rollback med säkerhetsvalidering
 * 
 * Följer GDPR-efterlevnad och svensk lokalisering.
 */

import { Platform } from 'react-native';
import { getCurrentRolloutConfig, updateRolloutPercentage, GradualRolloutConfig } from '../config/productionFeatureFlags';
import { MigrationMonitor } from './migrationMonitoring';

/**
 * Interface för rollback-händelse
 */
export interface RollbackEvent {
  eventId: string;
  serviceName: string;
  rollbackType: 'automatic' | 'manual' | 'scheduled';
  reason: string;
  timestamp: string;
  previousPercentage: number;
  newPercentage: number;
  errorRate: number;
  performanceImpact: number;
  metadata?: Record<string, any>;
}

/**
 * Interface för rollback-villkor
 */
export interface RollbackCondition {
  serviceName: string;
  errorRateThreshold: number;
  performanceThreshold: number; // millisekunder
  minimumSampleSize: number;
  timeWindow: number; // millisekunder
  enabled: boolean;
}

/**
 * Interface för rollback-resultat
 */
export interface RollbackResult {
  success: boolean;
  serviceName: string;
  rollbackType: 'automatic' | 'manual';
  previousPercentage: number;
  newPercentage: number;
  reason: string;
  timestamp: string;
  error?: string;
}

/**
 * RollbackManager - Huvudklass för rollback-hantering
 */
export class RollbackManager {
  private static instance: RollbackManager;
  private rollbackHistory: RollbackEvent[] = [];
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private rollbackCooldowns: Map<string, number> = new Map();

  private constructor() {
    this.initializeMonitoring();
  }

  /**
   * Singleton pattern för global rollback manager
   */
  static getInstance(): RollbackManager {
    if (!RollbackManager.instance) {
      RollbackManager.instance = new RollbackManager();
    }
    return RollbackManager.instance;
  }

  /**
   * Initialiserar övervakning för alla tjänster
   */
  private initializeMonitoring(): void {
    const config = getCurrentRolloutConfig();
    
    Object.entries(config.services).forEach(([key, serviceConfig]) => {
      if (serviceConfig.enabled && serviceConfig.monitoringEnabled) {
        this.startServiceMonitoring(serviceConfig);
      }
    });

    console.log('🔍 RollbackManager initialiserad - övervakar migrerade tjänster');
  }

  /**
   * Startar övervakning för en specifik tjänst
   */
  private startServiceMonitoring(serviceConfig: GradualRolloutConfig): void {
    const config = getCurrentRolloutConfig();
    const interval = setInterval(() => {
      this.checkServiceHealth(serviceConfig);
    }, config.globalSettings.monitoringInterval);

    this.monitoringIntervals.set(serviceConfig.serviceName, interval);
  }

  /**
   * Kontrollerar hälsostatus för en tjänst och triggar rollback vid behov
   */
  private async checkServiceHealth(serviceConfig: GradualRolloutConfig): Promise<void> {
    try {
      const metrics = MigrationMonitor.getInstance().getMetrics();
      const serviceMetrics = metrics.serviceBreakdown[serviceConfig.serviceName];

      if (!serviceMetrics || serviceMetrics.totalEvents < 10) {
        return; // Inte tillräckligt med data för analys
      }

      const errorRate = serviceMetrics.errorEvents / serviceMetrics.totalEvents;
      const avgLoadTime = serviceMetrics.averageLoadTime;

      // Kontrollera om rollback behövs
      const shouldRollback = this.shouldTriggerRollback(
        serviceConfig,
        errorRate,
        avgLoadTime,
        serviceMetrics.totalEvents
      );

      if (shouldRollback) {
        await this.executeAutomaticRollback(
          serviceConfig.serviceName,
          errorRate,
          avgLoadTime,
          'Automatisk rollback - tröskelvärden överskridna'
        );
      }
    } catch (error) {
      console.error(`❌ Fel vid hälsokontroll för ${serviceConfig.serviceName}:`, error);
    }
  }

  /**
   * Avgör om rollback ska triggas baserat på villkor
   */
  private shouldTriggerRollback(
    serviceConfig: GradualRolloutConfig,
    errorRate: number,
    avgLoadTime: number,
    sampleSize: number
  ): boolean {
    // Kontrollera cooldown
    const lastRollback = this.rollbackCooldowns.get(serviceConfig.serviceName);
    if (lastRollback && Date.now() - lastRollback < getCurrentRolloutConfig().globalSettings.rollbackCooldown) {
      return false;
    }

    // Kontrollera felfrekvens
    if (errorRate > serviceConfig.rollbackThreshold) {
      console.warn(`⚠️ Hög felfrekvens för ${serviceConfig.serviceName}: ${(errorRate * 100).toFixed(2)}%`);
      return true;
    }

    // Kontrollera prestanda (om laddningstid > 5 sekunder)
    if (avgLoadTime > 5000) {
      console.warn(`⚠️ Långsam prestanda för ${serviceConfig.serviceName}: ${avgLoadTime}ms`);
      return true;
    }

    return false;
  }

  /**
   * Utför automatisk rollback för en tjänst
   */
  public async executeAutomaticRollback(
    serviceName: string,
    errorRate: number,
    performanceImpact: number,
    reason: string
  ): Promise<RollbackResult> {
    try {
      const config = getCurrentRolloutConfig();
      const serviceKey = serviceName.toUpperCase().replace(/SERVICE$/, '_SERVICE');
      const serviceConfig = config.services[serviceKey];

      if (!serviceConfig) {
        throw new Error(`Tjänst ${serviceName} hittades inte i konfiguration`);
      }

      const previousPercentage = serviceConfig.rolloutPercentage;
      const newPercentage = Math.max(0, previousPercentage - 25); // Minska med 25%

      // Uppdatera rollout-procent
      updateRolloutPercentage(serviceName, newPercentage);

      // Logga rollback-händelse
      const rollbackEvent: RollbackEvent = {
        eventId: this.generateEventId(),
        serviceName,
        rollbackType: 'automatic',
        reason,
        timestamp: new Date().toISOString(),
        previousPercentage,
        newPercentage,
        errorRate,
        performanceImpact,
        metadata: {
          platform: Platform.OS,
          environment: config.environment,
        },
      };

      this.rollbackHistory.push(rollbackEvent);
      this.rollbackCooldowns.set(serviceName, Date.now());

      // Logga till konsol
      console.log(`🔄 Automatisk rollback utförd: ${serviceName}`);
      console.log(`   Procent: ${previousPercentage}% -> ${newPercentage}%`);
      console.log(`   Anledning: ${reason}`);

      // Logga till MigrationMonitor
      MigrationMonitor.getInstance().logMigrationEvent({
        serviceName,
        eventType: 'rollback',
        isMigrated: false,
        success: true,
        loadTime: 0,
        fallbackUsed: true,
        metadata: {
          rollbackType: 'automatic',
          reason,
          previousPercentage,
          newPercentage,
        },
      });

      return {
        success: true,
        serviceName,
        rollbackType: 'automatic',
        previousPercentage,
        newPercentage,
        reason,
        timestamp: rollbackEvent.timestamp,
      };
    } catch (error) {
      console.error(`❌ Fel vid automatisk rollback för ${serviceName}:`, error);
      
      return {
        success: false,
        serviceName,
        rollbackType: 'automatic',
        previousPercentage: 0,
        newPercentage: 0,
        reason,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Okänt fel',
      };
    }
  }

  /**
   * Utför manuell rollback för en tjänst
   */
  public async executeManualRollback(
    serviceName: string,
    targetPercentage: number,
    reason: string
  ): Promise<RollbackResult> {
    try {
      const config = getCurrentRolloutConfig();
      const serviceKey = serviceName.toUpperCase().replace(/SERVICE$/, '_SERVICE');
      const serviceConfig = config.services[serviceKey];

      if (!serviceConfig) {
        throw new Error(`Tjänst ${serviceName} hittades inte i konfiguration`);
      }

      const previousPercentage = serviceConfig.rolloutPercentage;
      const newPercentage = Math.max(0, Math.min(100, targetPercentage));

      // Uppdatera rollout-procent
      updateRolloutPercentage(serviceName, newPercentage);

      // Logga rollback-händelse
      const rollbackEvent: RollbackEvent = {
        eventId: this.generateEventId(),
        serviceName,
        rollbackType: 'manual',
        reason,
        timestamp: new Date().toISOString(),
        previousPercentage,
        newPercentage,
        errorRate: 0,
        performanceImpact: 0,
        metadata: {
          platform: Platform.OS,
          environment: config.environment,
        },
      };

      this.rollbackHistory.push(rollbackEvent);

      console.log(`🔧 Manuell rollback utförd: ${serviceName}`);
      console.log(`   Procent: ${previousPercentage}% -> ${newPercentage}%`);
      console.log(`   Anledning: ${reason}`);

      return {
        success: true,
        serviceName,
        rollbackType: 'manual',
        previousPercentage,
        newPercentage,
        reason,
        timestamp: rollbackEvent.timestamp,
      };
    } catch (error) {
      console.error(`❌ Fel vid manuell rollback för ${serviceName}:`, error);
      
      return {
        success: false,
        serviceName,
        rollbackType: 'manual',
        previousPercentage: 0,
        newPercentage: 0,
        reason,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Okänt fel',
      };
    }
  }

  /**
   * Hämtar rollback-historik
   */
  public getRollbackHistory(): RollbackEvent[] {
    return [...this.rollbackHistory];
  }

  /**
   * Stoppar övervakning för alla tjänster
   */
  public stopMonitoring(): void {
    this.monitoringIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.monitoringIntervals.clear();
    console.log('🛑 RollbackManager övervakning stoppad');
  }

  /**
   * Genererar unikt event-ID
   */
  private generateEventId(): string {
    return `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Exporterar singleton-instans för global användning
 */
export const rollbackManager = RollbackManager.getInstance();
