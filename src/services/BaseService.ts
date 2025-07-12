import { supabase, withRetry } from './supabaseClient';
import { Platform } from 'react-native';

/**
 * BaseService - Abstrakt basklass för alla tjänster i SÖKA Stiftelseappen
 * 
 * Tillhandahåller gemensamma mönster för:
 * - Felhantering med svenska meddelanden och GDPR-efterlevnad
 * - Supabase-frågor med retry-logik och caching
 * - Inmatningsvalidering med schema-stöd
 * - Loggning och audit trail för säkerhet
 * - Initialisering och cache-hantering
 * 
 * Följer etablerade mönster från protokolltjänstkonsolideringen
 */

export interface ValidationSchema {
  required?: string[];
  types?: Record<string, string>;
  patterns?: Record<string, RegExp>;
  custom?: Record<string, (value: any) => boolean>;
}

export interface ServiceError {
  code: string;
  message: string;
  context: string;
  timestamp: string;
  platform: string;
  gdprCompliant: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface ServiceOptions {
  enableCache?: boolean;
  cacheDuration?: number; // milliseconds
  enableRetry?: boolean;
  maxRetries?: number;
  enableLogging?: boolean;
}

export abstract class BaseService {
  protected isInitialized = false;
  protected cache: Map<string, CacheEntry<any>> = new Map();
  protected readonly options: ServiceOptions;
  
  // Default cache duration: 5 minutes
  protected readonly DEFAULT_CACHE_DURATION = 5 * 60 * 1000;
  
  // Service name for logging and error context
  protected abstract readonly serviceName: string;

  constructor(options: Partial<ServiceOptions> = {}) {
    this.options = {
      enableCache: true,
      cacheDuration: this.DEFAULT_CACHE_DURATION,
      enableRetry: true,
      maxRetries: 3,
      enableLogging: true,
      ...options,
    };
  }

  /**
   * Initialiserar tjänsten - måste implementeras av subklasser
   */
  protected abstract initialize(): Promise<void>;

  /**
   * Säkerställer att tjänsten är initialiserad
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * Standardiserad felhantering med svenska meddelanden och GDPR-efterlevnad
   */
  protected handleError(error: Error, context: string, metadata?: Record<string, any>): ServiceError {
    const serviceError: ServiceError = {
      code: this.getErrorCode(error),
      message: this.getSwedishErrorMessage(error, context),
      context: `${this.serviceName}.${context}`,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      gdprCompliant: true,
    };

    if (this.options.enableLogging) {
      // Logga fel utan känslig data (GDPR-kompatibelt)
      console.error(`❌ ${serviceError.context}:`, {
        code: serviceError.code,
        message: serviceError.message,
        platform: serviceError.platform,
        timestamp: serviceError.timestamp,
        // Filtrera bort känslig data från metadata
        metadata: this.sanitizeMetadata(metadata),
      });
    }

    // Rapportera till Sentry om tillgängligt (utan känslig data)
    if (typeof global !== 'undefined' && (global as any).Sentry) {
      (global as any).Sentry.captureException(error, {
        tags: {
          service: this.serviceName,
          context,
          platform: Platform.OS,
        },
        extra: this.sanitizeMetadata(metadata),
      });
    }

    return serviceError;
  }

  /**
   * Exekverar Supabase-frågor med retry-logik och felhantering
   */
  protected async executeQuery<T>(
    queryFn: () => Promise<T>,
    operationName: string,
    useCache: boolean = true
  ): Promise<T> {
    await this.ensureInitialized();

    // Kontrollera cache först
    if (useCache && this.options.enableCache) {
      const cacheKey = this.getCacheKey(operationName, {});
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      let result: T;
      
      if (this.options.enableRetry) {
        result = await withRetry(queryFn, `${this.serviceName}.${operationName}`);
      } else {
        result = await queryFn();
      }

      // Spara i cache om aktiverat
      if (useCache && this.options.enableCache) {
        const cacheKey = this.getCacheKey(operationName, {});
        this.setCache(cacheKey, result);
      }

      return result;
    } catch (error) {
      const serviceError = this.handleError(error as Error, operationName);
      throw new Error(serviceError.message);
    }
  }

  /**
   * Validerar inmatningsdata mot schema
   */
  protected validateInput(data: unknown, schema: ValidationSchema): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Data måste vara ett objekt');
      return { isValid: false, errors };
    }

    const dataObj = data as Record<string, any>;

    // Kontrollera obligatoriska fält
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in dataObj) || dataObj[field] === null || dataObj[field] === undefined) {
          errors.push(`Obligatoriskt fält saknas: ${field}`);
        }
      }
    }

    // Kontrollera datatyper
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (field in dataObj && dataObj[field] !== null) {
          const actualType = typeof dataObj[field];
          if (actualType !== expectedType) {
            errors.push(`Fel datatyp för ${field}: förväntade ${expectedType}, fick ${actualType}`);
          }
        }
      }
    }

    // Kontrollera mönster (regex)
    if (schema.patterns) {
      for (const [field, pattern] of Object.entries(schema.patterns)) {
        if (field in dataObj && dataObj[field] !== null) {
          const value = String(dataObj[field]);
          if (!pattern.test(value)) {
            errors.push(`Ogiltigt format för ${field}`);
          }
        }
      }
    }

    // Anpassad validering
    if (schema.custom) {
      for (const [field, validator] of Object.entries(schema.custom)) {
        if (field in dataObj && dataObj[field] !== null) {
          try {
            if (!validator(dataObj[field])) {
              errors.push(`Anpassad validering misslyckades för ${field}`);
            }
          } catch (error) {
            errors.push(`Valideringsfel för ${field}: ${(error as Error).message}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Cache-hantering
   */
  protected getCacheKey(operation: string, params: Record<string, any>): string {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${this.serviceName}.${operation}.${paramString}`;
  }

  protected getFromCache<T>(key: string): T | null {
    if (!this.options.enableCache) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  protected setCache<T>(key: string, data: T): void {
    if (!this.options.enableCache) return;

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (this.options.cacheDuration || this.DEFAULT_CACHE_DURATION),
    });
  }

  protected clearCache(): void {
    this.cache.clear();
  }

  protected clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Hjälpmetoder för felhantering
   */
  private getErrorCode(error: Error): string {
    if (error.message.includes('Invalid API key')) return 'SUPABASE_CONFIG_ERROR';
    if (error.message.includes('Network request failed')) return 'NETWORK_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('Database error')) return 'DATABASE_ERROR';
    if (error.message.includes('Validation')) return 'VALIDATION_ERROR';
    return 'UNKNOWN_ERROR';
  }

  private getSwedishErrorMessage(error: Error, context: string): string {
    const code = this.getErrorCode(error);
    
    switch (code) {
      case 'SUPABASE_CONFIG_ERROR':
        return `🔧 Konfigurationsfel i ${context}. Kontrollera Supabase-inställningar.`;
      case 'NETWORK_ERROR':
        return `🌐 Nätverksfel i ${context}. Kontrollera internetanslutning.`;
      case 'TIMEOUT_ERROR':
        return `⏱️ Timeout i ${context}. Försök igen om en stund.`;
      case 'DATABASE_ERROR':
        return `🗄️ Databasfel i ${context}. Kontakta support om problemet kvarstår.`;
      case 'VALIDATION_ERROR':
        return `✅ Valideringsfel i ${context}. Kontrollera inmatade data.`;
      default:
        return `❌ Ett oväntat fel inträffade i ${context}. Kontakta support om problemet kvarstår.`;
    }
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> {
    if (!metadata) return {};

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'personnummer', 'bankid', 'email'];

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED_FOR_GDPR]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
