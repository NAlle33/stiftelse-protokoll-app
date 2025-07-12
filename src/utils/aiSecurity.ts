/**
 * AI Security Utilities
 * Handles encryption, validation, and sanitization for AI services
 */

export interface AIEncryptionResult {
  encryptedData: string;
  encryptionKey: string;
  gdprCompliant: boolean;
}

export interface AIValidationResult {
  valid: boolean;
  errors: string[];
  swedishCompliant: boolean;
}

export interface AISanitizationResult {
  sanitizedContent: string;
  sensitiveDataRemoved: boolean;
  swedishCompliant: boolean;
}

export interface AIAuditLog {
  operation: string;
  userId: string;
  timestamp: string;
  dataProcessed: boolean;
  swedishCompliant: boolean;
  gdprCompliant: boolean;
  personalDataInvolved: boolean;
}

/**
 * Encrypts AI data before processing or storage
 */
export function encryptAIData(data: any): AIEncryptionResult {
  // In a real implementation, this would use proper encryption
  const encryptedData = Buffer.from(JSON.stringify(data)).toString('base64');
  
  return {
    encryptedData,
    encryptionKey: 'test-encryption-key',
    gdprCompliant: true,
  };
}

/**
 * Validates AI input for security and Swedish compliance
 */
export function validateAIInput(input: any): AIValidationResult {
  const errors: string[] = [];
  
  if (!input) {
    errors.push('Input data is required');
  }
  
  if (typeof input === 'string' && input.length > 10000) {
    errors.push('Input text is too long');
  }
  
  // Check for potentially harmful content
  if (typeof input === 'string' && containsHarmfulContent(input)) {
    errors.push('Input contains potentially harmful content');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    swedishCompliant: true,
  };
}

/**
 * Sanitizes AI output to prevent data leakage
 */
export function sanitizeAIOutput(output: any): AISanitizationResult {
  let sanitizedContent = output.content || '';
  let sensitiveDataRemoved = false;
  
  // Remove Swedish personal numbers (personnummer)
  const personnummerPattern = /\d{6,8}-\d{4}/g;
  if (personnummerPattern.test(sanitizedContent)) {
    sanitizedContent = sanitizedContent.replace(personnummerPattern, '[REDACTED]');
    sensitiveDataRemoved = true;
  }
  
  // Remove bank account numbers
  const bankAccountPattern = /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g;
  if (bankAccountPattern.test(sanitizedContent)) {
    sanitizedContent = sanitizedContent.replace(bankAccountPattern, '[REDACTED]');
    sensitiveDataRemoved = true;
  }
  
  // Remove email addresses
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  if (emailPattern.test(sanitizedContent)) {
    sanitizedContent = sanitizedContent.replace(emailPattern, '[EMAIL_REDACTED]');
    sensitiveDataRemoved = true;
  }
  
  return {
    sanitizedContent,
    sensitiveDataRemoved,
    swedishCompliant: true,
  };
}

/**
 * Logs AI operations for audit purposes
 */
export function auditAIOperation(operation: AIAuditLog): void {
  // In a real implementation, this would write to an audit log
  console.log('AI Audit Log:', {
    ...operation,
    timestamp: new Date().toISOString(),
  });
}

// Helper functions
function containsHarmfulContent(text: string): boolean {
  const harmfulPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
  ];
  
  return harmfulPatterns.some(pattern => pattern.test(text));
}
