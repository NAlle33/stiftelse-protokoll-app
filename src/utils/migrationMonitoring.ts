/**
 * Migration Monitoring Utilities - Service Layer BaseService Migration
 * 
 * Denna modul tillhandahåller omfattande monitoring och logging för service-migration
 * från legacy-tjänster till BaseService-implementationer. Inkluderar prestanda-mätning,
 * felspårning och GDPR-kompatibel rapportering.
 * 
 * Följer svensk lokalisering och GDPR-efterlevnad för all datainsamling.
 */

import { Platform } from 'react-native';
import { FEATURE_FLAGS } from '../config/featureFlags';

/**
 * Interface för migration events
 */
export interface MigrationEvent {
  eventId: string;
  serviceName: string;
  eventType: 'load' | 'error' | 'fallback' | 'success';
  isMigrated: boolean;
  timestamp: string;
  duration: number;
  platform: string;
  environment: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Interface för migration metrics
 */
export interface MigrationMetrics {
  totalEvents: number;
  successfulMigrations: number;
  fallbackEvents: number;
  errorEvents: number;
  averageLoadTime: number;
  migrationSuccessRate: number;
  fallbackRate: number;
  errorRate: number;
  serviceBreakdown: Record<string, {
    total: number;
    successful: number;
    fallbacks: number;
    errors: number;
    averageLoadTime: number;
  }>;
}

/**
 * Migration Event Store - GDPR-kompatibel lagring
 */
class MigrationEventStore {
  private events: MigrationEvent[] = [];
  private maxEvents = 1000; // Begränsa för GDPR-efterlevnad
  private retentionPeriod = 24 * 60 * 60 * 1000; // 24 timmar

  /**
   * Lägger till event med automatisk rensning
   */
  addEvent(event: MigrationEvent): void {
    // Lägg till event
    this.events.push(event);

    // Rensa gamla events för GDPR-efterlevnad
    this.cleanupOldEvents();

    // Begränsa antal events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Hämtar alla events
   */
  getEvents(): MigrationEvent[] {
    return [...this.events];
  }

  /**
   * Hämtar events för specifik service
   */
  getEventsForService(serviceName: string): MigrationEvent[] {
    return this.events.filter(event => event.serviceName === serviceName);
  }

  /**
   * Rensar alla events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Rensar gamla events baserat på retention policy
   */
  private cleanupOldEvents(): void {
    const cutoffTime = Date.now() - this.retentionPeriod;
    this.events = this.events.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime > cutoffTime;
    });
  }

  /**
   * Hämtar events inom tidsperiod
   */
  getEventsInTimeRange(startTime: Date, endTime: Date): MigrationEvent[] {
    return this.events.filter(event => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= startTime && eventTime <= endTime;
    });
  }
}

/**
 * Migration Monitor - Huvudklass för monitoring
 */
export class MigrationMonitor {
  private static instance: MigrationMonitor;
  private eventStore: MigrationEventStore;
  private isEnabled: boolean;

  private constructor() {
    this.eventStore = new MigrationEventStore();
    this.isEnabled = FEATURE_FLAGS.ENABLE_MIGRATION_LOGGING;
  }

  /**
   * Singleton pattern
   */
  static getInstance(): MigrationMonitor {
    if (!MigrationMonitor.instance) {
      MigrationMonitor.instance = new MigrationMonitor();
    }
    return MigrationMonitor.instance;
  }

  /**
   * Loggar service load event
   */
  logServiceLoad(
    serviceName: string,
    isMigrated: boolean,
    duration: number,
    success: boolean,
    error?: Error,
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const event: MigrationEvent = {
      eventId: this.generateEventId(),
      serviceName,
      eventType: success ? 'success' : 'error',
      isMigrated,
      timestamp: new Date().toISOString(),
      duration,
      platform: Platform.OS,
      environment: process.env.NODE_ENV || 'development',
      metadata: this.sanitizeMetadata(metadata),
      error: error ? {
        message: error.message,
        code: (error as any).code,
        stack: __DEV__ ? error.stack : undefined,
      } : undefined,
    };

    this.eventStore.addEvent(event);
    this.logToConsole(event);
  }

  /**
   * Loggar fallback event
   */
  logFallback(
    serviceName: string,
    originalError: Error,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const event: MigrationEvent = {
      eventId: this.generateEventId(),
      serviceName,
      eventType: 'fallback',
      isMigrated: false,
      timestamp: new Date().toISOString(),
      duration,
      platform: Platform.OS,
      environment: process.env.NODE_ENV || 'development',
      metadata: this.sanitizeMetadata(metadata),
      error: {
        message: originalError.message,
        code: (originalError as any).code,
        stack: __DEV__ ? originalError.stack : undefined,
      },
    };

    this.eventStore.addEvent(event);
    this.logToConsole(event);
  }

  /**
   * Hämtar migration metrics
   */
  getMetrics(): MigrationMetrics {
    const events = this.eventStore.getEvents();
    
    if (events.length === 0) {
      return this.createEmptyMetrics();
    }

    const totalEvents = events.length;
    const successfulMigrations = events.filter(e => e.eventType === 'success' && e.isMigrated).length;
    const fallbackEvents = events.filter(e => e.eventType === 'fallback').length;
    const errorEvents = events.filter(e => e.eventType === 'error').length;
    
    const totalDuration = events.reduce((sum, e) => sum + e.duration, 0);
    const averageLoadTime = Math.round(totalDuration / totalEvents);

    // Service breakdown
    const serviceBreakdown: Record<string, any> = {};
    const serviceNames = [...new Set(events.map(e => e.serviceName))];
    
    serviceNames.forEach(serviceName => {
      const serviceEvents = events.filter(e => e.serviceName === serviceName);
      const serviceTotal = serviceEvents.length;
      const serviceSuccessful = serviceEvents.filter(e => e.eventType === 'success').length;
      const serviceFallbacks = serviceEvents.filter(e => e.eventType === 'fallback').length;
      const serviceErrors = serviceEvents.filter(e => e.eventType === 'error').length;
      const serviceDuration = serviceEvents.reduce((sum, e) => sum + e.duration, 0);

      serviceBreakdown[serviceName] = {
        total: serviceTotal,
        successful: serviceSuccessful,
        fallbacks: serviceFallbacks,
        errors: serviceErrors,
        averageLoadTime: serviceTotal > 0 ? Math.round(serviceDuration / serviceTotal) : 0,
      };
    });

    return {
      totalEvents,
      successfulMigrations,
      fallbackEvents,
      errorEvents,
      averageLoadTime,
      migrationSuccessRate: Math.round((successfulMigrations / totalEvents) * 100),
      fallbackRate: Math.round((fallbackEvents / totalEvents) * 100),
      errorRate: Math.round((errorEvents / totalEvents) * 100),
      serviceBreakdown,
    };
  }

  /**
   * Genererar migration rapport
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const events = this.eventStore.getEvents();
    
    const recentEvents = events.slice(-10); // Senaste 10 events

    return `
# Service Migration Monitoring Report

## Sammanfattning
- **Totala events**: ${metrics.totalEvents}
- **Framgångsrika migreringar**: ${metrics.successfulMigrations} (${metrics.migrationSuccessRate}%)
- **Fallback-användning**: ${metrics.fallbackEvents} (${metrics.fallbackRate}%)
- **Fel**: ${metrics.errorEvents} (${metrics.errorRate}%)
- **Genomsnittlig laddningstid**: ${metrics.averageLoadTime}ms

## Service Breakdown
${Object.entries(metrics.serviceBreakdown).map(([service, data]) => `
### ${service}
- Totalt: ${data.total} events
- Framgångsrika: ${data.successful}
- Fallbacks: ${data.fallbacks}
- Fel: ${data.errors}
- Genomsnittlig laddningstid: ${data.averageLoadTime}ms
`).join('')}

## Senaste Events
${recentEvents.map(event => `
- **${event.serviceName}** (${event.eventType}) - ${event.duration}ms
  ${event.isMigrated ? '✅ Migrerad' : '🔄 Legacy'} | ${event.timestamp}
  ${event.error ? `❌ Fel: ${event.error.message}` : ''}
`).join('')}

## Rekommendationer
${this.generateRecommendations(metrics)}

---
*Rapport genererad: ${new Date().toISOString()}*
*Platform: ${Platform.OS} | Environment: ${process.env.NODE_ENV || 'development'}*
`;
  }

  /**
   * Rensar alla metrics
   */
  clearMetrics(): void {
    this.eventStore.clearEvents();
  }

  /**
   * Aktiverar/inaktiverar monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Privata hjälpmetoder
   */
  private generateEventId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    // Ta bort känslig data för GDPR-efterlevnad
    const sanitized = { ...metadata };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'personnummer', 'email'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private logToConsole(event: MigrationEvent): void {
    if (!FEATURE_FLAGS.ENABLE_SERVICE_DEBUG_MODE) return;

    const emoji = this.getEventEmoji(event);
    const serviceType = event.isMigrated ? 'Migrerad' : 'Legacy';
    
    console.log(`${emoji} Migration: ${event.serviceName} (${serviceType}) - ${event.duration}ms`);
    
    if (event.error) {
      console.error(`   Fel: ${event.error.message}`);
    }
    
    if (event.eventType === 'fallback') {
      console.warn(`   ⚠️ Fallback till legacy service`);
    }
  }

  private getEventEmoji(event: MigrationEvent): string {
    switch (event.eventType) {
      case 'success': return event.isMigrated ? '✅' : '🔄';
      case 'error': return '❌';
      case 'fallback': return '⚠️';
      default: return '📊';
    }
  }

  private createEmptyMetrics(): MigrationMetrics {
    return {
      totalEvents: 0,
      successfulMigrations: 0,
      fallbackEvents: 0,
      errorEvents: 0,
      averageLoadTime: 0,
      migrationSuccessRate: 0,
      fallbackRate: 0,
      errorRate: 0,
      serviceBreakdown: {},
    };
  }

  private generateRecommendations(metrics: MigrationMetrics): string {
    const recommendations: string[] = [];

    if (metrics.errorRate > 10) {
      recommendations.push('🔴 Hög felfrekvens - undersök migrerade tjänster');
    }

    if (metrics.fallbackRate > 20) {
      recommendations.push('🟡 Hög fallback-användning - kontrollera migration-stabilitet');
    }

    if (metrics.averageLoadTime > 1000) {
      recommendations.push('🟡 Långsam laddningstid - optimera service-prestanda');
    }

    if (metrics.migrationSuccessRate > 95) {
      recommendations.push('🟢 Utmärkt migration-stabilitet - överväg att öka migration-täckning');
    }

    if (recommendations.length === 0) {
      recommendations.push('🟢 Migration fungerar bra - fortsätt övervaka');
    }

    return recommendations.join('\n');
  }
}

// Exportera singleton instance
export const migrationMonitor = MigrationMonitor.getInstance();
