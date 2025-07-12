/**
 * Test Suite för Centralized Retry Utilities
 * 
 * Testar återförsökslogik för konsistent hantering av tillfälliga fel
 * enligt Code Duplication Elimination-initiativet
 */

import { 
  RetryHandler, 
  withRetry, 
  withRetryResult,
  createRetryWrapper,
  retryOperations,
  RETRY_CONFIGS,
  DEFAULT_RETRY_CONFIG,
  retryHandler 
} from '../retryUtilities';

// Mock för error handling
jest.mock('../errorHandling', () => ({
  handleError: jest.fn((error, context, serviceName, metadata) => ({
    code: 'NETWORK_ERROR',
    message: `Nätverksfel i ${context}`,
    context: serviceName ? `${serviceName}.${context}` : context,
    timestamp: new Date().toISOString(),
    platform: 'ios',
    gdprCompliant: true,
    retryable: true,
    userFriendly: true,
    metadata,
  })),
  isRetryable: jest.fn(() => true),
}));

describe('RetryHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Retry Logic', () => {
    test('lyckas på första försöket', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(mockOperation, 'testOperation');
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('försöker igen vid fel och lyckas på andra försöket', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('success');
      
      const result = await withRetry(mockOperation, 'testOperation');
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    test('misslyckas efter max antal försök', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Persistent error'));
      
      await expect(withRetry(mockOperation, 'testOperation', { maxRetries: 2 }))
        .rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    test('använder standardkonfiguration när ingen anges', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Error'));
      
      await expect(withRetry(mockOperation, 'testOperation')).rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxRetries + 1);
    });
  });

  describe('Retry Configuration', () => {
    test('respekterar anpassad maxRetries', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Error'));
      const customConfig = { maxRetries: 1 };
      
      await expect(withRetry(mockOperation, 'testOperation', customConfig))
        .rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    });

    test('använder förkonfigurerade inställningar för kritiska operationer', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Error'));
      
      await expect(retryOperations.critical(mockOperation, 'criticalOperation'))
        .rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(RETRY_CONFIGS.CRITICAL.maxRetries + 1);
    });

    test('använder förkonfigurerade inställningar för nätverksoperationer', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(retryOperations.network(mockOperation, 'networkOperation'))
        .rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(RETRY_CONFIGS.NETWORK.maxRetries + 1);
    });

    test('använder förkonfigurerade inställningar för databasoperationer', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await expect(retryOperations.database(mockOperation, 'databaseOperation'))
        .rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(RETRY_CONFIGS.DATABASE.maxRetries + 1);
    });
  });

  describe('Retry Conditions', () => {
    test('respekterar anpassade retry-villkor', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('User cancelled'));
      const config = {
        maxRetries: 3,
        retryCondition: (error: Error) => !error.message.includes('cancelled')
      };
      
      await expect(withRetry(mockOperation, 'testOperation', config))
        .rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(1); // Ingen retry på grund av villkor
    });

    test('BankID-konfiguration stoppar retry vid avbrott', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('BankID cancelled'));
      
      await expect(retryOperations.bankid(mockOperation, 'bankidOperation'))
        .rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(1); // Ingen retry vid avbrott
    });
  });

  describe('Delay Calculation', () => {
    test('väntar mellan försök', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await withRetry(mockOperation, 'testOperation', { baseDelay: 100 });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThan(90); // Minst 100ms minus tolerans
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    test('använder exponentiell backoff', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = jest.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Kör omedelbart för test
      }) as any;
      
      const mockOperation = jest.fn().mockRejectedValue(new Error('Error'));
      
      await expect(withRetry(mockOperation, 'testOperation', { 
        maxRetries: 2, 
        baseDelay: 100, 
        backoffMultiplier: 2,
        jitter: false 
      })).rejects.toThrow();
      
      expect(delays).toHaveLength(2);
      expect(delays[0]).toBe(100); // Första retry: 100ms
      expect(delays[1]).toBe(200); // Andra retry: 200ms
      
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('withRetryResult', () => {
    test('returnerar success-objekt vid lyckad operation', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await withRetryResult(mockOperation, 'testOperation');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    test('returnerar error-objekt vid misslyckad operation', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Error'));
      
      const result = await withRetryResult(mockOperation, 'testOperation', { maxRetries: 1 });
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.attempts).toBe(2); // 1 initial + 1 retry
      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.error).toBeDefined();
    });
  });

  describe('createRetryWrapper', () => {
    test('skapar wrapper-funktion som behåller originalfunktionens signatur', async () => {
      const originalFunction = jest.fn().mockResolvedValue('result');
      const wrappedFunction = createRetryWrapper(
        originalFunction, 
        'wrappedOperation',
        { maxRetries: 2 }
      );
      
      const result = await wrappedFunction('arg1', 'arg2');
      
      expect(result).toBe('result');
      expect(originalFunction).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('wrapper-funktion försöker igen vid fel', async () => {
      const originalFunction = jest.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');
      
      const wrappedFunction = createRetryWrapper(
        originalFunction, 
        'wrappedOperation'
      );
      
      const result = await wrappedFunction();
      
      expect(result).toBe('success');
      expect(originalFunction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Singleton Pattern', () => {
    test('RetryHandler använder singleton-mönster', () => {
      const instance1 = RetryHandler.getInstance();
      const instance2 = RetryHandler.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('retryHandler är tillgänglig som global instans', () => {
      expect(retryHandler).toBeInstanceOf(RetryHandler);
    });
  });

  describe('Logging', () => {
    test('loggar försök och resultat', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');
      
      await withRetry(mockOperation, 'testOperation');
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('testOperation - Försök 1/')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('testOperation - Försök 2/')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('testOperation lyckades efter 2 försök')
      );
    });

    test('loggar slutgiltigt fel efter alla försök', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Persistent error'));
      
      await expect(withRetry(mockOperation, 'testOperation', { maxRetries: 1 }))
        .rejects.toThrow();
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('testOperation misslyckades efter 2 försök')
      );
    });
  });

  describe('Error Integration', () => {
    test('integrerar med error handling system', async () => {
      const { handleError } = require('../errorHandling');
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(withRetry(mockOperation, 'testOperation', { maxRetries: 0 }))
        .rejects.toThrow();
      
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'testOperation',
        undefined,
        expect.objectContaining({
          attempts: 1,
          totalTime: expect.any(Number),
          config: expect.any(Object),
        })
      );
    });
  });
});
