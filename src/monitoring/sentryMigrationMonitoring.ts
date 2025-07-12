/**
 * Sentry Migration Monitoring - Service Layer BaseService Migration
 * 
 * Integrerar Sentry-övervakning för migrerade tjänster med:
 * - GDPR-säker dataskrubbning för svenska användare
 * - Prestanda-spårning för migration metrics
 * - Automatisk felrapportering med svenska meddelanden
 * - Integration med rollback-systemet
 * 
 * Följer GDPR-efterlevnad och svensk lokalisering.
 */

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { getCurrentRolloutConfig } from '../config/productionFeatureFlags';
import { rollbackManager } from '../utils/rollbackManager';
import { MigrationMonitor } from '../utils/migrationMonitoring';

/**
 * Interface för Sentry migration context
 */
export interface SentryMigrationContext {
  serviceName: string;
  isMigrated: boolean;
  rolloutPercentage: number;
  environment: string;
  platform: string;
  sessionId?: string;
  userId?: string; // Anonymiserad för GDPR
}

/**
 * Interface för prestanda-spårning
 */
export interface PerformanceMetrics {
  serviceName: string;
  operationName: string;
  duration: number;
  success: boolean;
  errorType?: string;
  metadata?: Record<string, any>;
}

/**
 * SentryMigrationMonitor - Huvudklass för Sentry-integration
 */
export class SentryMigrationMonitor {
  private static instance: SentryMigrationMonitor;
  private isInitialized = false;

  private constructor() {}

  /**
   * Singleton pattern för global Sentry monitor
   */
  static getInstance(): SentryMigrationMonitor {
    if (!SentryMigrationMonitor.instance) {
      SentryMigrationMonitor.instance = new SentryMigrationMonitor();
    }
    return SentryMigrationMonitor.instance;
  }

  /**
   * Initialiserar Sentry-övervakning för migration
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      // Konfigurera Sentry för migration monitoring
      Sentry.configureScope((scope) => {
        scope.setTag('migration.enabled', 'true');
        scope.setTag('migration.environment', getCurrentRolloutConfig().environment);
        scope.setContext('migration', {
          version: '1.0.0',
          rolloutConfig: this.getSafeRolloutConfig(),
        });
      });

      // Lägg till global error handler för migration
      this.setupGlobalErrorHandler();

      this.isInitialized = true;
      console.log('📊 Sentry Migration Monitoring initialiserad');
    } catch (error) {
      console.error('❌ Fel vid initialisering av Sentry Migration Monitoring:', error);
    }
  }

  /**
   * Spårar service load med Sentry performance monitoring
   */
  public trackServiceLoad(
    serviceName: string,
    isMigrated: boolean,
    userId?: string,
    sessionId?: string
  ): Sentry.Transaction {
    const transactionName = `service.load.${serviceName.toLowerCase()}`;
    const transaction = Sentry.startTransaction({
      name: transactionName,
      op: 'service.load',
      tags: {
        'service.name': serviceName,
        'service.migrated': isMigrated.toString(),
        'service.type': isMigrated ? 'migrated' : 'legacy',
        'platform': Platform.OS,
      },
    });

    // Lägg till GDPR-säker context
    transaction.setContext('migration', this.createMigrationContext(
      serviceName,
      isMigrated,
      userId,
      sessionId
    ));

    return transaction;
  }

  /**
   * Rapporterar service load-resultat
   */
  public reportServiceLoadResult(
    transaction: Sentry.Transaction,
    success: boolean,
    loadTime: number,
    error?: Error,
    fallbackUsed: boolean = false
  ): void {
    try {
      // Sätt resultat-tags
      transaction.setTag('service.success', success.toString());
      transaction.setTag('service.fallback_used', fallbackUsed.toString());
      transaction.setData('loadTime', loadTime);

      // Rapportera fel om det finns
      if (error) {
        transaction.setTag('service.error_type', error.constructor.name);
        Sentry.captureException(error, {
          tags: {
            'migration.service_load_error': 'true',
            'migration.fallback_used': fallbackUsed.toString(),
          },
          extra: {
            loadTime,
            serviceName: transaction.tags?.['service.name'],
            isMigrated: transaction.tags?.['service.migrated'] === 'true',
          },
        });
      }

      // Sätt status baserat på resultat
      transaction.setStatus(success ? 'ok' : 'internal_error');
      transaction.finish();

      // Kontrollera om rollback behövs baserat på fel
      if (error && !fallbackUsed) {
        this.checkForRollbackTrigger(
          transaction.tags?.['service.name'] || 'unknown',
          error
        );
      }
    } catch (sentryError) {
      console.error('❌ Fel vid rapportering till Sentry:', sentryError);
    }
  }

  /**
   * Spårar prestanda för specifika operationer
   */
  public trackPerformance(metrics: PerformanceMetrics): void {
    try {
      const span = Sentry.getCurrentHub().getScope()?.getSpan();
      const childSpan = span?.startChild({
        op: `service.operation.${metrics.operationName}`,
        description: `${metrics.serviceName}.${metrics.operationName}`,
      });

      if (childSpan) {
        childSpan.setTag('service.name', metrics.serviceName);
        childSpan.setTag('operation.success', metrics.success.toString());
        childSpan.setData('duration', metrics.duration);

        if (metrics.errorType) {
          childSpan.setTag('error.type', metrics.errorType);
        }

        if (metrics.metadata) {
          childSpan.setData('metadata', this.sanitizeMetadata(metrics.metadata));
        }

        childSpan.setStatus(metrics.success ? 'ok' : 'internal_error');
        childSpan.finish();
      }

      // Rapportera långsamma operationer
      if (metrics.duration > 3000) { // > 3 sekunder
        Sentry.addBreadcrumb({
          message: `Långsam operation: ${metrics.serviceName}.${metrics.operationName}`,
          level: 'warning',
          data: {
            duration: metrics.duration,
            serviceName: metrics.serviceName,
            operationName: metrics.operationName,
          },
        });
      }
    } catch (error) {
      console.error('❌ Fel vid prestanda-spårning:', error);
    }
  }

  /**
   * Rapporterar migration-specifika fel med svenska meddelanden
   */
  public reportMigrationError(
    serviceName: string,
    error: Error,
    context: Record<string, any> = {}
  ): void {
    try {
      const swedishErrorMessage = this.getSwedishErrorMessage(error, serviceName);
      
      Sentry.captureException(error, {
        tags: {
          'migration.service_error': 'true',
          'migration.service_name': serviceName,
          'migration.error_category': this.categorizeError(error),
        },
        extra: {
          swedishMessage: swedishErrorMessage,
          originalMessage: error.message,
          serviceName,
          context: this.sanitizeMetadata(context),
          platform: Platform.OS,
          environment: getCurrentRolloutConfig().environment,
        },
        level: 'error',
      });

      // Lägg till breadcrumb för felsökning
      Sentry.addBreadcrumb({
        message: `Migration fel i ${serviceName}: ${swedishErrorMessage}`,
        level: 'error',
        category: 'migration',
        data: {
          serviceName,
          errorType: error.constructor.name,
        },
      });
    } catch (sentryError) {
      console.error('❌ Fel vid rapportering av migration-fel:', sentryError);
    }
  }

  /**
   * Skapar GDPR-säker migration context
   */
  private createMigrationContext(
    serviceName: string,
    isMigrated: boolean,
    userId?: string,
    sessionId?: string
  ): SentryMigrationContext {
    const config = getCurrentRolloutConfig();
    const serviceKey = serviceName.toUpperCase().replace(/SERVICE$/, '_SERVICE');
    const serviceConfig = config.services[serviceKey];

    return {
      serviceName,
      isMigrated,
      rolloutPercentage: serviceConfig?.rolloutPercentage || 0,
      environment: config.environment,
      platform: Platform.OS,
      // Anonymisera känslig data för GDPR
      sessionId: sessionId ? this.anonymizeId(sessionId) : undefined,
      userId: userId ? this.anonymizeId(userId) : undefined,
    };
  }

  /**
   * Anonymiserar ID:n för GDPR-efterlevnad
   */
  private anonymizeId(id: string): string {
    // Använd hash för att anonymisera men behålla konsistens
    const hash = this.simpleHash(id);
    return `anon_${hash.toString(36).substr(0, 8)}`;
  }

  /**
   * Enkel hash-funktion för anonymisering
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Saniterar metadata för GDPR-efterlevnad
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    Object.entries(metadata).forEach(([key, value]) => {
      // Filtrera bort känslig data
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && this.containsSensitiveData(value)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  /**
   * Kontrollerar om en nyckel innehåller känslig data
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth',
      'personnummer', 'ssn', 'email', 'phone',
      'userId', 'sessionId', 'bankid'
    ];
    
    return sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive.toLowerCase())
    );
  }

  /**
   * Kontrollerar om ett värde innehåller känslig data
   */
  private containsSensitiveData(value: string): boolean {
    // Kontrollera för svenskt personnummer-format
    const personnummerPattern = /\d{6,8}[-\s]?\d{4}/;
    return personnummerPattern.test(value);
  }

  /**
   * Hämtar svenska felmeddelanden
   */
  private getSwedishErrorMessage(error: Error, serviceName: string): string {
    const errorType = error.constructor.name;
    
    const swedishMessages: Record<string, string> = {
      'NetworkError': `Nätverksfel i ${serviceName} - kontrollera internetanslutningen`,
      'TimeoutError': `Timeout i ${serviceName} - tjänsten svarar inte`,
      'ValidationError': `Valideringsfel i ${serviceName} - ogiltiga data`,
      'AuthenticationError': `Autentiseringsfel i ${serviceName} - kontrollera behörigheter`,
      'NotFoundError': `Resurs hittades inte i ${serviceName}`,
      'ConflictError': `Konflikt i ${serviceName} - data redan finns`,
      'InternalError': `Internt fel i ${serviceName} - kontakta support`,
    };

    return swedishMessages[errorType] || `Okänt fel i ${serviceName}: ${error.message}`;
  }

  /**
   * Kategoriserar fel för bättre analys
   */
  private categorizeError(error: Error): string {
    const errorType = error.constructor.name;
    
    if (errorType.includes('Network') || errorType.includes('Timeout')) {
      return 'network';
    } else if (errorType.includes('Auth') || errorType.includes('Permission')) {
      return 'authentication';
    } else if (errorType.includes('Validation') || errorType.includes('Format')) {
      return 'validation';
    } else {
      return 'internal';
    }
  }

  /**
   * Kontrollerar om rollback ska triggas baserat på fel
   */
  private checkForRollbackTrigger(serviceName: string, error: Error): void {
    // Kritiska fel som kan trigga rollback
    const criticalErrors = ['NetworkError', 'TimeoutError', 'InternalError'];
    
    if (criticalErrors.includes(error.constructor.name)) {
      console.warn(`⚠️ Kritiskt fel i ${serviceName}, överväger rollback: ${error.message}`);
      
      // Logga till MigrationMonitor för rollback-analys
      MigrationMonitor.getInstance().logMigrationEvent({
        serviceName,
        eventType: 'error',
        isMigrated: true,
        success: false,
        loadTime: 0,
        error,
        fallbackUsed: false,
        metadata: {
          criticalError: true,
          errorCategory: this.categorizeError(error),
        },
      });
    }
  }

  /**
   * Hämtar säker rollout-konfiguration för Sentry context
   */
  private getSafeRolloutConfig(): Record<string, any> {
    const config = getCurrentRolloutConfig();
    
    return {
      environment: config.environment,
      servicesCount: Object.keys(config.services).length,
      globalSettings: {
        enableGradualRollout: config.globalSettings.enableGradualRollout,
        defaultRolloutPercentage: config.globalSettings.defaultRolloutPercentage,
      },
    };
  }

  /**
   * Sätter upp global error handler för migration
   */
  private setupGlobalErrorHandler(): void {
    // Lägg till global error handler som fångar migration-relaterade fel
    const originalHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      // Kontrollera om felet är migration-relaterat
      if (this.isMigrationRelatedError(error)) {
        this.reportMigrationError('GlobalHandler', error, {
          isFatal,
          source: 'global_error_handler',
        });
      }
      
      // Anropa original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  /**
   * Kontrollerar om ett fel är migration-relaterat
   */
  private isMigrationRelatedError(error: Error): boolean {
    const migrationKeywords = [
      'BaseService', 'ServiceFactory', 'Migration',
      'BackupService', 'NetworkService', 'WebRTCPeer'
    ];
    
    return migrationKeywords.some(keyword => 
      error.message.includes(keyword) || error.stack?.includes(keyword)
    );
  }
}

/**
 * Exporterar singleton-instans för global användning
 */
export const sentryMigrationMonitor = SentryMigrationMonitor.getInstance();
