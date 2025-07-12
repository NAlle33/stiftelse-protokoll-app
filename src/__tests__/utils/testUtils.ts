/**
 * Test Utilities for Swedish Board Meeting App
 * Provides common test setup and helper functions
 */

import { jest } from '@jest/globals';
import { setupServiceMocks, resetServiceMocks, setupErrorScenarios, verifyGDPRCompliance } from './mockSetup';

/**
 * Global test setup for service mocks
 * Use this in test files that need service mocking
 */
export const setupTestEnvironment = () => {
  const serviceMocks = setupServiceMocks();
  const errorScenarios = setupErrorScenarios();

  // Setup beforeEach hook for mock reset
  beforeEach(() => {
    resetServiceMocks(serviceMocks);
    jest.clearAllMocks();
  });

  // Setup afterEach hook for cleanup
  afterEach(() => {
    jest.clearAllTimers();
  });

  return {
    ...serviceMocks,
    errorScenarios,
    verifyGDPRCompliance
  };
};

/**
 * Mock Supabase client with Swedish error messages
 */
export const setupSupabaseMock = () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null
      }),
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      }),
      signInWithOAuth: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      }),
      signOut: jest.fn().mockResolvedValue({
        error: null
      })
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'test-id', title: 'Test Data' },
            error: null
          })
        })
      }),
      insert: jest.fn().mockResolvedValue({
        data: { id: 'new-id' },
        error: null
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: { id: 'updated-id' },
          error: null
        })
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      })
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'test-path' },
          error: null
        }),
        download: jest.fn().mockResolvedValue({
          data: new Blob(['test content']),
          error: null
        })
      })
    }
  };

  return mockSupabaseClient;
};

/**
 * Mock React Native components for testing
 */
export const setupReactNativeMocks = () => {
  // Mock AsyncStorage
  const mockAsyncStorage = {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([])
  };

  // Mock Alert
  const mockAlert = {
    alert: jest.fn((title, message, buttons) => {
      if (buttons && buttons.length > 0) {
        // Simulate pressing the first button
        buttons[0].onPress && buttons[0].onPress();
      }
    })
  };

  // Mock Platform
  const mockPlatform = {
    OS: 'web',
    Version: '14.0',
    select: jest.fn((options) => options.web || options.default)
  };

  return {
    AsyncStorage: mockAsyncStorage,
    Alert: mockAlert,
    Platform: mockPlatform
  };
};

/**
 * Mock notifications with Swedish localization
 */
export const setupNotificationsMock = () => {
  const mockNotifications = {
    requestPermissionsAsync: jest.fn().mockResolvedValue({
      status: 'granted',
      granted: true
    }),
    scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
    getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
    dismissAllNotificationsAsync: jest.fn().mockResolvedValue(undefined),
    addNotificationReceivedListener: jest.fn().mockReturnValue({
      remove: jest.fn()
    }),
    addNotificationResponseReceivedListener: jest.fn().mockReturnValue({
      remove: jest.fn()
    })
  };

  return mockNotifications;
};

/**
 * Mock timer utilities for performance tests
 */
export const setupTimerMocks = () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const advanceTimers = (ms: number) => {
    jest.advanceTimersByTime(ms);
  };

  const runAllTimers = () => {
    jest.runAllTimers();
  };

  const runOnlyPendingTimers = () => {
    jest.runOnlyPendingTimers();
  };

  return {
    advanceTimers,
    runAllTimers,
    runOnlyPendingTimers
  };
};

/**
 * Create mock user data with GDPR compliance
 */
export const createMockUser = (overrides = {}) => {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test Användare',
    role: 'styrelseledamot',
    gdpr_consent: true,
    consent_date: new Date().toISOString(),
    anonymized_id: 'anon-***',
    ...overrides
  };
};

/**
 * Create mock meeting data with Swedish localization
 */
export const createMockMeeting = (overrides = {}) => {
  return {
    id: 'test-meeting-id',
    title: 'Styrelsemöte Januari',
    description: 'Månatligt styrelsemöte',
    date: '2024-01-15T10:00:00Z',
    status: 'planerat',
    meeting_type: 'fysiskt',
    participants: [],
    gdpr_compliant: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
};

/**
 * Create mock protocol data with GDPR compliance
 */
export const createMockProtocol = (overrides = {}) => {
  return {
    id: 'test-protocol-id',
    meeting_id: 'test-meeting-id',
    content: 'Protokollinnehåll med GDPR-skydd',
    status: 'utkast',
    version: 1,
    gdpr_compliant: true,
    anonymized_data: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
};

/**
 * Verify Swedish localization in test responses
 */
export const verifySwedishLocalization = (text: string): boolean => {
  const swedishWords = [
    'möte', 'protokoll', 'styrelse', 'användare', 'fel', 'framgång',
    'laddar', 'sparar', 'raderar', 'uppdaterar', 'skapar', 'hämtar'
  ];
  
  return swedishWords.some(word => 
    text.toLowerCase().includes(word.toLowerCase())
  );
};

/**
 * Test helper for async operations with timeout
 */
export const waitForAsync = async (
  fn: () => Promise<any>, 
  timeout = 5000,
  errorMessage = 'Async operation timed out'
) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeout);

    fn()
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

/**
 * Mock error boundary for component testing
 */
export const MockErrorBoundary = ({ children, onError }: any) => {
  try {
    return children;
  } catch (error) {
    onError && onError(error);
    return 'Error occurred';
  }
};

export default {
  setupTestEnvironment,
  setupSupabaseMock,
  setupReactNativeMocks,
  setupNotificationsMock,
  setupTimerMocks,
  createMockUser,
  createMockMeeting,
  createMockProtocol,
  verifySwedishLocalization,
  verifyGDPRCompliance,
  waitForAsync,
  MockErrorBoundary
};
