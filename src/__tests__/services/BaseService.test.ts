import { BaseService, ValidationSchema, ServiceOptions } from '../../services/BaseService';

/**
 * Test implementation av BaseService för att testa funktionalitet
 */
class TestService extends BaseService {
  protected readonly serviceName = 'TestService';
  
  constructor(options?: Partial<ServiceOptions>) {
    super(options);
  }

  protected async initialize(): Promise<void> {
    // Test-specifik initialisering
    this.clearExpiredCache();
  }

  // Exponera skyddade metoder för testning
  public testHandleError(error: Error, context: string) {
    return this.handleError(error, context);
  }

  public testValidateInput(data: unknown, schema: ValidationSchema) {
    return this.validateInput(data, schema);
  }

  public testGetCacheKey(operation: string, params: Record<string, any>) {
    return this.getCacheKey(operation, params);
  }

  public testSetCache<T>(key: string, data: T) {
    this.setCache(key, data);
  }

  public testGetFromCache<T>(key: string) {
    return this.getFromCache<T>(key);
  }

  public testClearCache() {
    this.clearCache();
  }

  public async testExecuteQuery<T>(queryFn: () => Promise<T>, operationName: string) {
    return this.executeQuery(queryFn, operationName);
  }
}

describe('BaseService', () => {
  let testService: TestService;

  beforeEach(() => {
    testService = new TestService();
  });

  afterEach(() => {
    testService.testClearCache();
  });

  describe('Felhantering', () => {
    it('ska hantera nätverksfel med svenska meddelanden', () => {
      const error = new Error('Network request failed');
      const serviceError = testService.testHandleError(error, 'testOperation');

      expect(serviceError.code).toBe('NETWORK_ERROR');
      expect(serviceError.message).toContain('Nätverksfel');
      expect(serviceError.message).toContain('testOperation');
      expect(serviceError.context).toBe('TestService.testOperation');
      expect(serviceError.gdprCompliant).toBe(true);
      expect(serviceError.platform).toBeDefined();
      expect(serviceError.timestamp).toBeDefined();
    });

    it('ska hantera Supabase-konfigurationsfel', () => {
      const error = new Error('Invalid API key');
      const serviceError = testService.testHandleError(error, 'configTest');

      expect(serviceError.code).toBe('SUPABASE_CONFIG_ERROR');
      expect(serviceError.message).toContain('Konfigurationsfel');
      expect(serviceError.message).toContain('Supabase-inställningar');
    });

    it('ska hantera timeout-fel', () => {
      const error = new Error('Request timeout');
      const serviceError = testService.testHandleError(error, 'timeoutTest');

      expect(serviceError.code).toBe('TIMEOUT_ERROR');
      expect(serviceError.message).toContain('Timeout');
      expect(serviceError.message).toContain('Försök igen');
    });

    it('ska hantera databasfel', () => {
      const error = new Error('Database error: Connection failed');
      const serviceError = testService.testHandleError(error, 'dbTest');

      expect(serviceError.code).toBe('DATABASE_ERROR');
      expect(serviceError.message).toContain('Databasfel');
      expect(serviceError.message).toContain('support');
    });

    it('ska hantera valideringsfel', () => {
      const error = new Error('Validation failed');
      const serviceError = testService.testHandleError(error, 'validationTest');

      expect(serviceError.code).toBe('VALIDATION_ERROR');
      expect(serviceError.message).toContain('Valideringsfel');
      expect(serviceError.message).toContain('inmatade data');
    });

    it('ska hantera okända fel', () => {
      const error = new Error('Unknown error');
      const serviceError = testService.testHandleError(error, 'unknownTest');

      expect(serviceError.code).toBe('UNKNOWN_ERROR');
      expect(serviceError.message).toContain('oväntat fel');
      expect(serviceError.message).toContain('support');
    });
  });

  describe('Inmatningsvalidering', () => {
    it('ska validera obligatoriska fält', () => {
      const schema: ValidationSchema = {
        required: ['name', 'email']
      };

      const validData = { name: 'Test', email: 'test@example.com' };
      const invalidData = { name: 'Test' }; // saknar email

      const validResult = testService.testValidateInput(validData, schema);
      const invalidResult = testService.testValidateInput(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Obligatoriskt fält saknas: email');
    });

    it('ska validera datatyper', () => {
      const schema: ValidationSchema = {
        types: {
          name: 'string',
          age: 'number',
          isActive: 'boolean'
        }
      };

      const validData = { name: 'Test', age: 25, isActive: true };
      const invalidData = { name: 123, age: '25', isActive: 'true' };

      const validResult = testService.testValidateInput(validData, schema);
      const invalidResult = testService.testValidateInput(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Fel datatyp för name: förväntade string, fick number');
    });

    it('ska validera regex-mönster', () => {
      const schema: ValidationSchema = {
        patterns: {
          email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          phone: /^\+46\d{8,9}$/
        }
      };

      const validData = { email: 'test@example.com', phone: '+46701234567' };
      const invalidData = { email: 'invalid-email', phone: '0701234567' };

      const validResult = testService.testValidateInput(validData, schema);
      const invalidResult = testService.testValidateInput(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Ogiltigt format för email');
      expect(invalidResult.errors).toContain('Ogiltigt format för phone');
    });

    it('ska validera anpassade regler', () => {
      const schema: ValidationSchema = {
        custom: {
          password: (value: string) => value.length >= 8,
          role: (value: string) => ['admin', 'user', 'viewer'].includes(value)
        }
      };

      const validData = { password: 'password123', role: 'admin' };
      const invalidData = { password: '123', role: 'invalid' };

      const validResult = testService.testValidateInput(validData, schema);
      const invalidResult = testService.testValidateInput(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Anpassad validering misslyckades för password');
      expect(invalidResult.errors).toContain('Anpassad validering misslyckades för role');
    });

    it('ska hantera ogiltiga inmatningsdata', () => {
      const schema: ValidationSchema = { required: ['name'] };

      const nullResult = testService.testValidateInput(null, schema);
      const stringResult = testService.testValidateInput('string', schema);
      const numberResult = testService.testValidateInput(123, schema);

      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors).toContain('Data måste vara ett objekt');

      expect(stringResult.isValid).toBe(false);
      expect(numberResult.isValid).toBe(false);
    });
  });

  describe('Cache-hantering', () => {
    it('ska generera konsekventa cache-nycklar', () => {
      const key1 = testService.testGetCacheKey('operation', { a: 1, b: 2 });
      const key2 = testService.testGetCacheKey('operation', { b: 2, a: 1 });
      const key3 = testService.testGetCacheKey('operation', { a: 1, b: 3 });

      expect(key1).toBe(key2); // Samma parametrar, olika ordning
      expect(key1).not.toBe(key3); // Olika parametrar
      expect(key1).toContain('TestService.operation');
    });

    it('ska spara och hämta data från cache', () => {
      const key = 'test-key';
      const data = { name: 'Test', value: 123 };

      // Spara i cache
      testService.testSetCache(key, data);

      // Hämta från cache
      const cached = testService.testGetFromCache(key);
      expect(cached).toEqual(data);
    });

    it('ska returnera null för icke-existerande cache-nycklar', () => {
      const cached = testService.testGetFromCache('non-existent-key');
      expect(cached).toBeNull();
    });

    it('ska rensa all cache', () => {
      testService.testSetCache('key1', 'data1');
      testService.testSetCache('key2', 'data2');

      expect(testService.testGetFromCache('key1')).toBe('data1');
      expect(testService.testGetFromCache('key2')).toBe('data2');

      testService.testClearCache();

      expect(testService.testGetFromCache('key1')).toBeNull();
      expect(testService.testGetFromCache('key2')).toBeNull();
    });

    it('ska respektera cache-inställningar', () => {
      const serviceWithoutCache = new TestService({ enableCache: false });
      
      serviceWithoutCache.testSetCache('key', 'data');
      const cached = serviceWithoutCache.testGetFromCache('key');
      
      expect(cached).toBeNull(); // Cache inaktiverad
    });
  });

  describe('Tjänstekonfiguration', () => {
    it('ska använda standardinställningar', () => {
      const service = new TestService();
      expect(service['options'].enableCache).toBe(true);
      expect(service['options'].enableRetry).toBe(true);
      expect(service['options'].enableLogging).toBe(true);
      expect(service['options'].maxRetries).toBe(3);
    });

    it('ska tillåta anpassade inställningar', () => {
      const customOptions = {
        enableCache: false,
        enableRetry: false,
        maxRetries: 5,
        cacheDuration: 10000
      };

      const service = new TestService(customOptions);
      expect(service['options'].enableCache).toBe(false);
      expect(service['options'].enableRetry).toBe(false);
      expect(service['options'].maxRetries).toBe(5);
      expect(service['options'].cacheDuration).toBe(10000);
    });
  });

  describe('GDPR-efterlevnad', () => {
    it('ska markera alla fel som GDPR-kompatibla', () => {
      const error = new Error('Test error');
      const serviceError = testService.testHandleError(error, 'gdprTest');

      expect(serviceError.gdprCompliant).toBe(true);
    });

    it('ska inkludera plattformsinformation för audit trail', () => {
      const error = new Error('Test error');
      const serviceError = testService.testHandleError(error, 'auditTest');

      expect(serviceError.platform).toBeDefined();
      expect(serviceError.timestamp).toBeDefined();
      expect(serviceError.context).toBe('TestService.auditTest');
    });
  });
});
