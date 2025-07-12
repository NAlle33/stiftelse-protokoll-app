/**
 * Test Suite för Centralized Error Handling Utilities
 * 
 * Testar felhanteringsverktyg för GDPR-efterlevnad, svenska meddelanden
 * och konsistent felhantering enligt Code Duplication Elimination-initiativet
 */

import { 
  ErrorHandler, 
  ErrorCode, 
  ServiceError, 
  handleError, 
  getUserFriendlyMessage,
  isRetryable,
  createServiceError,
  errorHandler 
} from '../errorHandling';

// Mock Platform för React Native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios'
  }
}));

// Mock global Sentry
const mockSentry = {
  captureException: jest.fn(),
};
(global as any).Sentry = mockSentry;

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console.error mock
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Classification', () => {
    test('klassificerar nätverksfel korrekt', () => {
      const networkError = new Error('Network request failed');
      const serviceError = handleError(networkError, 'testOperation', 'testService');
      
      expect(serviceError.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(serviceError.message).toContain('Nätverksfel');
      expect(serviceError.retryable).toBe(true);
    });

    test('klassificerar timeout-fel korrekt', () => {
      const timeoutError = new Error('Request timed out');
      const serviceError = handleError(timeoutError, 'testOperation', 'testService');
      
      expect(serviceError.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(serviceError.message).toContain('Timeout');
      expect(serviceError.retryable).toBe(true);
    });

    test('klassificerar Supabase-konfigurationsfel korrekt', () => {
      const configError = new Error('Invalid API key');
      const serviceError = handleError(configError, 'testOperation', 'testService');
      
      expect(serviceError.code).toBe(ErrorCode.SUPABASE_CONFIG_ERROR);
      expect(serviceError.message).toContain('Konfigurationsfel');
      expect(serviceError.retryable).toBe(false);
    });

    test('klassificerar BankID-fel korrekt', () => {
      // Test with a simpler BankID error message first
      const simpleBankidError = new Error('BankID error occurred');
      const simpleServiceError = handleError(simpleBankidError, 'testOperation', 'testService');

      expect(simpleServiceError.code).toBe(ErrorCode.BANKID_ERROR);

      // Test with the original complex message
      const bankidError = new Error('BankID authentication failed');
      const serviceError = handleError(bankidError, 'testOperation', 'testService');

      expect(serviceError.code).toBe(ErrorCode.BANKID_ERROR);
      expect(serviceError.message).toContain('BankID-fel');
    });

    test('klassificerar BankID-avbrott korrekt', () => {
      const cancelledError = new Error('BankID cancelled by user');
      const serviceError = handleError(cancelledError, 'testOperation', 'testService');
      
      expect(serviceError.code).toBe(ErrorCode.BANKID_CANCELLED);
      expect(serviceError.message).toContain('avbruten');
      expect(serviceError.retryable).toBe(false);
    });

    test('klassificerar valideringsfel korrekt', () => {
      const validationError = new Error('Validation failed for input');
      const serviceError = handleError(validationError, 'testOperation', 'testService');
      
      expect(serviceError.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(serviceError.message).toContain('Valideringsfel');
    });

    test('klassificerar okända fel som UNKNOWN_ERROR', () => {
      const unknownError = new Error('Some random error');
      const serviceError = handleError(unknownError, 'testOperation', 'testService');
      
      expect(serviceError.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(serviceError.message).toContain('oväntat fel');
    });
  });

  describe('Swedish Error Messages', () => {
    test('genererar svenska meddelanden för alla feltyper', () => {
      const testCases = [
        { error: new Error('Network failed'), expectedText: 'Nätverksfel' },
        { error: new Error('Request timeout'), expectedText: 'Timeout' },
        { error: new Error('Invalid API key'), expectedText: 'Konfigurationsfel' },
        { error: new Error('Database error'), expectedText: 'Databasfel' },
        { error: new Error('Unauthorized access'), expectedText: 'Autentiseringsfel' },
        { error: new Error('Permission denied'), expectedText: 'Åtkomst nekad' },
        { error: new Error('Validation failed'), expectedText: 'Valideringsfel' },
        { error: new Error('Required field missing'), expectedText: 'Obligatoriskt fält' },
        { error: new Error('File upload failed'), expectedText: 'Filuppladdningsfel' },
        { error: new Error('File too large'), expectedText: 'för stor' },
        { error: new Error('Rate limit exceeded'), expectedText: 'För många förfrågningar' },
      ];

      testCases.forEach(({ error, expectedText }) => {
        const serviceError = handleError(error, 'testOperation');
        expect(serviceError.message).toContain(expectedText);
        expect(serviceError.gdprCompliant).toBe(true);
      });
    });

    test('inkluderar kontext i felmeddelanden', () => {
      const error = new Error('Network failed');
      const serviceError = handleError(error, 'userLogin', 'authService');
      
      expect(serviceError.context).toBe('authService.userLogin');
      expect(serviceError.message).toContain('userLogin');
    });
  });

  describe('GDPR Compliance', () => {
    test('saniterar känslig metadata', () => {
      const sensitiveMetadata = {
        password: 'secret123',
        personnummer: '19901010-1234',
        email: 'test@example.com',
        userId: 'user-123',
        normalField: 'safe-data',
        nested: {
          token: 'secret-token',
          safeData: 'ok'
        }
      };

      const error = new Error('Test error');
      const serviceError = handleError(error, 'testOperation', 'testService', sensitiveMetadata);
      
      expect(serviceError.metadata?.password).toBe('[REDACTED_FOR_GDPR]');
      expect(serviceError.metadata?.personnummer).toBe('[REDACTED_FOR_GDPR]');
      expect(serviceError.metadata?.email).toBe('[REDACTED_FOR_GDPR]');
      expect(serviceError.metadata?.userId).toBe('[REDACTED_FOR_GDPR]');
      expect(serviceError.metadata?.normalField).toBe('safe-data');
      expect(serviceError.metadata?.nested?.token).toBe('[REDACTED_FOR_GDPR]');
      expect(serviceError.metadata?.nested?.safeData).toBe('ok');
    });

    test('markerar alla fel som GDPR-kompatibla', () => {
      const error = new Error('Test error');
      const serviceError = handleError(error, 'testOperation');
      
      expect(serviceError.gdprCompliant).toBe(true);
    });
  });

  describe('Sentry Integration', () => {
    test('rapporterar fel till Sentry med korrekt data', () => {
      const error = new Error('Test error');
      const metadata = { testField: 'testValue' };
      
      handleError(error, 'testOperation', 'testService', metadata);
      
      expect(mockSentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            errorCode: expect.any(String),
            context: 'testService.testOperation',
            platform: 'ios',
            retryable: expect.any(String),
          }),
          extra: expect.objectContaining({
            timestamp: expect.any(String),
            gdprCompliant: true,
            metadata: expect.any(Object),
          }),
          level: expect.any(String),
        })
      );
    });

    test('använder korrekt Sentry-nivå för olika feltyper', () => {
      // Warning-nivå fel
      const validationError = new Error('Validation failed');
      handleError(validationError, 'testOperation');
      
      expect(mockSentry.captureException).toHaveBeenCalledWith(
        validationError,
        expect.objectContaining({ level: 'warning' })
      );

      // Error-nivå fel
      const networkError = new Error('Network failed');
      handleError(networkError, 'testOperation');
      
      expect(mockSentry.captureException).toHaveBeenCalledWith(
        networkError,
        expect.objectContaining({ level: 'error' })
      );
    });
  });

  describe('Retry Logic', () => {
    test('identifierar återförsöksbara fel korrekt', () => {
      const retryableErrors = [
        new Error('Network failed'),
        new Error('Request timeout'),
        new Error('Connection failed'),
        new Error('Service unavailable'),
        new Error('Database error'),
      ];

      retryableErrors.forEach(error => {
        const serviceError = handleError(error, 'testOperation');
        expect(isRetryable(serviceError)).toBe(true);
      });
    });

    test('identifierar icke-återförsöksbara fel korrekt', () => {
      const nonRetryableErrors = [
        new Error('Invalid API key'),
        new Error('Validation failed'),
        new Error('BankID cancelled'),
        new Error('Permission denied'),
      ];

      nonRetryableErrors.forEach(error => {
        const serviceError = handleError(error, 'testOperation');
        expect(isRetryable(serviceError)).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    test('getUserFriendlyMessage returnerar användarmeddelande', () => {
      const error = new Error('Network failed');
      const serviceError = handleError(error, 'testOperation');
      const userMessage = getUserFriendlyMessage(serviceError);
      
      expect(userMessage).toBe(serviceError.message);
      expect(userMessage).toContain('Nätverksfel');
    });

    test('createServiceError skapar ServiceError från Error', () => {
      const error = new Error('Test error');
      const serviceError = createServiceError(error, 'testOperation', ErrorCode.VALIDATION_ERROR);
      
      expect(serviceError.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(serviceError.context).toBe('testOperation');
      expect(serviceError.gdprCompliant).toBe(true);
    });
  });

  describe('Singleton Pattern', () => {
    test('ErrorHandler använder singleton-mönster', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('errorHandler är tillgänglig som global instans', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });
  });

  describe('Platform Integration', () => {
    test('inkluderar plattformsinformation i fel', () => {
      const error = new Error('Test error');
      const serviceError = handleError(error, 'testOperation');
      
      expect(serviceError.platform).toBe('ios');
    });

    test('inkluderar tidsstämpel i fel', () => {
      const error = new Error('Test error');
      const serviceError = handleError(error, 'testOperation');
      
      expect(serviceError.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Error Structure', () => {
    test('ServiceError har korrekt struktur', () => {
      const error = new Error('Test error');
      const serviceError = handleError(error, 'testOperation', 'testService');
      
      expect(serviceError).toHaveProperty('code');
      expect(serviceError).toHaveProperty('message');
      expect(serviceError).toHaveProperty('context');
      expect(serviceError).toHaveProperty('timestamp');
      expect(serviceError).toHaveProperty('platform');
      expect(serviceError).toHaveProperty('gdprCompliant');
      expect(serviceError).toHaveProperty('retryable');
      expect(serviceError).toHaveProperty('userFriendly');
      
      expect(typeof serviceError.code).toBe('string');
      expect(typeof serviceError.message).toBe('string');
      expect(typeof serviceError.context).toBe('string');
      expect(typeof serviceError.timestamp).toBe('string');
      expect(typeof serviceError.platform).toBe('string');
      expect(typeof serviceError.gdprCompliant).toBe('boolean');
      expect(typeof serviceError.retryable).toBe('boolean');
      expect(typeof serviceError.userFriendly).toBe('boolean');
    });
  });
});
