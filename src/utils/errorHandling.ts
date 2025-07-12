/**
 * Centralized Error Handling Utilities - SÖKA Stiftelseappen
 * 
 * Konsoliderar felhanteringsmönster från BaseService och andra tjänster
 * för att eliminera kodduplicering och säkerställa konsistent felhantering
 * med svenska meddelanden och GDPR-efterlevnad.
 * 
 * Del av Code Duplication Elimination-initiativet
 */

import { Platform } from 'react-native';

/**
 * Standardiserade felkoder för hela applikationen
 */
export enum ErrorCode {
  // Nätverks- och anslutningsfel
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  
  // Supabase-relaterade fel
  SUPABASE_CONFIG_ERROR = 'SUPABASE_CONFIG_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Validerings- och inmatningsfel
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // BankID-relaterade fel
  BANKID_ERROR = 'BANKID_ERROR',
  BANKID_CANCELLED = 'BANKID_CANCELLED',
  BANKID_TIMEOUT = 'BANKID_TIMEOUT',
  
  // Fil- och mediafel
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  
  // Allmänna fel
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

/**
 * Standardiserad felstruktur för hela applikationen
 */
export interface ServiceError {
  code: ErrorCode;
  message: string;
  context: string;
  timestamp: string;
  platform: string;
  gdprCompliant: boolean;
  metadata?: Record<string, any>;
  retryable?: boolean;
  userFriendly?: boolean;
}

/**
 * Konfiguration för felhantering
 */
export interface ErrorHandlingOptions {
  enableLogging?: boolean;
  enableSentry?: boolean;
  enableRetry?: boolean;
  sanitizeMetadata?: boolean;
  includeStackTrace?: boolean;
}

/**
 * Standardkonfiguration för felhantering
 */
const DEFAULT_ERROR_OPTIONS: ErrorHandlingOptions = {
  enableLogging: true,
  enableSentry: true,
  enableRetry: false,
  sanitizeMetadata: true,
  includeStackTrace: false,
};

/**
 * Känsliga datafält som ska filtreras bort för GDPR-efterlevnad
 * Inkluderar både snake_case och camelCase varianter för fullständig täckning
 */
const SENSITIVE_FIELDS = [
  'password', 'token', 'apikey', 'secret', 'personnummer', 'bankid',
  'email', 'phone', 'address', 'ssn', 'creditcard', 'personalnumber',
  'userid', 'user_id', 'userId', 'sessionid', 'session_id', 'sessionId',
  'authtoken', 'auth_token', 'authToken', 'refreshtoken', 'refresh_token', 'refreshToken'
];

/**
 * Huvudklass för centraliserad felhantering
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private options: ErrorHandlingOptions;

  private constructor(options: Partial<ErrorHandlingOptions> = {}) {
    this.options = { ...DEFAULT_ERROR_OPTIONS, ...options };
  }

  /**
   * Singleton-instans för global felhantering
   */
  public static getInstance(options?: Partial<ErrorHandlingOptions>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(options);
    }
    return ErrorHandler.instance;
  }

  /**
   * Huvudmetod för felhantering - ersätter BaseService.handleError
   */
  public handleError(
    error: Error | unknown,
    context: string,
    serviceName?: string,
    metadata?: Record<string, any>,
    options?: Partial<ErrorHandlingOptions>
  ): ServiceError {
    const mergedOptions = { ...this.options, ...options };
    const actualError = error instanceof Error ? error : new Error(String(error));
    
    const serviceError: ServiceError = {
      code: this.classifyError(actualError),
      message: this.getSwedishErrorMessage(actualError, context),
      context: serviceName ? `${serviceName}.${context}` : context,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      gdprCompliant: true,
      retryable: this.isRetryableError(actualError),
      userFriendly: true,
    };

    // Lägg till saniterad metadata om tillgänglig
    if (metadata && mergedOptions.sanitizeMetadata) {
      serviceError.metadata = this.sanitizeMetadata(metadata);
    }

    // Logga fel om aktiverat
    if (mergedOptions.enableLogging) {
      this.logError(serviceError, actualError, mergedOptions.includeStackTrace);
    }

    // Rapportera till Sentry om aktiverat
    if (mergedOptions.enableSentry) {
      this.reportToSentry(actualError, serviceError);
    }

    return serviceError;
  }

  /**
   * Klassificerar fel baserat på felmeddelande och typ
   */
  private classifyError(error: Error): ErrorCode {
    const message = error.message.toLowerCase();

    // TEMPORARY DEBUG: Force BankID classification for any message containing "bankid"
    if (message.includes('bankid')) {
      return ErrorCode.BANKID_ERROR;
    }

    // BankID-relaterade fel (kontrollera först för specifik matchning)
    // Förbättrad logik för att hantera "BankID authentication failed" korrekt
    if (message.includes('bankid')) {
      if (message.includes('cancelled') || message.includes('avbruten')) {
        return ErrorCode.BANKID_CANCELLED;
      }
      if (message.includes('timeout')) {
        return ErrorCode.BANKID_TIMEOUT;
      }
      return ErrorCode.BANKID_ERROR;
    }

    // Nätverks- och anslutningsfel
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorCode.NETWORK_ERROR;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCode.TIMEOUT_ERROR;
    }
    if (message.includes('connection') && message.includes('failed')) {
      return ErrorCode.CONNECTION_FAILED;
    }

    // Supabase-relaterade fel
    if (message.includes('invalid api key') || message.includes('project not found')) {
      return ErrorCode.SUPABASE_CONFIG_ERROR;
    }
    if (message.includes('database') || message.includes('postgres')) {
      return ErrorCode.DATABASE_ERROR;
    }
    if (message.includes('permission') || message.includes('access denied')) {
      return ErrorCode.PERMISSION_DENIED;
    }
    // Auth error (kontrollera efter BankID och permission för att undvika konflikter)
    // Förbättrad logik för att undvika konflikt med BankID-fel
    if ((message.includes('auth') && !message.includes('bankid')) ||
        (message.includes('unauthorized') && !message.includes('bankid'))) {
      return ErrorCode.AUTH_ERROR;
    }

    // Validerings- och inmatningsfel
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCode.VALIDATION_ERROR;
    }
    if (message.includes('required') || message.includes('missing')) {
      return ErrorCode.MISSING_REQUIRED_FIELD;
    }

    // Fil- och mediafel
    if (message.includes('file') && message.includes('upload')) {
      return ErrorCode.FILE_UPLOAD_ERROR;
    }
    if (message.includes('file too large') || message.includes('size')) {
      return ErrorCode.FILE_TOO_LARGE;
    }
    if (message.includes('unsupported') && message.includes('type')) {
      return ErrorCode.UNSUPPORTED_FILE_TYPE;
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    }

    // Service unavailable
    if (message.includes('service unavailable') || message.includes('503')) {
      return ErrorCode.SERVICE_UNAVAILABLE;
    }

    return ErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Genererar svenska felmeddelanden med GDPR-efterlevnad
   */
  private getSwedishErrorMessage(error: Error, context: string): string {
    const code = this.classifyError(error);
    
    switch (code) {
      case ErrorCode.NETWORK_ERROR:
        return `🌐 Nätverksfel i ${context}. Kontrollera internetanslutning och försök igen.`;
      
      case ErrorCode.TIMEOUT_ERROR:
        return `⏱️ Timeout i ${context}. Begäran tog för lång tid, försök igen om en stund.`;
      
      case ErrorCode.CONNECTION_FAILED:
        return `🔌 Anslutningsfel i ${context}. Kontrollera nätverksanslutning.`;
      
      case ErrorCode.SUPABASE_CONFIG_ERROR:
        return `🔧 Konfigurationsfel i ${context}. Kontrollera Supabase-inställningar.`;
      
      case ErrorCode.DATABASE_ERROR:
        return `🗄️ Databasfel i ${context}. Kontakta support om problemet kvarstår.`;
      
      case ErrorCode.AUTH_ERROR:
        return `🔐 Autentiseringsfel i ${context}. Logga in igen för att fortsätta.`;
      
      case ErrorCode.PERMISSION_DENIED:
        return `🚫 Åtkomst nekad i ${context}. Du saknar behörighet för denna åtgärd.`;
      
      case ErrorCode.VALIDATION_ERROR:
        return `✅ Valideringsfel i ${context}. Kontrollera inmatade data.`;
      
      case ErrorCode.MISSING_REQUIRED_FIELD:
        return `📝 Obligatoriskt fält saknas i ${context}. Fyll i alla nödvändiga fält.`;
      
      case ErrorCode.BANKID_ERROR:
        return `🏦 BankID-fel i ${context}. Kontrollera BankID-appen och försök igen.`;
      
      case ErrorCode.BANKID_CANCELLED:
        return `❌ BankID-inloggning avbruten i ${context}. Försök igen om du vill fortsätta.`;
      
      case ErrorCode.BANKID_TIMEOUT:
        return `⏰ BankID-timeout i ${context}. Försök igen och slutför inom tidsgränsen.`;
      
      case ErrorCode.FILE_UPLOAD_ERROR:
        return `📁 Filuppladdningsfel i ${context}. Kontrollera filformat och storlek.`;
      
      case ErrorCode.FILE_TOO_LARGE:
        return `📏 Filen är för stor i ${context}. Välj en mindre fil och försök igen.`;
      
      case ErrorCode.UNSUPPORTED_FILE_TYPE:
        return `📄 Filtypen stöds inte i ${context}. Välj en giltig filtyp.`;
      
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return `🚦 För många förfrågningar i ${context}. Vänta en stund innan du försöker igen.`;
      
      case ErrorCode.SERVICE_UNAVAILABLE:
        return `🔧 Tjänsten är tillfälligt otillgänglig i ${context}. Försök igen senare.`;
      
      default:
        return `❌ Ett oväntat fel inträffade i ${context}. Kontakta support om problemet kvarstår.`;
    }
  }

  /**
   * Kontrollerar om ett fel kan försökas igen
   */
  private isRetryableError(error: Error): boolean {
    const code = this.classifyError(error);
    
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.CONNECTION_FAILED,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.DATABASE_ERROR, // Vissa databasfel kan vara tillfälliga
    ];
    
    return retryableCodes.includes(code);
  }

  /**
   * Saniterar metadata för GDPR-efterlevnad
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();

      // Debug logging för test
      if (process.env.NODE_ENV === 'test' && key === 'userId') {
        console.log('DEBUG: GDPR sanitization for userId:', {
          key,
          lowerKey,
          sensitiveFields: SENSITIVE_FIELDS,
          matches: SENSITIVE_FIELDS.some(field => {
            const lowerField = field.toLowerCase();
            return lowerKey === lowerField || lowerKey.includes(lowerField);
          })
        });
      }

      // Filtrera bort känsliga fält - förbättrad logik för exakt matchning
      const isSensitive = SENSITIVE_FIELDS.some(field => {
        const lowerField = field.toLowerCase();
        return lowerKey === lowerField || lowerKey.includes(lowerField);
      });

      if (isSensitive) {
        sanitized[key] = '[REDACTED_FOR_GDPR]';
      } else if (typeof value === 'object' && value !== null) {
        // Rekursivt sanitera objekt
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Loggar fel med GDPR-säker information
   */
  private logError(serviceError: ServiceError, originalError: Error, includeStackTrace?: boolean): void {
    const logData = {
      code: serviceError.code,
      message: serviceError.message,
      context: serviceError.context,
      platform: serviceError.platform,
      timestamp: serviceError.timestamp,
      retryable: serviceError.retryable,
      metadata: serviceError.metadata,
    };

    if (includeStackTrace && originalError.stack) {
      (logData as any).stack = originalError.stack;
    }

    console.error(`❌ ${serviceError.context}:`, logData);
  }

  /**
   * Rapporterar fel till Sentry med GDPR-säker data
   */
  private reportToSentry(error: Error, serviceError: ServiceError): void {
    if (typeof global !== 'undefined' && (global as any).Sentry) {
      (global as any).Sentry.captureException(error, {
        tags: {
          errorCode: serviceError.code,
          context: serviceError.context,
          platform: serviceError.platform,
          retryable: serviceError.retryable?.toString(),
        },
        extra: {
          timestamp: serviceError.timestamp,
          gdprCompliant: serviceError.gdprCompliant,
          metadata: serviceError.metadata,
        },
        level: this.getSentryLevel(serviceError.code),
      });
    }
  }

  /**
   * Bestämmer Sentry-nivå baserat på felkod
   */
  private getSentryLevel(code: ErrorCode): 'error' | 'warning' | 'info' {
    const warningCodes = [
      ErrorCode.VALIDATION_ERROR,
      ErrorCode.BANKID_CANCELLED,
      ErrorCode.FILE_TOO_LARGE,
      ErrorCode.UNSUPPORTED_FILE_TYPE,
    ];
    
    const infoCodes = [
      ErrorCode.RATE_LIMIT_EXCEEDED,
    ];
    
    if (warningCodes.includes(code)) return 'warning';
    if (infoCodes.includes(code)) return 'info';
    return 'error';
  }
}

/**
 * Globala hjälpfunktioner för enkel användning
 */

/**
 * Snabb felhantering för vanliga fall
 */
export function handleError(
  error: Error | unknown,
  context: string,
  serviceName?: string,
  metadata?: Record<string, any>
): ServiceError {
  // Debug logging för test
  if (process.env.NODE_ENV === 'test') {
    console.log('DEBUG: Global handleError called:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      context,
      serviceName
    });
  }

  return ErrorHandler.getInstance().handleError(error, context, serviceName, metadata);
}

/**
 * Skapar en användarvänlig felmeddelande från ServiceError
 */
export function getUserFriendlyMessage(serviceError: ServiceError): string {
  return serviceError.message;
}

/**
 * Kontrollerar om ett fel kan försökas igen
 */
export function isRetryable(serviceError: ServiceError): boolean {
  return serviceError.retryable === true;
}

/**
 * Skapar en ServiceError från en vanlig Error
 */
export function createServiceError(
  error: Error,
  context: string,
  code?: ErrorCode
): ServiceError {
  const handler = ErrorHandler.getInstance();
  const serviceError = handler.handleError(error, context);
  
  if (code) {
    serviceError.code = code;
  }
  
  return serviceError;
}

// Exportera singleton-instans för global användning
export const errorHandler = ErrorHandler.getInstance();
