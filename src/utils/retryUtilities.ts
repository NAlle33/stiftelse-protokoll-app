/**
 * Centralized Retry Utilities - SÖKA Stiftelseappen
 * 
 * Konsoliderar retry-logik från supabaseClient och andra tjänster
 * för att eliminera kodduplicering och säkerställa konsistent
 * återförsökshantering med svenska meddelanden och GDPR-efterlevnad.
 * 
 * Del av Code Duplication Elimination-initiativet
 */

import { ErrorCode, ServiceError, handleError, isRetryable } from './errorHandling';

/**
 * Konfiguration för återförsök
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: Error) => boolean;
}

/**
 * Standardkonfiguration för återförsök
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 sekund
  maxDelay: 30000, // 30 sekunder
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Snabb konfiguration för olika scenarion
 */
export const RETRY_CONFIGS = {
  // För kritiska operationer som måste lyckas
  CRITICAL: {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 5,
    maxDelay: 60000, // 1 minut
  },
  
  // För nätverksoperationer
  NETWORK: {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 4,
    baseDelay: 2000, // 2 sekunder
    maxDelay: 45000, // 45 sekunder
  },
  
  // För databasoperationer
  DATABASE: {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 3,
    baseDelay: 500, // 0.5 sekunder
    maxDelay: 15000, // 15 sekunder
  },
  
  // För filuppladdningar
  FILE_UPLOAD: {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 2,
    baseDelay: 3000, // 3 sekunder
    maxDelay: 30000, // 30 sekunder
  },
  
  // För BankID-operationer
  BANKID: {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 2,
    baseDelay: 2000, // 2 sekunder
    maxDelay: 10000, // 10 sekunder
    retryCondition: (error: Error) => {
      // Försök inte igen om användaren avbröt
      return !error.message.toLowerCase().includes('cancelled') &&
             !error.message.toLowerCase().includes('avbruten');
    },
  },
} as const;

/**
 * Resultat från återförsöksoperation
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  attempts: number;
  totalTime: number;
}

/**
 * Huvudklass för återförsökshantering
 */
export class RetryHandler {
  private static instance: RetryHandler;

  private constructor() {}

  /**
   * Singleton-instans för global återförsökshantering
   */
  public static getInstance(): RetryHandler {
    if (!RetryHandler.instance) {
      RetryHandler.instance = new RetryHandler();
    }
    return RetryHandler.instance;
  }

  /**
   * Huvudmetod för återförsök - ersätter withRetry från supabaseClient
   */
  public async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: Partial<RetryConfig> = {},
    serviceName?: string
  ): Promise<T> {
    const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= mergedConfig.maxRetries + 1; attempt++) {
      try {
        console.log(`🔄 ${operationName} - Försök ${attempt}/${mergedConfig.maxRetries + 1}`);
        
        const result = await operation();
        
        if (attempt > 1) {
          const totalTime = Date.now() - startTime;
          console.log(`✅ ${operationName} lyckades efter ${attempt} försök (${totalTime}ms)`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Kontrollera om vi ska försöka igen
        if (attempt > mergedConfig.maxRetries) {
          break; // Inga fler försök
        }

        // Kontrollera retry-villkor
        if (mergedConfig.retryCondition && !mergedConfig.retryCondition(lastError)) {
          console.log(`🚫 ${operationName} - Återförsök avbrutet på grund av villkor`);
          break;
        }

        // Kontrollera om felet är återförsöksbart
        const serviceError = handleError(lastError, operationName, serviceName);
        if (!isRetryable(serviceError)) {
          console.log(`🚫 ${operationName} - Fel är inte återförsöksbart: ${serviceError.code}`);
          break;
        }

        // Beräkna fördröjning för nästa försök
        const delay = this.calculateDelay(attempt - 1, mergedConfig);
        
        console.log(`⏳ ${operationName} - Försök ${attempt} misslyckades, försöker igen om ${delay}ms`);
        console.error(`   Fel: ${lastError.message}`);
        
        await this.sleep(delay);
      }
    }

    // Alla försök misslyckades
    const totalTime = Date.now() - startTime;
    const finalError = handleError(
      lastError || new Error('Okänt fel'),
      operationName,
      serviceName,
      {
        attempts: mergedConfig.maxRetries + 1,
        totalTime,
        config: mergedConfig,
      }
    );

    console.error(`❌ ${operationName} misslyckades efter ${mergedConfig.maxRetries + 1} försök (${totalTime}ms)`);
    throw new Error(finalError.message);
  }

  /**
   * Återförsök med resultatobjekt istället för exception
   */
  public async withRetryResult<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: Partial<RetryConfig> = {},
    serviceName?: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    
    try {
      const data = await this.withRetry(operation, operationName, config, serviceName);
      return {
        success: true,
        data,
        attempts: 1, // Om det lyckas första gången
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      const serviceError = handleError(error, operationName, serviceName);
      return {
        success: false,
        error: serviceError,
        attempts: (config.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries) + 1,
        totalTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Beräknar fördröjning med exponentiell backoff och jitter
   */
  private calculateDelay(attemptNumber: number, config: RetryConfig): number {
    // Exponentiell backoff
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber);
    
    // Begränsa till maxDelay
    delay = Math.min(delay, config.maxDelay);
    
    // Lägg till jitter för att undvika thundering herd
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.round(delay);
  }

  /**
   * Hjälpmetod för att vänta
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Skapar en retry-wrapper för en funktion
   */
  public createRetryWrapper<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    operationName: string,
    config: Partial<RetryConfig> = {},
    serviceName?: string
  ): (...args: T) => Promise<R> {
    return (...args: T) => {
      return this.withRetry(
        () => fn(...args),
        operationName,
        config,
        serviceName
      );
    };
  }
}

/**
 * Globala hjälpfunktioner för enkel användning
 */

/**
 * Snabb återförsöksfunktion - ersätter withRetry från supabaseClient
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config?: Partial<RetryConfig>,
  serviceName?: string
): Promise<T> {
  return RetryHandler.getInstance().withRetry(operation, operationName, config, serviceName);
}

/**
 * Återförsök med resultatobjekt
 */
export async function withRetryResult<T>(
  operation: () => Promise<T>,
  operationName: string,
  config?: Partial<RetryConfig>,
  serviceName?: string
): Promise<RetryResult<T>> {
  return RetryHandler.getInstance().withRetryResult(operation, operationName, config, serviceName);
}

/**
 * Skapar en retry-wrapper för en funktion
 */
export function createRetryWrapper<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string,
  config?: Partial<RetryConfig>,
  serviceName?: string
): (...args: T) => Promise<R> {
  return RetryHandler.getInstance().createRetryWrapper(fn, operationName, config, serviceName);
}

/**
 * Förkonfigurerade retry-funktioner för vanliga scenarion
 */
export const retryOperations = {
  /**
   * För kritiska operationer som måste lyckas
   */
  critical: <T>(operation: () => Promise<T>, operationName: string, serviceName?: string) =>
    withRetry(operation, operationName, RETRY_CONFIGS.CRITICAL, serviceName),

  /**
   * För nätverksoperationer
   */
  network: <T>(operation: () => Promise<T>, operationName: string, serviceName?: string) =>
    withRetry(operation, operationName, RETRY_CONFIGS.NETWORK, serviceName),

  /**
   * För databasoperationer
   */
  database: <T>(operation: () => Promise<T>, operationName: string, serviceName?: string) =>
    withRetry(operation, operationName, RETRY_CONFIGS.DATABASE, serviceName),

  /**
   * För filuppladdningar
   */
  fileUpload: <T>(operation: () => Promise<T>, operationName: string, serviceName?: string) =>
    withRetry(operation, operationName, RETRY_CONFIGS.FILE_UPLOAD, serviceName),

  /**
   * För BankID-operationer
   */
  bankid: <T>(operation: () => Promise<T>, operationName: string, serviceName?: string) =>
    withRetry(operation, operationName, RETRY_CONFIGS.BANKID, serviceName),
};

// Exportera singleton-instans för global användning
export const retryHandler = RetryHandler.getInstance();
