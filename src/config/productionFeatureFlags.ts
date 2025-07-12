/**
 * Production Feature Flags Configuration - Service Layer BaseService Migration
 * 
 * Denna fil hanterar gradvis rollout av migrerade tjänster i produktionsmiljö.
 * Stöder procentbaserad rollout, A/B-testning och säker fallback till legacy-tjänster.
 * 
 * Följer GDPR-efterlevnad och svensk lokalisering för alla tjänster.
 */

import { Platform } from 'react-native';
import { FeatureFlags } from './featureFlags';

/**
 * Interface för gradvis rollout-konfiguration
 */
export interface GradualRolloutConfig {
  serviceName: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  startDate: string; // ISO date string
  endDate?: string; // ISO date string för automatisk avslutning
  targetGroups?: string[]; // Specifika användargrupper
  monitoringEnabled: boolean;
  rollbackThreshold: number; // Felfrekvens som triggar automatisk rollback (0-1)
}

/**
 * Interface för rollout-miljökonfiguration
 */
export interface RolloutEnvironmentConfig {
  environment: 'staging' | 'production';
  services: Record<string, GradualRolloutConfig>;
  globalSettings: {
    enableGradualRollout: boolean;
    defaultRolloutPercentage: number;
    monitoringInterval: number; // millisekunder
    rollbackCooldown: number; // millisekunder
  };
}

/**
 * Staging-miljö konfiguration - Aggressivare rollout för testning
 */
export const STAGING_ROLLOUT_CONFIG: RolloutEnvironmentConfig = {
  environment: 'staging',
  globalSettings: {
    enableGradualRollout: true,
    defaultRolloutPercentage: 50,
    monitoringInterval: 30000, // 30 sekunder
    rollbackCooldown: 300000, // 5 minuter
  },
  services: {
    BACKUP_SERVICE: {
      serviceName: 'BackupService',
      enabled: true,
      rolloutPercentage: 75, // Högre procent i staging
      startDate: '2025-01-09T10:00:00Z',
      monitoringEnabled: true,
      rollbackThreshold: 0.05, // 5% felfrekvens
    },
    NETWORK_SERVICE: {
      serviceName: 'NetworkConnectivityService',
      enabled: true,
      rolloutPercentage: 65, // Ökat till 65% för staging-testning
      startDate: '2025-01-09T12:00:00Z',
      monitoringEnabled: true,
      rollbackThreshold: 0.03, // 3% felfrekvens
    },
    WEBRTC_PEER_SERVICE: {
      serviceName: 'WebRTCPeerService',
      enabled: true,
      rolloutPercentage: 60, // Ökat till 60% för staging-testning
      startDate: '2025-01-09T14:00:00Z',
      monitoringEnabled: true,
      rollbackThreshold: 0.02, // 2% felfrekvens
    },
  },
};

/**
 * Produktions-miljö konfiguration - Konservativ och säker rollout
 */
export const PRODUCTION_ROLLOUT_CONFIG: RolloutEnvironmentConfig = {
  environment: 'production',
  globalSettings: {
    enableGradualRollout: true,
    defaultRolloutPercentage: 10,
    monitoringInterval: 60000, // 1 minut
    rollbackCooldown: 1800000, // 30 minuter
  },
  services: {
    BACKUP_SERVICE: {
      serviceName: 'BackupService',
      enabled: true,
      rolloutPercentage: 10, // Börja med 10%
      startDate: '2025-01-10T08:00:00Z',
      endDate: '2025-01-17T08:00:00Z', // 1 vecka för gradvis ökning
      monitoringEnabled: true,
      rollbackThreshold: 0.01, // 1% felfrekvens
    },
    NETWORK_SERVICE: {
      serviceName: 'NetworkConnectivityService',
      enabled: true, // Aktivera för gradvis rollout
      rolloutPercentage: 10, // Börja med 10%
      startDate: '2025-01-12T08:00:00Z',
      endDate: '2025-01-19T08:00:00Z', // 1 vecka för gradvis ökning
      monitoringEnabled: true,
      rollbackThreshold: 0.01,
    },
    WEBRTC_PEER_SERVICE: {
      serviceName: 'WebRTCPeerService',
      enabled: true, // Aktivera för gradvis rollout
      rolloutPercentage: 10, // Börja med 10%
      startDate: '2025-01-15T08:00:00Z',
      endDate: '2025-01-22T08:00:00Z', // 1 vecka för gradvis ökning
      monitoringEnabled: true,
      rollbackThreshold: 0.005, // 0.5% felfrekvens - extra försiktigt
    },
  },
};

/**
 * Rollout-schema för automatisk progression
 */
export const ROLLOUT_SCHEDULE = {
  BACKUP_SERVICE: [
    { day: 1, percentage: 10, description: 'Initial rollout - 10% användare' },
    { day: 2, percentage: 25, description: 'Utökning till 25% om inga problem' },
    { day: 4, percentage: 50, description: 'Halvvägs rollout - 50% användare' },
    { day: 7, percentage: 100, description: 'Fullständig rollout - alla användare' },
  ],
  NETWORK_SERVICE: [
    { day: 1, percentage: 10, description: 'Initial rollout efter BackupService-validering' },
    { day: 3, percentage: 50, description: 'Snabbare rollout baserat på BackupService-resultat' },
    { day: 5, percentage: 100, description: 'Fullständig rollout' },
  ],
  WEBRTC_PEER_SERVICE: [
    { day: 1, percentage: 5, description: 'Extra försiktig initial rollout - 5%' },
    { day: 3, percentage: 15, description: 'Gradvis ökning till 15%' },
    { day: 5, percentage: 35, description: 'Måttlig rollout - 35%' },
    { day: 7, percentage: 100, description: 'Fullständig rollout efter validering' },
  ],
};

/**
 * Hämtar aktuell rollout-konfiguration baserat på miljö
 */
export function getCurrentRolloutConfig(): RolloutEnvironmentConfig {
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'staging';
  return environment === 'production' ? PRODUCTION_ROLLOUT_CONFIG : STAGING_ROLLOUT_CONFIG;
}

/**
 * Kontrollerar om en tjänst ska använda migrerad version baserat på rollout-procent
 */
export function shouldUseMigratedService(
  serviceName: string,
  userId?: string,
  sessionId?: string
): boolean {
  const config = getCurrentRolloutConfig();
  const serviceKey = serviceName.toUpperCase().replace(/SERVICE$/, '_SERVICE');
  const serviceConfig = config.services[serviceKey];

  if (!serviceConfig || !serviceConfig.enabled) {
    return false;
  }

  // Kontrollera datum
  const now = new Date();
  const startDate = new Date(serviceConfig.startDate);
  if (now < startDate) {
    return false;
  }

  if (serviceConfig.endDate) {
    const endDate = new Date(serviceConfig.endDate);
    if (now > endDate) {
      return true; // Fullständig rollout efter slutdatum
    }
  }

  // Beräkna hash baserat på användar-ID eller session-ID för konsistent rollout
  const identifier = userId || sessionId || 'anonymous';
  const hash = simpleHash(identifier + serviceName);
  const userPercentile = hash % 100;

  return userPercentile < serviceConfig.rolloutPercentage;
}

/**
 * Enkel hash-funktion för konsistent användarfördelning
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Konvertera till 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Uppdaterar rollout-procent för en specifik tjänst
 */
export function updateRolloutPercentage(
  serviceName: string,
  newPercentage: number,
  environment: 'staging' | 'production' = 'production'
): void {
  const config = environment === 'production' ? PRODUCTION_ROLLOUT_CONFIG : STAGING_ROLLOUT_CONFIG;
  const serviceKey = serviceName.toUpperCase().replace(/SERVICE$/, '_SERVICE');
  
  if (config.services[serviceKey]) {
    config.services[serviceKey].rolloutPercentage = Math.max(0, Math.min(100, newPercentage));
    
    console.log(`📊 Rollout uppdaterad: ${serviceName} -> ${newPercentage}% i ${environment}`);
  }
}

/**
 * Hämtar rollout-status för alla tjänster
 */
export function getRolloutStatus(): Record<string, any> {
  const config = getCurrentRolloutConfig();
  const status: Record<string, any> = {};

  Object.entries(config.services).forEach(([key, serviceConfig]) => {
    status[serviceConfig.serviceName] = {
      enabled: serviceConfig.enabled,
      rolloutPercentage: serviceConfig.rolloutPercentage,
      startDate: serviceConfig.startDate,
      endDate: serviceConfig.endDate,
      monitoringEnabled: serviceConfig.monitoringEnabled,
      rollbackThreshold: serviceConfig.rollbackThreshold,
    };
  });

  return {
    environment: config.environment,
    globalSettings: config.globalSettings,
    services: status,
  };
}

/**
 * Exporterar konfiguration för användning i ServiceFactory
 */
export { getCurrentRolloutConfig as getProductionRolloutConfig };
