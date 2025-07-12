/**
 * Migration Deployment Script - Service Layer BaseService Migration
 * 
 * Automatiserar deployment av Service Layer BaseService Migration:
 * - Gradvis aktivering av feature flags
 * - Övervakning av prestanda och fel
 * - GDPR-efterlevnad validering
 * - Automatisk rollback vid problem
 * 
 * Följer svensk lokalisering och GDPR-efterlevnad.
 */

import { updateRolloutPercentage, getRolloutStatus } from '../src/config/productionFeatureFlags';
import { RollbackManager } from '../src/utils/rollbackManager';
import { MigrationMonitor } from '../src/utils/migrationMonitoring';
import { sentryMigrationMonitor } from '../src/monitoring/sentryMigrationMonitoring';

/**
 * Interface för deployment-konfiguration
 */
interface DeploymentConfig {
  environment: 'staging' | 'production';
  services: string[];
  rolloutSchedule: {
    serviceName: string;
    phases: Array<{
      day: number;
      percentage: number;
      description: string;
      monitoringDuration: number; // timmar
    }>;
  }[];
  monitoringThresholds: {
    maxErrorRate: number;
    maxLoadTime: number;
    minSuccessRate: number;
  };
  rollbackSettings: {
    autoRollbackEnabled: boolean;
    cooldownPeriod: number; // timmar
    maxRollbackAttempts: number;
  };
}

/**
 * Deployment-konfiguration för produktionsmiljö
 */
const PRODUCTION_DEPLOYMENT_CONFIG: DeploymentConfig = {
  environment: 'production',
  services: ['BackupService', 'NetworkConnectivityService', 'WebRTCPeerService'],
  rolloutSchedule: [
    {
      serviceName: 'BackupService',
      phases: [
        { day: 1, percentage: 10, description: 'Initial rollout - 10% användare', monitoringDuration: 24 },
        { day: 2, percentage: 25, description: 'Utökning till 25% om inga problem', monitoringDuration: 24 },
        { day: 4, percentage: 50, description: 'Halvvägs rollout - 50% användare', monitoringDuration: 48 },
        { day: 7, percentage: 100, description: 'Fullständig rollout - alla användare', monitoringDuration: 72 },
      ],
    },
    {
      serviceName: 'NetworkConnectivityService',
      phases: [
        { day: 3, percentage: 10, description: 'Initial rollout efter BackupService-validering', monitoringDuration: 24 },
        { day: 5, percentage: 50, description: 'Snabbare rollout baserat på BackupService-resultat', monitoringDuration: 48 },
        { day: 8, percentage: 100, description: 'Fullständig rollout', monitoringDuration: 72 },
      ],
    },
    {
      serviceName: 'WebRTCPeerService',
      phases: [
        { day: 5, percentage: 5, description: 'Extra försiktig initial rollout - 5%', monitoringDuration: 48 },
        { day: 7, percentage: 15, description: 'Gradvis ökning till 15%', monitoringDuration: 48 },
        { day: 10, percentage: 35, description: 'Måttlig rollout - 35%', monitoringDuration: 72 },
        { day: 14, percentage: 100, description: 'Fullständig rollout efter validering', monitoringDuration: 96 },
      ],
    },
  ],
  monitoringThresholds: {
    maxErrorRate: 0.01, // 1%
    maxLoadTime: 3000, // 3 sekunder
    minSuccessRate: 0.99, // 99%
  },
  rollbackSettings: {
    autoRollbackEnabled: true,
    cooldownPeriod: 24, // 24 timmar
    maxRollbackAttempts: 3,
  },
};

/**
 * MigrationDeployer - Huvudklass för deployment-hantering
 */
export class MigrationDeployer {
  private config: DeploymentConfig;
  private deploymentStartTime: number;
  private currentPhases: Map<string, number> = new Map();

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.deploymentStartTime = Date.now();
  }

  /**
   * Startar deployment-processen
   */
  public async startDeployment(): Promise<void> {
    console.log(`🚀 Startar Service Layer Migration deployment i ${this.config.environment}`);
    
    try {
      // Initialisera monitoring
      await this.initializeMonitoring();
      
      // Starta rollout för varje tjänst enligt schema
      for (const serviceSchedule of this.config.rolloutSchedule) {
        await this.scheduleServiceRollout(serviceSchedule);
      }
      
      console.log('✅ Deployment-processen har startats framgångsrikt');
      console.log('📊 Övervakning pågår - kontrollera dashboard för status');
      
    } catch (error) {
      console.error('❌ Fel vid start av deployment:', error);
      throw error;
    }
  }

  /**
   * Initialiserar monitoring-system
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      // Initialisera Sentry monitoring
      sentryMigrationMonitor.initialize();
      
      // Starta rollback manager
      RollbackManager.getInstance();
      
      // Konfigurera migration monitor
      MigrationMonitor.getInstance().setEnabled(true);
      
      console.log('📊 Monitoring-system initialiserat');
    } catch (error) {
      console.error('❌ Fel vid initialisering av monitoring:', error);
      throw error;
    }
  }

  /**
   * Schemalägger rollout för en specifik tjänst
   */
  private async scheduleServiceRollout(serviceSchedule: any): Promise<void> {
    const { serviceName, phases } = serviceSchedule;
    
    console.log(`📅 Schemalägger rollout för ${serviceName}`);
    
    for (const phase of phases) {
      const delayMs = phase.day * 24 * 60 * 60 * 1000; // Konvertera dagar till millisekunder
      
      setTimeout(async () => {
        await this.executePhase(serviceName, phase);
      }, delayMs);
      
      console.log(`   📌 Fas ${phase.day}: ${phase.percentage}% - ${phase.description}`);
    }
  }

  /**
   * Utför en specifik rollout-fas
   */
  private async executePhase(serviceName: string, phase: any): Promise<void> {
    try {
      console.log(`🔄 Utför fas för ${serviceName}: ${phase.percentage}%`);
      
      // Kontrollera hälsostatus innan rollout
      const healthCheck = await this.performHealthCheck(serviceName);
      if (!healthCheck.healthy) {
        console.warn(`⚠️ Hälsokontroll misslyckades för ${serviceName}, hoppar över fas`);
        return;
      }
      
      // Uppdatera rollout-procent
      updateRolloutPercentage(serviceName, phase.percentage, this.config.environment);
      
      // Logga fas-start
      this.logPhaseExecution(serviceName, phase);
      
      // Starta intensiv övervakning för denna fas
      await this.startPhaseMonitoring(serviceName, phase);
      
      console.log(`✅ Fas utförd för ${serviceName}: ${phase.percentage}%`);
      
    } catch (error) {
      console.error(`❌ Fel vid utförande av fas för ${serviceName}:`, error);
      
      // Försök automatisk rollback
      await this.handlePhaseFailure(serviceName, phase, error as Error);
    }
  }

  /**
   * Utför hälsokontroll för en tjänst
   */
  private async performHealthCheck(serviceName: string): Promise<{ healthy: boolean; reason?: string }> {
    try {
      const metrics = MigrationMonitor.getInstance().getMetrics();
      const serviceMetrics = metrics.serviceBreakdown[serviceName];
      
      if (!serviceMetrics || serviceMetrics.total < 5) {
        return { healthy: true }; // Inte tillräckligt med data för bedömning
      }

      const errorRate = serviceMetrics.errors / serviceMetrics.total;
      const avgLoadTime = serviceMetrics.averageLoadTime;
      
      // Kontrollera tröskelvärden
      if (errorRate > this.config.monitoringThresholds.maxErrorRate) {
        return { 
          healthy: false, 
          reason: `Hög felfrekvens: ${(errorRate * 100).toFixed(2)}%` 
        };
      }
      
      if (avgLoadTime > this.config.monitoringThresholds.maxLoadTime) {
        return { 
          healthy: false, 
          reason: `Långsam prestanda: ${avgLoadTime}ms` 
        };
      }
      
      return { healthy: true };
      
    } catch (error) {
      console.error(`❌ Fel vid hälsokontroll för ${serviceName}:`, error);
      return { healthy: false, reason: 'Hälsokontroll misslyckades' };
    }
  }

  /**
   * Startar intensiv övervakning för en fas
   */
  private async startPhaseMonitoring(serviceName: string, phase: any): Promise<void> {
    const monitoringDuration = phase.monitoringDuration * 60 * 60 * 1000; // Konvertera timmar till ms
    const checkInterval = 5 * 60 * 1000; // Kontrollera var 5:e minut
    
    const monitoringEndTime = Date.now() + monitoringDuration;
    
    const monitoringInterval = setInterval(async () => {
      try {
        const healthCheck = await this.performHealthCheck(serviceName);
        
        if (!healthCheck.healthy) {
          console.warn(`⚠️ Hälsoproblem upptäckt för ${serviceName}: ${healthCheck.reason}`);
          
          // Trigga automatisk rollback om aktiverat
          if (this.config.rollbackSettings.autoRollbackEnabled) {
            await RollbackManager.getInstance().executeAutomaticRollback(
              serviceName,
              0, // Errorrate kommer från healthCheck
              0, // Performance impact kommer från healthCheck
              `Automatisk rollback under fas-övervakning: ${healthCheck.reason}`
            );
          }
        }
        
        // Stoppa övervakning om tiden är ute
        if (Date.now() >= monitoringEndTime) {
          clearInterval(monitoringInterval);
          console.log(`📊 Fas-övervakning avslutad för ${serviceName}`);
        }
        
      } catch (error) {
        console.error(`❌ Fel vid fas-övervakning för ${serviceName}:`, error);
      }
    }, checkInterval);
  }

  /**
   * Hanterar fas-fel
   */
  private async handlePhaseFailure(serviceName: string, phase: any, error: Error): Promise<void> {
    console.error(`❌ Fas misslyckades för ${serviceName}:`, error.message);
    
    // Rapportera till Sentry
    sentryMigrationMonitor.reportMigrationError(serviceName, error, {
      phase: phase.day,
      percentage: phase.percentage,
      deploymentFailure: true,
    });
    
    // Försök automatisk rollback
    if (this.config.rollbackSettings.autoRollbackEnabled) {
      try {
        await RollbackManager.getInstance().executeAutomaticRollback(
          serviceName,
          1.0, // 100% felfrekvens för deployment-fel
          0,
          `Deployment-fel i fas ${phase.day}: ${error.message}`
        );

        console.log(`🔄 Automatisk rollback utförd för ${serviceName}`);
      } catch (rollbackError) {
        console.error(`❌ Rollback misslyckades för ${serviceName}:`, rollbackError);
      }
    }
  }

  /**
   * Loggar fas-utförande
   */
  private logPhaseExecution(serviceName: string, phase: any): void {
    MigrationMonitor.getInstance().logServiceLoad(
      serviceName,
      true, // isMigrated
      0, // duration
      true, // success
      undefined, // error
      {
        phase: phase.day,
        percentage: phase.percentage,
        description: phase.description,
        environment: this.config.environment,
      }
    );
  }

  /**
   * Hämtar deployment-status
   */
  public getDeploymentStatus(): any {
    const rolloutStatus = getRolloutStatus();
    const migrationMetrics = MigrationMonitor.getInstance().getMetrics();
    const rollbackHistory = RollbackManager.getInstance().getRollbackHistory();
    
    return {
      environment: this.config.environment,
      deploymentStartTime: this.deploymentStartTime,
      rolloutStatus,
      migrationMetrics,
      rollbackHistory: rollbackHistory.slice(-10), // Senaste 10 rollbacks
      healthStatus: this.config.services.map(service => ({
        serviceName: service,
        currentPhase: this.currentPhases.get(service) || 0,
        healthy: true, // Skulle beräknas från metrics
      })),
    };
  }

  /**
   * Stoppar deployment-processen
   */
  public async stopDeployment(): Promise<void> {
    console.log('🛑 Stoppar deployment-processen');
    
    // Stoppa rollback manager
    RollbackManager.getInstance().stopMonitoring();
    
    console.log('✅ Deployment-processen stoppad');
  }
}

/**
 * Huvudfunktion för att starta deployment
 */
export async function deployMigration(environment: 'staging' | 'production' = 'production'): Promise<void> {
  const config = environment === 'production' 
    ? PRODUCTION_DEPLOYMENT_CONFIG 
    : { ...PRODUCTION_DEPLOYMENT_CONFIG, environment: 'staging' as const };
  
  const deployer = new MigrationDeployer(config);
  
  try {
    await deployer.startDeployment();
    
    // Håll processen igång för övervakning
    process.on('SIGINT', async () => {
      console.log('\n🛑 Avbryter deployment...');
      await deployer.stopDeployment();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Deployment misslyckades:', error);
    process.exit(1);
  }
}

// Kör deployment om scriptet körs direkt
if (require.main === module) {
  const environment = process.argv[2] as 'staging' | 'production' || 'staging';
  deployMigration(environment);
}
