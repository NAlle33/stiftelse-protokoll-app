/**
 * Centralized Validation Utilities - SÖKA Stiftelseappen
 * 
 * Konsoliderar valideringslogik från BaseService och andra tjänster
 * för att eliminera kodduplicering och säkerställa konsistent validering
 * med svenska felmeddelanden och GDPR-efterlevnad.
 * 
 * Del av Code Duplication Elimination-initiativet
 */

import { ErrorCode, handleError } from './errorHandling';

/**
 * Utökad validationsschema-interface
 */
export interface ValidationSchema {
  required?: string[];
  types?: Record<string, string>;
  patterns?: Record<string, RegExp>;
  custom?: Record<string, (value: any) => boolean>;
  ranges?: Record<string, { min?: number; max?: number }>;
  lengths?: Record<string, { min?: number; max?: number }>;
}

/**
 * Valideringsresultat
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  fieldErrors?: Record<string, string[]>;
}

/**
 * Valideringsalternativ
 */
export interface ValidationOptions {
  allowPartial?: boolean;
  strictMode?: boolean;
  includeWarnings?: boolean;
  locale?: 'sv' | 'en';
}

/**
 * Huvudklass för validering
 */
export class ValidationEngine {
  private static instance: ValidationEngine;
  private locale: 'sv' | 'en' = 'sv';

  private constructor() {}

  /**
   * Singleton-instans för global validering
   */
  public static getInstance(): ValidationEngine {
    if (!ValidationEngine.instance) {
      ValidationEngine.instance = new ValidationEngine();
    }
    return ValidationEngine.instance;
  }

  /**
   * Huvudmetod för validering - ersätter BaseService.validateInput
   */
  public validate(
    data: unknown,
    schema: ValidationSchema,
    options: ValidationOptions = {}
  ): ValidationResult {
    const opts = {
      allowPartial: false,
      strictMode: true,
      includeWarnings: false,
      locale: this.locale,
      ...options,
    };

    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldErrors: Record<string, string[]> = {};

    // Grundläggande datavalidering
    if (!data || typeof data !== 'object') {
      errors.push(this.getMessage('INVALID_DATA_TYPE', opts.locale));
      return { isValid: false, errors, fieldErrors };
    }

    const dataObj = data as Record<string, any>;

    // Validera obligatoriska fält
    this.validateRequiredFields(dataObj, schema, errors, fieldErrors, opts.locale);

    // Validera datatyper
    this.validateTypes(dataObj, schema, errors, fieldErrors, opts.locale);

    // Validera mönster (regex)
    this.validatePatterns(dataObj, schema, errors, fieldErrors, opts.locale);

    // Validera intervall (numeriska värden)
    this.validateRanges(dataObj, schema, errors, fieldErrors, opts.locale);

    // Validera längder (strängar och arrayer)
    this.validateLengths(dataObj, schema, errors, fieldErrors, opts.locale);

    // Anpassad validering
    this.validateCustom(dataObj, schema, errors, fieldErrors, opts.locale);

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      fieldErrors,
    };

    if (opts.includeWarnings) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Validerar obligatoriska fält
   */
  private validateRequiredFields(
    data: Record<string, any>,
    schema: ValidationSchema,
    errors: string[],
    fieldErrors: Record<string, string[]>,
    locale: 'sv' | 'en'
  ): void {
    if (!schema.required) return;

    for (const field of schema.required) {
      if (!(field in data) || data[field] === null || data[field] === undefined || data[field] === '') {
        const message = this.getMessage('REQUIRED_FIELD_MISSING', locale, { field });
        errors.push(message);
        this.addFieldError(fieldErrors, field, message);
      }
    }
  }

  /**
   * Validerar datatyper
   */
  private validateTypes(
    data: Record<string, any>,
    schema: ValidationSchema,
    errors: string[],
    fieldErrors: Record<string, string[]>,
    locale: 'sv' | 'en'
  ): void {
    if (!schema.types) return;

    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (!(field in data) || data[field] === null || data[field] === undefined) {
        continue; // Hanteras av required-validering
      }

      const value = data[field];
      const actualType = this.getActualType(value);

      // Hantera union types (t.ex. "string|number")
      const allowedTypes = expectedType.split('|').map(t => t.trim());
      
      if (!allowedTypes.includes(actualType)) {
        const message = this.getMessage('INVALID_TYPE', locale, { 
          field, 
          expected: expectedType, 
          actual: actualType 
        });
        errors.push(message);
        this.addFieldError(fieldErrors, field, message);
      }
    }
  }

  /**
   * Validerar regex-mönster
   */
  private validatePatterns(
    data: Record<string, any>,
    schema: ValidationSchema,
    errors: string[],
    fieldErrors: Record<string, string[]>,
    locale: 'sv' | 'en'
  ): void {
    if (!schema.patterns) return;

    for (const [field, pattern] of Object.entries(schema.patterns)) {
      if (!(field in data) || data[field] === null || data[field] === undefined) {
        continue;
      }

      const value = String(data[field]);
      if (!pattern.test(value)) {
        const message = this.getMessage('PATTERN_MISMATCH', locale, { field });
        errors.push(message);
        this.addFieldError(fieldErrors, field, message);
      }
    }
  }

  /**
   * Validerar numeriska intervall
   */
  private validateRanges(
    data: Record<string, any>,
    schema: ValidationSchema,
    errors: string[],
    fieldErrors: Record<string, string[]>,
    locale: 'sv' | 'en'
  ): void {
    if (!schema.ranges) return;

    for (const [field, range] of Object.entries(schema.ranges)) {
      if (!(field in data) || data[field] === null || data[field] === undefined) {
        continue;
      }

      const value = Number(data[field]);
      if (isNaN(value)) continue; // Hanteras av type-validering

      if (range.min !== undefined && value < range.min) {
        const message = this.getMessage('VALUE_TOO_SMALL', locale, { 
          field, 
          min: range.min, 
          value 
        });
        errors.push(message);
        this.addFieldError(fieldErrors, field, message);
      }

      if (range.max !== undefined && value > range.max) {
        const message = this.getMessage('VALUE_TOO_LARGE', locale, { 
          field, 
          max: range.max, 
          value 
        });
        errors.push(message);
        this.addFieldError(fieldErrors, field, message);
      }
    }
  }

  /**
   * Validerar längder för strängar och arrayer
   */
  private validateLengths(
    data: Record<string, any>,
    schema: ValidationSchema,
    errors: string[],
    fieldErrors: Record<string, string[]>,
    locale: 'sv' | 'en'
  ): void {
    if (!schema.lengths) return;

    for (const [field, length] of Object.entries(schema.lengths)) {
      if (!(field in data) || data[field] === null || data[field] === undefined) {
        continue;
      }

      const value = data[field];
      let actualLength: number;

      if (typeof value === 'string' || Array.isArray(value)) {
        actualLength = value.length;
      } else {
        continue; // Kan inte validera längd för denna typ
      }

      if (length.min !== undefined && actualLength < length.min) {
        const message = this.getMessage('LENGTH_TOO_SHORT', locale, { 
          field, 
          min: length.min, 
          actual: actualLength 
        });
        errors.push(message);
        this.addFieldError(fieldErrors, field, message);
      }

      if (length.max !== undefined && actualLength > length.max) {
        const message = this.getMessage('LENGTH_TOO_LONG', locale, { 
          field, 
          max: length.max, 
          actual: actualLength 
        });
        errors.push(message);
        this.addFieldError(fieldErrors, field, message);
      }
    }
  }

  /**
   * Anpassad validering
   */
  private validateCustom(
    data: Record<string, any>,
    schema: ValidationSchema,
    errors: string[],
    fieldErrors: Record<string, string[]>,
    locale: 'sv' | 'en'
  ): void {
    if (!schema.custom) return;

    for (const [field, validator] of Object.entries(schema.custom)) {
      if (!(field in data) || data[field] === null || data[field] === undefined) {
        continue;
      }

      try {
        if (!validator(data[field])) {
          const message = this.getMessage('CUSTOM_VALIDATION_FAILED', locale, { field });
          errors.push(message);
          this.addFieldError(fieldErrors, field, message);
        }
      } catch (error) {
        const message = this.getMessage('VALIDATION_ERROR', locale, { 
          field, 
          error: (error as Error).message 
        });
        errors.push(message);
        this.addFieldError(fieldErrors, field, message);
      }
    }
  }

  /**
   * Bestämmer faktisk datatyp
   */
  private getActualType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }

  /**
   * Lägger till fel för specifikt fält
   */
  private addFieldError(fieldErrors: Record<string, string[]>, field: string, message: string): void {
    if (!fieldErrors[field]) {
      fieldErrors[field] = [];
    }
    fieldErrors[field].push(message);
  }

  /**
   * Hämtar lokaliserat meddelande
   */
  private getMessage(key: string, locale: 'sv' | 'en', params: Record<string, any> = {}): string {
    const messages = locale === 'sv' ? SWEDISH_MESSAGES : ENGLISH_MESSAGES;
    let message = messages[key] || key;

    // Ersätt parametrar i meddelandet
    Object.entries(params).forEach(([param, value]) => {
      message = message.replace(new RegExp(`{${param}}`, 'g'), String(value));
    });

    return message;
  }
}

/**
 * Svenska felmeddelanden
 */
const SWEDISH_MESSAGES: Record<string, string> = {
  INVALID_DATA_TYPE: 'Data måste vara ett objekt',
  REQUIRED_FIELD_MISSING: 'Obligatoriskt fält saknas: {field}',
  INVALID_TYPE: 'Felaktig datatyp för {field}: förväntade {expected}, fick {actual}',
  PATTERN_MISMATCH: 'Ogiltigt format för {field}',
  VALUE_TOO_SMALL: '{field} måste vara minst {min} (fick {value})',
  VALUE_TOO_LARGE: '{field} får inte vara större än {max} (fick {value})',
  LENGTH_TOO_SHORT: '{field} måste vara minst {min} tecken (fick {actual})',
  LENGTH_TOO_LONG: '{field} får inte vara längre än {max} tecken (fick {actual})',
  CUSTOM_VALIDATION_FAILED: 'Anpassad validering misslyckades för {field}',
  VALIDATION_ERROR: 'Valideringsfel för {field}: {error}',
};

/**
 * Engelska felmeddelanden (fallback)
 */
const ENGLISH_MESSAGES: Record<string, string> = {
  INVALID_DATA_TYPE: 'Data must be an object',
  REQUIRED_FIELD_MISSING: 'Required field missing: {field}',
  INVALID_TYPE: 'Invalid type for {field}: expected {expected}, got {actual}',
  PATTERN_MISMATCH: 'Invalid format for {field}',
  VALUE_TOO_SMALL: '{field} must be at least {min} (got {value})',
  VALUE_TOO_LARGE: '{field} must not be greater than {max} (got {value})',
  LENGTH_TOO_SHORT: '{field} must be at least {min} characters (got {actual})',
  LENGTH_TOO_LONG: '{field} must not be longer than {max} characters (got {actual})',
  CUSTOM_VALIDATION_FAILED: 'Custom validation failed for {field}',
  VALIDATION_ERROR: 'Validation error for {field}: {error}',
};

/**
 * Fördefinierade validationsscheman för vanliga datatyper
 */
export const CommonSchemas = {
  /**
   * UUID-validering
   */
  uuid: {
    types: { id: 'string' },
    patterns: { id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
  } as ValidationSchema,

  /**
   * E-postvalidering
   */
  email: {
    types: { email: 'string' },
    patterns: { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  } as ValidationSchema,

  /**
   * Användarvalidering
   */
  user: {
    required: ['name', 'email'],
    types: {
      name: 'string',
      email: 'string',
      role: 'string',
      isActive: 'boolean',
    },
    patterns: {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    lengths: {
      name: { min: 2, max: 100 },
    },
    custom: {
      role: (value: string) => ['admin', 'member', 'viewer'].includes(value),
    },
  } as ValidationSchema,

  /**
   * Protokollvalidering
   */
  protocol: {
    required: ['meeting_id', 'title', 'created_by'],
    types: {
      meeting_id: 'string',
      title: 'string',
      status: 'string',
      created_by: 'string',
      template_id: 'string',
    },
    patterns: {
      meeting_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      created_by: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    },
    lengths: {
      title: { min: 3, max: 200 },
    },
    custom: {
      status: (value: string) => ['draft', 'review', 'approved', 'signed', 'archived'].includes(value),
    },
  } as ValidationSchema,

  /**
   * AI-förfrågan validering
   */
  aiRequest: {
    required: ['prompt', 'userId'],
    types: {
      prompt: 'string',
      maxTokens: 'number',
      temperature: 'number',
      model: 'string',
      userId: 'string',
      sessionId: 'string',
    },
    patterns: {
      userId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    },
    lengths: {
      prompt: { min: 1, max: 10000 },
    },
    ranges: {
      maxTokens: { min: 1, max: 4000 },
      temperature: { min: 0, max: 2 },
    },
  } as ValidationSchema,

  /**
   * Paginering validering
   */
  pagination: {
    types: {
      page: 'number',
      pageSize: 'number',
      limit: 'number',
      offset: 'number',
    },
    ranges: {
      page: { min: 1 },
      pageSize: { min: 1, max: 100 },
      limit: { min: 1, max: 100 },
      offset: { min: 0 },
    },
  } as ValidationSchema,
};

/**
 * Globala hjälpfunktioner för enkel användning
 */

/**
 * Snabb validering - ersätter BaseService.validateInput
 */
export function validate(
  data: unknown,
  schema: ValidationSchema,
  options?: ValidationOptions
): ValidationResult {
  return ValidationEngine.getInstance().validate(data, schema, options);
}

/**
 * Validerar med fördefinierat schema
 */
export function validateWithSchema(
  data: unknown,
  schemaName: keyof typeof CommonSchemas,
  options?: ValidationOptions
): ValidationResult {
  const schema = CommonSchemas[schemaName];
  return validate(data, schema, options);
}

/**
 * Kontrollerar om data är giltig
 */
export function isValid(
  data: unknown,
  schema: ValidationSchema,
  options?: ValidationOptions
): boolean {
  return validate(data, schema, options).isValid;
}

/**
 * Validerar och kastar fel om ogiltigt
 */
export function validateOrThrow(
  data: unknown,
  schema: ValidationSchema,
  context: string = 'validation',
  options?: ValidationOptions
): void {
  const result = validate(data, schema, options);

  if (!result.isValid) {
    const errorMessage = result.errors.join(', ');
    const error = new Error(`Valideringsfel i ${context}: ${errorMessage}`);

    // Använd centraliserad felhantering
    handleError(error, context, 'ValidationUtils');
    throw error;
  }
}

/**
 * Skapar ett anpassat validationsschema genom att kombinera flera scheman
 */
export function combineSchemas(...schemas: ValidationSchema[]): ValidationSchema {
  const combined: ValidationSchema = {
    required: [],
    types: {},
    patterns: {},
    custom: {},
    ranges: {},
    lengths: {},
  };

  schemas.forEach(schema => {
    if (schema.required) {
      combined.required = [...(combined.required || []), ...schema.required];
    }
    if (schema.types) {
      combined.types = { ...combined.types, ...schema.types };
    }
    if (schema.patterns) {
      combined.patterns = { ...combined.patterns, ...schema.patterns };
    }
    if (schema.custom) {
      combined.custom = { ...combined.custom, ...schema.custom };
    }
    if (schema.ranges) {
      combined.ranges = { ...combined.ranges, ...schema.ranges };
    }
    if (schema.lengths) {
      combined.lengths = { ...combined.lengths, ...schema.lengths };
    }
  });

  return combined;
}

/**
 * Skapar ett partiellt schema (alla fält blir valfria)
 */
export function makePartialSchema(schema: ValidationSchema): ValidationSchema {
  return {
    ...schema,
    required: [], // Ta bort alla obligatoriska fält
  };
}

// Exportera singleton-instans för global användning
export const validationEngine = ValidationEngine.getInstance();
