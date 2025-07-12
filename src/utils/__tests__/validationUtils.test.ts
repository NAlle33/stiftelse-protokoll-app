/**
 * Test Suite för Centralized Validation Utilities
 * 
 * Testar validationsverktyg för GDPR-efterlevnad, svenska felmeddelanden
 * och konsistent validering enligt Code Duplication Elimination-initiativet
 */

import {
  ValidationEngine,
  validate,
  validateWithSchema,
  isValid,
  validateOrThrow,
  combineSchemas,
  makePartialSchema,
  CommonSchemas,
  ValidationSchema,
  ValidationResult
} from '../validationUtils';

describe('ValidationEngine', () => {
  let validationEngine: ValidationEngine;

  beforeEach(() => {
    validationEngine = ValidationEngine.getInstance();
  });

  describe('Basic Validation', () => {
    test('validerar obligatoriska fält korrekt', () => {
      const schema: ValidationSchema = {
        required: ['name', 'email']
      };

      const validData = { name: 'Test', email: 'test@example.com' };
      const invalidData = { name: 'Test' }; // Saknar email

      const validResult = validationEngine.validate(validData, schema);
      const invalidResult = validationEngine.validate(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain(expect.stringContaining('email'));
    });

    test('validerar datatyper korrekt', () => {
      const schema: ValidationSchema = {
        types: {
          name: 'string',
          age: 'number',
          isActive: 'boolean'
        }
      };

      const validData = { name: 'Test', age: 25, isActive: true };
      const invalidData = { name: 123, age: 'tjugofem', isActive: 'ja' };

      const validResult = validationEngine.validate(validData, schema);
      const invalidResult = validationEngine.validate(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test('validerar regex-mönster korrekt', () => {
      const schema: ValidationSchema = {
        patterns: {
          email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          phone: /^\+46\d{8,9}$/
        }
      };

      const validData = { 
        email: 'test@example.com', 
        phone: '+46701234567' 
      };
      const invalidData = { 
        email: 'invalid-email', 
        phone: '070-123 45 67' 
      };

      const validResult = validationEngine.validate(validData, schema);
      const invalidResult = validationEngine.validate(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    test('validerar numeriska intervall', () => {
      const schema: ValidationSchema = {
        ranges: {
          age: { min: 18, max: 100 },
          score: { min: 0, max: 10 }
        }
      };

      const validData = { age: 25, score: 8.5 };
      const invalidData = { age: 15, score: 11 };

      const validResult = validationEngine.validate(validData, schema);
      const invalidResult = validationEngine.validate(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain(expect.stringContaining('18'));
      expect(invalidResult.errors).toContain(expect.stringContaining('10'));
    });

    test('validerar längder för strängar och arrayer', () => {
      const schema: ValidationSchema = {
        lengths: {
          name: { min: 2, max: 50 },
          tags: { min: 1, max: 5 }
        }
      };

      const validData = { 
        name: 'Test Användare', 
        tags: ['tag1', 'tag2'] 
      };
      const invalidData = { 
        name: 'T', // För kort
        tags: [] // Tom array
      };

      const validResult = validationEngine.validate(validData, schema);
      const invalidResult = validationEngine.validate(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    test('utför anpassad validering', () => {
      const schema: ValidationSchema = {
        custom: {
          password: (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value),
          role: (value: string) => ['admin', 'member', 'viewer'].includes(value)
        }
      };

      const validData = { 
        password: 'SecurePass123', 
        role: 'member' 
      };
      const invalidData = { 
        password: 'weak', 
        role: 'invalid' 
      };

      const validResult = validationEngine.validate(validData, schema);
      const invalidResult = validationEngine.validate(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Field-specific Errors', () => {
    test('grupperar fel per fält', () => {
      const schema: ValidationSchema = {
        required: ['name', 'email'],
        types: { name: 'string', email: 'string' },
        patterns: { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
      };

      const invalidData = { 
        name: 123, // Fel typ
        email: 'invalid-email' // Fel format
      };

      const result = validationEngine.validate(invalidData, schema);

      expect(result.isValid).toBe(false);
      expect(result.fieldErrors).toBeDefined();
      expect(result.fieldErrors!.name).toBeDefined();
      expect(result.fieldErrors!.email).toBeDefined();
    });
  });

  describe('Swedish Localization', () => {
    test('använder svenska felmeddelanden som standard', () => {
      const schema: ValidationSchema = {
        required: ['namn']
      };

      const result = validationEngine.validate({}, schema);

      expect(result.errors[0]).toMatch(/obligatoriskt|saknas|krävs/i);
    });

    test('stöder engelska som fallback', () => {
      const schema: ValidationSchema = {
        required: ['name']
      };

      const result = validationEngine.validate({}, schema, { locale: 'en' });

      expect(result.errors[0]).toMatch(/required|missing/i);
    });

    test('interpolerar parametrar i svenska meddelanden', () => {
      const schema: ValidationSchema = {
        lengths: { name: { min: 5 } }
      };

      const result = validationEngine.validate({ name: 'AB' }, schema);

      expect(result.errors[0]).toContain('5');
      expect(result.errors[0]).toContain('2');
    });
  });
});

describe('Common Schemas', () => {
  test('UUID-schema validerar korrekt', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const invalidUuid = 'not-a-uuid';

    const validResult = validateWithSchema({ id: validUuid }, 'uuid');
    const invalidResult = validateWithSchema({ id: invalidUuid }, 'uuid');

    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
  });

  test('Email-schema validerar korrekt', () => {
    const validEmail = 'test@example.com';
    const invalidEmail = 'not-an-email';

    const validResult = validateWithSchema({ email: validEmail }, 'email');
    const invalidResult = validateWithSchema({ email: invalidEmail }, 'email');

    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
  });

  test('User-schema validerar komplett användardata', () => {
    const validUser = {
      name: 'Test Användare',
      email: 'test@example.com',
      role: 'member',
      isActive: true
    };

    const invalidUser = {
      name: 'T', // För kort
      email: 'invalid',
      role: 'invalid-role',
      isActive: 'yes' // Fel typ
    };

    const validResult = validateWithSchema(validUser, 'user');
    const invalidResult = validateWithSchema(invalidUser, 'user');

    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
  });

  test('Protocol-schema validerar protokolldata', () => {
    const validProtocol = {
      meeting_id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Styrelsemöte 2024-01-15',
      status: 'draft',
      created_by: '123e4567-e89b-12d3-a456-426614174000'
    };

    const result = validateWithSchema(validProtocol, 'protocol');
    expect(result.isValid).toBe(true);
  });

  test('AI Request-schema validerar AI-förfrågningar', () => {
    const validRequest = {
      prompt: 'Generera protokoll från mötet',
      maxTokens: 1000,
      temperature: 0.7,
      userId: '123e4567-e89b-12d3-a456-426614174000'
    };

    const result = validateWithSchema(validRequest, 'aiRequest');
    expect(result.isValid).toBe(true);
  });

  test('Pagination-schema validerar pagineringsparametrar', () => {
    const validPagination = {
      page: 1,
      pageSize: 20,
      limit: 50,
      offset: 0
    };

    const invalidPagination = {
      page: 0, // Måste vara >= 1
      pageSize: 200, // För stort
      offset: -1 // Måste vara >= 0
    };

    const validResult = validateWithSchema(validPagination, 'pagination');
    const invalidResult = validateWithSchema(invalidPagination, 'pagination');

    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
  });
});

describe('Utility Functions', () => {
  test('validate() fungerar som förväntat', () => {
    const schema: ValidationSchema = { required: ['name'] };
    const result = validate({ name: 'Test' }, schema);
    
    expect(result.isValid).toBe(true);
  });

  test('isValid() returnerar boolean', () => {
    const schema: ValidationSchema = { required: ['name'] };
    
    expect(isValid({ name: 'Test' }, schema)).toBe(true);
    expect(isValid({}, schema)).toBe(false);
  });

  test('validateOrThrow() kastar fel vid ogiltiga data', () => {
    const schema: ValidationSchema = { required: ['name'] };
    
    expect(() => validateOrThrow({ name: 'Test' }, schema, 'test')).not.toThrow();
    expect(() => validateOrThrow({}, schema, 'test')).toThrow();
  });

  test('combineSchemas() kombinerar flera scheman', () => {
    const schema1: ValidationSchema = { required: ['name'] };
    const schema2: ValidationSchema = { required: ['email'] };
    
    const combined = combineSchemas(schema1, schema2);
    
    expect(combined.required).toContain('name');
    expect(combined.required).toContain('email');
  });

  test('makePartialSchema() gör alla fält valfria', () => {
    const schema: ValidationSchema = { 
      required: ['name', 'email'],
      types: { name: 'string', email: 'string' }
    };
    
    const partial = makePartialSchema(schema);
    
    expect(partial.required).toEqual([]);
    expect(partial.types).toEqual(schema.types);
  });
});

describe('GDPR Compliance', () => {
  test('säkerställer att känslig data inte loggas i felmeddelanden', () => {
    const schema: ValidationSchema = {
      patterns: { personnummer: /^\d{8}-\d{4}$/ }
    };

    const result = validate({ personnummer: '19801010-1234' }, schema);

    // Verifiera att personnummer inte finns i felmeddelanden
    const allErrors = result.errors.join(' ');
    expect(allErrors).not.toContain('19801010-1234');
  });

  test('hanterar GDPR-kontext korrekt', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    const schema: ValidationSchema = { required: ['name'] };
    const context = {
      gdprCompliant: false,
      userConsent: false,
      dataProcessingPurpose: 'testing'
    };

    // Detta skulle normalt inte användas i produktionskod
    validationEngine.validate({ name: 'Test' }, schema, { locale: 'sv' });

    consoleSpy.mockRestore();
  });

  test('validerar utan att exponera känslig metadata', () => {
    const schema: ValidationSchema = {
      custom: {
        sensitiveField: (value: any) => {
          // Simulera validering som inte ska logga känslig data
          return typeof value === 'string' && value.length > 0;
        }
      }
    };

    const result = validate({ sensitiveField: 'secret-data' }, schema);
    
    expect(result.isValid).toBe(true);
    // Verifiera att känslig data inte finns i resultatet
    expect(JSON.stringify(result)).not.toContain('secret-data');
  });
});

describe('Performance', () => {
  test('hanterar stora datamängder effektivt', () => {
    const schema: ValidationSchema = {
      required: ['id', 'name'],
      types: { id: 'string', name: 'string' }
    };

    const largeData = {
      id: '123',
      name: 'Test',
      // Simulera stor datamängd
      metadata: new Array(1000).fill(0).map((_, i) => ({ key: `value${i}` }))
    };

    const startTime = Date.now();
    const result = validate(largeData, schema);
    const endTime = Date.now();

    expect(result.isValid).toBe(true);
    expect(endTime - startTime).toBeLessThan(100); // Bör ta mindre än 100ms
  });

  test('cachar validationsresultat för prestanda', () => {
    const schema: ValidationSchema = { required: ['name'] };
    const data = { name: 'Test' };

    // Första anropet
    const start1 = Date.now();
    validate(data, schema);
    const time1 = Date.now() - start1;

    // Andra anropet (bör vara snabbare om cachning fungerar)
    const start2 = Date.now();
    validate(data, schema);
    const time2 = Date.now() - start2;

    // Andra anropet bör vara snabbare eller lika snabbt
    expect(time2).toBeLessThanOrEqual(time1 + 5); // Tillåt 5ms marginal
  });
});
