/**
 * Sentry Service - Centralized error reporting and performance tracking
 * 
 * Provides GDPR-compliant error reporting and performance monitoring
 * with Swedish localization and data sanitization.
 */

import { Platform } from 'react-native';

// Types for Sentry reporting
interface PerformanceMetrics {
  inputLength?: number;
  outputLength?: number;
  success: boolean;
  startTime: number;
  service: string;
  operation: string;
  requestId: string;
  tokenCount?: number;
}

interface ErrorContext {
  operation?: string;
  service?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Reports Azure OpenAI API errors with GDPR-safe data
 */
export function reportAzureOpenAIError(
  error: Error,
  context: ErrorContext = {}
): void {
  try {
    if (typeof global !== 'undefined' && (global as any).Sentry) {
      (global as any).Sentry.captureException(error, {
        tags: {
          service: 'azure_openai',
          operation: context.operation || 'unknown',
          platform: Platform.OS,
        },
        extra: {
          service: context.service,
          requestId: context.requestId,
          // Sanitize metadata to remove PII
          metadata: sanitizeMetadata(context.metadata),
          timestamp: new Date().toISOString(),
        },
        level: 'error',
      });
    }
    
    console.error('🤖 Azure OpenAI Error:', {
      operation: context.operation,
      service: context.service,
      error: error.message,
      platform: Platform.OS,
    });
  } catch (sentryError) {
    console.error('❌ Failed to report Azure OpenAI error to Sentry:', sentryError);
  }
}

/**
 * Reports transcription errors with GDPR-safe data
 */
export function reportTranscriptionError(
  error: Error,
  context: ErrorContext = {}
): void {
  try {
    if (typeof global !== 'undefined' && (global as any).Sentry) {
      (global as any).Sentry.captureException(error, {
        tags: {
          service: 'transcription',
          operation: context.operation || 'unknown',
          platform: Platform.OS,
        },
        extra: {
          service: context.service,
          requestId: context.requestId,
          metadata: sanitizeMetadata(context.metadata),
          timestamp: new Date().toISOString(),
        },
        level: 'error',
      });
    }
    
    console.error('🎤 Transcription Error:', {
      operation: context.operation,
      service: context.service,
      error: error.message,
      platform: Platform.OS,
    });
  } catch (sentryError) {
    console.error('❌ Failed to report transcription error to Sentry:', sentryError);
  }
}

/**
 * Tracks protocol generation performance metrics
 */
export function trackProtocolGenerationPerformance(
  metrics: PerformanceMetrics
): void {
  try {
    const duration = Date.now() - metrics.startTime;
    
    if (typeof global !== 'undefined' && (global as any).Sentry) {
      // Create a performance transaction
      const transaction = (global as any).Sentry.startTransaction({
        name: `protocol_generation_${metrics.operation}`,
        op: 'ai.protocol.generation',
        tags: {
          service: metrics.service,
          operation: metrics.operation,
          success: metrics.success.toString(),
          platform: Platform.OS,
        },
      });
      
      transaction.setData('duration', duration);
      transaction.setData('inputLength', metrics.inputLength);
      transaction.setData('outputLength', metrics.outputLength);
      transaction.setData('tokenCount', metrics.tokenCount);
      transaction.setData('requestId', metrics.requestId);
      
      transaction.setStatus(metrics.success ? 'ok' : 'internal_error');
      transaction.finish();
    }
    
    console.log('📊 Protocol Generation Performance:', {
      operation: metrics.operation,
      service: metrics.service,
      duration,
      success: metrics.success,
      inputLength: metrics.inputLength,
      outputLength: metrics.outputLength,
      tokenCount: metrics.tokenCount,
      platform: Platform.OS,
    });
  } catch (sentryError) {
    console.error('❌ Failed to track protocol generation performance:', sentryError);
  }
}

/**
 * Reports AI rate limit errors
 */
export function reportAIRateLimitError(
  error: Error,
  context: ErrorContext = {}
): void {
  try {
    if (typeof global !== 'undefined' && (global as any).Sentry) {
      (global as any).Sentry.captureException(error, {
        tags: {
          service: 'ai_rate_limit',
          operation: context.operation || 'unknown',
          platform: Platform.OS,
        },
        extra: {
          service: context.service,
          requestId: context.requestId,
          metadata: sanitizeMetadata(context.metadata),
          timestamp: new Date().toISOString(),
        },
        level: 'warning', // Rate limits are warnings, not errors
      });
    }
    
    console.warn('⚠️ AI Rate Limit Error:', {
      operation: context.operation,
      service: context.service,
      error: error.message,
      platform: Platform.OS,
    });
  } catch (sentryError) {
    console.error('❌ Failed to report AI rate limit error to Sentry:', sentryError);
  }
}

/**
 * Sanitizes metadata to remove PII and sensitive data for GDPR compliance
 */
function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata) return {};
  
  const sanitized: Record<string, any> = {};
  const sensitiveKeys = [
    'personnummer',
    'email',
    'phone',
    'address',
    'name',
    'password',
    'token',
    'key',
    'secret',
    'auth',
  ];
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitiveKey => 
      lowerKey.includes(sensitiveKey)
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED_FOR_GDPR]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
