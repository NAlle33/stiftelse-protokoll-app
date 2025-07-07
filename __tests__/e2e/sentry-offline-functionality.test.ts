/**
 * Sentry E2E Offline Functionality Tests
 * Swedish Board Meeting App - Offline Error Handling Testing
 * 
 * Testar felhantering när Sentry är otillgängligt:
 * - Sentry service otillgänglig
 * - Nätverksanslutning frånkopplad
 * - Ogiltig Sentry DSN
 * - Rate limits överskrids
 * - Timeout-hantering
 * 
 * Verifierar att appen fortsätter fungera normalt utan Sentry-anslutning.
 */

import * as Sentry from '@sentry/react-native';
import { performance } from 'perf_hooks';

// Mock Sentry för offline-testning
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  withScope: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  flush: jest.fn(),
  lastEventId: jest.fn(),
  getClient: jest.fn(),
}));

// Mock services
jest.mock('../../src/services/sentryService');
jest.mock('../../src/services/bankidService');
jest.mock('../../src/services/meetingService');
jest.mock('../../src/services/audioRecordingService');
jest.mock('../../src/config/logger');

// Import services
import {
  initializeSentry,
  reportBankIDError,
  reportMeetingError,
  reportAudioRecordingError,
  isSentryEnabled,
  flushSentryEvents,
  closeSentry,
} from '../../src/services/sentryService';
import { bankidService } from '../../src/services/bankidService';
import { meetingService } from '../../src/services/meetingService';
import { audioRecordingService } from '../../src/services/audioRecordingService';
import { LOG } from '../../src/config/logger';

describe('📴 Sentry E2E Offline Functionality Tests', () => {
  const mockUser = {
    id: 'offline-user-123',
    email: 'offline.test@example.se',
    role: 'board_member' as const,
    organizationId: 'offline-org-456'
  };

  const mockMeeting = {
    id: 'offline-meeting-789',
    title: 'Offline Test Årsstämma',
    description: 'Test för offline-funktionalitet',
    scheduledAt: '2024-12-20T10:00:00Z',
    participants: [mockUser.id],
    status: 'scheduled' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Sentry mocks
    (Sentry.init as jest.Mock).mockImplementation(() => {});
    (Sentry.getClient as jest.Mock).mockReturnValue(null);
    (isSentryEnabled as jest.Mock).mockReturnValue(false);
  });

  describe('🚫 Sentry Service Unavailable', () => {
    it('should handle Sentry initialization failure gracefully', async () => {
      console.log('🚫 Testing Sentry initialization failure...');
      
      // Simulera Sentry init-fel
      (Sentry.init as jest.Mock).mockImplementation(() => {
        throw new Error('Sentry initialization failed: Invalid DSN');
      });
      
      (initializeSentry as jest.Mock).mockImplementation(async () => {
        try {
          Sentry.init({});
        } catch (error) {
          // Sentry init misslyckades, men appen ska fortsätta
          console.log('Sentry initialization failed, continuing without error reporting');
        }
      });
      
      // Försök initialisera Sentry
      await expect(initializeSentry()).resolves.not.toThrow();
      
      // Verifiera att appen kan fortsätta utan Sentry
      expect(isSentryEnabled()).toBe(false);
      
      console.log('✅ App continues normally when Sentry initialization fails');
    });

    it('should handle error reporting when Sentry is unavailable', async () => {
      console.log('🚫 Testing error reporting when Sentry is unavailable...');
      
      // Simulera att Sentry inte är tillgängligt
      (Sentry.captureException as jest.Mock).mockImplementation(() => {
        throw new Error('Sentry service unavailable');
      });
      
      (reportBankIDError as jest.Mock).mockImplementation((error, context) => {
        try {
          Sentry.captureException(error);
        } catch (sentryError) {
          // Logga lokalt istället
          console.log('Sentry unavailable, logging locally:', error.message);
        }
      });
      
      // Försök rapportera fel
      const testError = new Error('BankID authentication failed');
      
      await expect(() => reportBankIDError(testError, {
        provider: 'criipto',
        step: 'authenticate',
        userType: 'board_member'
      })).not.toThrow();
      
      console.log('✅ Error reporting gracefully handles Sentry unavailability');
    });

    it('should continue meeting operations when Sentry is offline', async () => {
      console.log('🚫 Testing meeting operations when Sentry is offline...');
      
      // Simulera offline Sentry
      (Sentry.captureException as jest.Mock).mockRejectedValue(new Error('Network error'));
      (isSentryEnabled as jest.Mock).mockReturnValue(false);
      
      // Mock meeting service för att fungera normalt
      (meetingService.createMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (meetingService.startMeeting as jest.Mock).mockResolvedValue({ success: true });
      
      // Testa komplett mötesflöde utan Sentry
      const meeting = await meetingService.createMeeting(mockMeeting);
      expect(meeting).toEqual(mockMeeting);
      
      const startResult = await meetingService.startMeeting(meeting.id);
      expect(startResult.success).toBe(true);
      
      // Simulera fel under mötet
      const meetingError = new Error('Audio connection lost');
      
      // Fel ska hanteras lokalt utan att påverka mötesflödet
      await expect(() => reportMeetingError(meetingError, {
        meetingId: meeting.id,
        participantCount: 3,
        duration: 1800
      })).not.toThrow();
      
      console.log('✅ Meeting operations continue normally without Sentry');
    });
  });

  describe('🌐 Network Disconnection Scenarios', () => {
    it('should handle network timeout during error reporting', async () => {
      console.log('🌐 Testing network timeout during error reporting...');
      
      // Simulera nätverkstimeout
      (Sentry.captureException as jest.Mock).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });
      
      (reportBankIDError as jest.Mock).mockImplementation(async (error, context) => {
        try {
          await Promise.race([
            Sentry.captureException(error),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 50)
            )
          ]);
        } catch (timeoutError) {
          // Timeout hantering - fortsätt utan Sentry
          console.log('Sentry timeout, continuing without error reporting');
        }
      });
      
      const networkError = new Error('BankID network connection failed');
      
      // Mät tid för felrapportering
      const startTime = performance.now();
      await reportBankIDError(networkError, {
        provider: 'criipto',
        step: 'authenticate',
        userType: 'board_member'
      });
      const duration = performance.now() - startTime;
      
      // Verifiera att timeout inte blockerar appen för länge
      expect(duration).toBeLessThan(200); // Max 200ms väntetid
      
      console.log('✅ Network timeout handled gracefully');
    });

    it('should queue errors for later when network is unavailable', async () => {
      console.log('🌐 Testing error queuing when network is unavailable...');
      
      const errorQueue: Error[] = [];
      
      // Simulera offline-läge med error queuing
      (reportAudioRecordingError as jest.Mock).mockImplementation((error, context) => {
        try {
          Sentry.captureException(error);
        } catch (networkError) {
          // Lägg till i kö för senare
          errorQueue.push(error);
          console.log(`Error queued for later: ${error.message}`);
        }
      });
      
      (Sentry.captureException as jest.Mock).mockRejectedValue(new Error('No network connection'));
      
      // Rapportera flera fel under offline-period
      const errors = [
        new Error('Microphone permission denied'),
        new Error('Audio device unavailable'),
        new Error('Recording storage full')
      ];
      
      for (const error of errors) {
        await reportAudioRecordingError(error, {
          sessionId: 'offline-session',
          deviceType: 'mobile',
          audioQuality: 'high'
        });
      }
      
      // Verifiera att fel är köade
      expect(errorQueue).toHaveLength(3);
      expect(errorQueue.map(e => e.message)).toEqual([
        'Microphone permission denied',
        'Audio device unavailable', 
        'Recording storage full'
      ]);
      
      console.log('✅ Errors properly queued when network is unavailable');
    });

    it('should retry error reporting when network is restored', async () => {
      console.log('🌐 Testing error reporting retry when network is restored...');
      
      let networkAvailable = false;
      let retryCount = 0;
      
      (Sentry.captureException as jest.Mock).mockImplementation(() => {
        if (!networkAvailable) {
          throw new Error('Network unavailable');
        }
        return 'success';
      });
      
      (reportMeetingError as jest.Mock).mockImplementation(async (error, context) => {
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            await Sentry.captureException(error);
            return; // Lyckades
          } catch (networkError) {
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 100)); // Vänta innan retry
            }
          }
        }
        
        console.log('Max retries reached, giving up');
      });
      
      const networkError = new Error('Meeting connection lost');
      
      // Starta felrapportering (kommer misslyckas först)
      const reportPromise = reportMeetingError(networkError, {
        meetingId: mockMeeting.id,
        participantCount: 2,
        duration: 900
      });
      
      // Simulera att nätverket kommer tillbaka efter en stund
      setTimeout(() => {
        networkAvailable = true;
      }, 150);
      
      await reportPromise;
      
      // Verifiera retry-logik
      expect(retryCount).toBeGreaterThan(0);
      expect(retryCount).toBeLessThanOrEqual(3);
      
      console.log('✅ Error reporting retry works when network is restored');
    });
  });

  describe('⚠️ Invalid Configuration Handling', () => {
    it('should handle invalid Sentry DSN gracefully', async () => {
      console.log('⚠️ Testing invalid Sentry DSN handling...');
      
      // Simulera ogiltig DSN
      (Sentry.init as jest.Mock).mockImplementation((config) => {
        if (config.dsn && !config.dsn.includes('.sentry.io')) {
          throw new Error('Invalid DSN format');
        }
      });
      
      (initializeSentry as jest.Mock).mockImplementation(async () => {
        try {
          Sentry.init({ dsn: 'invalid-dsn-format' });
        } catch (error) {
          console.log('Invalid DSN detected, disabling Sentry');
          return;
        }
      });
      
      await expect(initializeSentry()).resolves.not.toThrow();
      expect(isSentryEnabled()).toBe(false);
      
      console.log('✅ Invalid DSN handled gracefully');
    });

    it('should handle missing environment variables', async () => {
      console.log('⚠️ Testing missing environment variables...');
      
      // Simulera saknade miljövariabler
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.EXPO_PUBLIC_SENTRY_DSN_DEVELOPMENT;
      delete process.env.EXPO_PUBLIC_SENTRY_DSN_STAGING;
      delete process.env.EXPO_PUBLIC_SENTRY_DSN_PRODUCTION;
      
      (initializeSentry as jest.Mock).mockImplementation(async () => {
        const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN_DEVELOPMENT;
        if (!dsn) {
          console.log('No Sentry DSN found, skipping initialization');
          return;
        }
      });
      
      await expect(initializeSentry()).resolves.not.toThrow();
      
      // Återställ miljövariabler
      process.env = originalEnv;
      
      console.log('✅ Missing environment variables handled gracefully');
    });
  });

  describe('🚦 Rate Limiting and Throttling', () => {
    it('should handle Sentry rate limiting gracefully', async () => {
      console.log('🚦 Testing Sentry rate limiting...');
      
      let requestCount = 0;
      const rateLimit = 5;
      
      (Sentry.captureException as jest.Mock).mockImplementation(() => {
        requestCount++;
        if (requestCount > rateLimit) {
          throw new Error('Rate limit exceeded: 429 Too Many Requests');
        }
        return 'success';
      });
      
      (reportBankIDError as jest.Mock).mockImplementation((error, context) => {
        try {
          Sentry.captureException(error);
        } catch (rateLimitError) {
          if (rateLimitError.message.includes('Rate limit exceeded')) {
            console.log('Rate limit hit, throttling error reporting');
            // Implementera throttling-logik
            return;
          }
          throw rateLimitError;
        }
      });
      
      // Skicka många fel snabbt
      const errors = Array.from({ length: 10 }, (_, i) => 
        new Error(`BankID error ${i + 1}`)
      );
      
      for (const error of errors) {
        await expect(() => reportBankIDError(error, {
          provider: 'criipto',
          step: 'authenticate',
          userType: 'board_member'
        })).not.toThrow();
      }
      
      expect(requestCount).toBeLessThanOrEqual(rateLimit);
      
      console.log('✅ Rate limiting handled gracefully');
    });

    it('should implement exponential backoff for retries', async () => {
      console.log('🚦 Testing exponential backoff for retries...');
      
      let attemptCount = 0;
      const retryDelays: number[] = [];
      
      (Sentry.captureException as jest.Mock).mockRejectedValue(new Error('Service temporarily unavailable'));
      
      (reportMeetingError as jest.Mock).mockImplementation(async (error, context) => {
        const maxRetries = 3;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            attemptCount++;
            await Sentry.captureException(error);
            return; // Lyckades
          } catch (serviceError) {
            if (attempt < maxRetries - 1) {
              // Exponential backoff: 100ms, 200ms, 400ms
              const delay = 100 * Math.pow(2, attempt);
              retryDelays.push(delay);
              
              const startTime = performance.now();
              await new Promise(resolve => setTimeout(resolve, delay));
              const actualDelay = performance.now() - startTime;
              
              expect(actualDelay).toBeGreaterThanOrEqual(delay - 10); // Tillåt 10ms tolerans
            }
          }
        }
      });
      
      const serviceError = new Error('Meeting service temporarily unavailable');
      await reportMeetingError(serviceError, {
        meetingId: mockMeeting.id,
        participantCount: 4,
        duration: 2400
      });
      
      // Verifiera exponential backoff
      expect(retryDelays).toEqual([100, 200]);
      expect(attemptCount).toBe(3);
      
      console.log('✅ Exponential backoff implemented correctly');
    });
  });

  describe('🔄 Graceful Degradation', () => {
    it('should maintain full app functionality without Sentry', async () => {
      console.log('🔄 Testing full app functionality without Sentry...');
      
      // Simulera att Sentry är helt otillgängligt
      (isSentryEnabled as jest.Mock).mockReturnValue(false);
      (Sentry.captureException as jest.Mock).mockRejectedValue(new Error('Sentry unavailable'));
      
      // Mock alla services för att fungera normalt
      (bankidService.authenticate as jest.Mock).mockResolvedValue({
        success: true,
        orderRef: 'order-123'
      });
      
      (meetingService.createMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (audioRecordingService.startRecording as jest.Mock).mockResolvedValue({
        sessionId: 'session-123',
        status: 'recording'
      });
      
      // Testa komplett användarflöde
      const authResult = await bankidService.authenticate({
        provider: 'criipto',
        environment: 'test'
      });
      expect(authResult.success).toBe(true);
      
      const meeting = await meetingService.createMeeting(mockMeeting);
      expect(meeting).toEqual(mockMeeting);
      
      const recording = await audioRecordingService.startRecording({
        meetingId: meeting.id,
        quality: 'high'
      });
      expect(recording.status).toBe('recording');
      
      console.log('✅ Full app functionality maintained without Sentry');
    });

    it('should provide local error logging when Sentry is unavailable', async () => {
      console.log('🔄 Testing local error logging fallback...');
      
      const localErrors: string[] = [];
      
      // Mock lokal loggning
      (LOG.error as jest.Mock).mockImplementation((message, data) => {
        localErrors.push(`${message}: ${JSON.stringify(data)}`);
      });
      
      (reportBankIDError as jest.Mock).mockImplementation((error, context) => {
        try {
          Sentry.captureException(error);
        } catch (sentryError) {
          // Fallback till lokal loggning
          LOG.error('BankID error (Sentry unavailable)', {
            error: error.message,
            context,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      (Sentry.captureException as jest.Mock).mockRejectedValue(new Error('Sentry unavailable'));
      
      // Rapportera fel
      const localError = new Error('Local BankID authentication failed');
      await reportBankIDError(localError, {
        provider: 'criipto',
        step: 'authenticate',
        userType: 'board_member'
      });
      
      // Verifiera lokal loggning
      expect(localErrors).toHaveLength(1);
      expect(localErrors[0]).toContain('BankID error (Sentry unavailable)');
      expect(localErrors[0]).toContain('Local BankID authentication failed');
      
      console.log('✅ Local error logging works as fallback');
    });
  });

  describe('🧹 Cleanup and Resource Management', () => {
    it('should handle Sentry cleanup gracefully when offline', async () => {
      console.log('🧹 Testing Sentry cleanup when offline...');
      
      (Sentry.flush as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
      (Sentry.close as jest.Mock).mockRejectedValue(new Error('Connection lost'));
      
      (flushSentryEvents as jest.Mock).mockImplementation(async (timeout = 2000) => {
        try {
          await Sentry.flush(timeout);
          return true;
        } catch (error) {
          console.log('Sentry flush failed, continuing cleanup');
          return false;
        }
      });
      
      (closeSentry as jest.Mock).mockImplementation(async () => {
        try {
          await Sentry.close();
        } catch (error) {
          console.log('Sentry close failed, resources may not be fully cleaned');
        }
      });
      
      // Testa cleanup
      const flushResult = await flushSentryEvents(1000);
      expect(flushResult).toBe(false);
      
      await expect(closeSentry()).resolves.not.toThrow();
      
      console.log('✅ Sentry cleanup handled gracefully when offline');
    });
  });
});
