/**
 * Sentry E2E Error Reporting Scenario Tests
 * Swedish Board Meeting App - End-to-End Error Reporting Testing
 * 
 * Testar felrapporteringsscenarier i realistiska användarflöden:
 * - BankID autentiseringsfel under mötesflöde
 * - Ljudinspelningsfel under mötesinspelning
 * - Protokollgenereringsfel efter lyckad transkribering
 * - Nätverksfel under kritiska operationer
 * 
 * GDPR-efterlevnad och svensk lokalisering genomgående.
 */

import * as Sentry from '@sentry/react-native';
import { performance } from 'perf_hooks';

// Mock Sentry för kontrollerad testning
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  withScope: jest.fn((callback) => callback({
    setTag: jest.fn(),
    setLevel: jest.fn(),
    setContext: jest.fn(),
  })),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
  lastEventId: jest.fn().mockReturnValue('test-event-id'),
}));

// Mock services för E2E-testning
jest.mock('../../src/services/bankidService');
jest.mock('../../src/services/audioRecordingService');
jest.mock('../../src/services/aiProtocolService');
jest.mock('../../src/services/meetingService');
jest.mock('../../src/services/sentryService');

// Import services
import { bankidService } from '../../src/services/bankidService';
import { audioRecordingService } from '../../src/services/audioRecordingService';
import { aiProtocolService } from '../../src/services/aiProtocolService';
import { meetingService } from '../../src/services/meetingService';
import {
  initializeSentry,
  reportBankIDError,
  reportAudioRecordingError,
  reportAzureOpenAIError,
  isSentryEnabled,
} from '../../src/services/sentryService';

describe('🎯 Sentry E2E Error Reporting Scenarios', () => {
  const mockUser = {
    id: 'e2e-user-123',
    email: 'test.user@example.se',
    role: 'board_member' as const,
    organizationId: 'e2e-org-456'
  };

  const mockMeeting = {
    id: 'e2e-meeting-789',
    title: 'E2E Test Årsstämma',
    description: 'End-to-end test för felrapportering',
    scheduledAt: '2024-12-20T10:00:00Z',
    participants: [mockUser.id],
    status: 'scheduled' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Sentry mocks
    (Sentry.init as jest.Mock).mockImplementation(() => {});
    (Sentry.captureException as jest.Mock).mockImplementation(() => 'test-event-id');
    (Sentry.captureMessage as jest.Mock).mockImplementation(() => 'test-event-id');
    (Sentry.flush as jest.Mock).mockResolvedValue(true);
    
    // Setup service mocks
    (initializeSentry as jest.Mock).mockResolvedValue(undefined);
    (isSentryEnabled as jest.Mock).mockReturnValue(true);
  });

  describe('🏦 BankID Authentication Error Scenarios', () => {
    it('should report BankID timeout error during meeting join flow', async () => {
      console.log('🔐 Testing BankID timeout error during meeting join...');
      
      // Simulera BankID timeout under mötesanslutning
      const bankidError = new Error('BankID timeout - användaren svarade inte inom tidsgränsen');
      (bankidService.authenticate as jest.Mock).mockRejectedValue(bankidError);
      
      // Simulera komplett användarflöde: försök gå med i möte
      try {
        // Steg 1: Användaren försöker gå med i möte
        await bankidService.authenticate({
          provider: 'criipto',
          environment: 'test',
          returnUrl: 'https://app.example.se/meeting/join'
        });
        
        fail('BankID authentication should have failed');
      } catch (error) {
        // Steg 2: Verifiera att fel rapporteras till Sentry
        expect(reportBankIDError).toHaveBeenCalledWith(
          bankidError,
          expect.objectContaining({
            provider: 'criipto',
            step: 'authenticate',
            userType: 'board_member'
          })
        );
        
        // Steg 3: Verifiera Sentry-rapportering
        expect(Sentry.withScope).toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalledWith(bankidError);
      }
      
      console.log('✅ BankID timeout error correctly reported to Sentry');
    });

    it('should report BankID cancellation during protocol signing flow', async () => {
      console.log('🔐 Testing BankID cancellation during protocol signing...');
      
      const cancellationError = new Error('BankID-processen avbröts av användaren');
      (bankidService.signDocument as jest.Mock).mockRejectedValue(cancellationError);
      
      // Simulera protokollsigneringsflöde
      try {
        await bankidService.signDocument({
          documentId: 'protocol-123',
          documentHash: 'sha256-hash',
          signerInfo: {
            name: 'Test Användare',
            role: 'Ordförande'
          }
        });
        
        fail('BankID signing should have been cancelled');
      } catch (error) {
        expect(reportBankIDError).toHaveBeenCalledWith(
          cancellationError,
          expect.objectContaining({
            provider: 'criipto',
            step: 'sign_document',
            userType: 'board_member'
          })
        );
      }
      
      console.log('✅ BankID cancellation error correctly reported');
    });

    it('should report Criipto API error with retry attempts', async () => {
      console.log('🔐 Testing Criipto API error with retry logic...');
      
      const apiError = new Error('Criipto API temporarily unavailable');
      (bankidService.authenticate as jest.Mock)
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(apiError)
        .mockResolvedValue({ success: true, orderRef: 'order-123' });
      
      // Simulera retry-logik
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await bankidService.authenticate({
            provider: 'criipto',
            environment: 'test'
          });
          break;
        } catch (error) {
          retryCount++;
          if (retryCount < maxRetries) {
            // Rapportera retry-försök
            expect(reportBankIDError).toHaveBeenCalledWith(
              apiError,
              expect.objectContaining({
                provider: 'criipto',
                step: 'authenticate',
                retryAttempt: retryCount
              })
            );
          }
        }
      }
      
      console.log('✅ Criipto API error with retries correctly reported');
    });
  });

  describe('🎤 Audio Recording Error Scenarios', () => {
    it('should report microphone permission denied during meeting recording', async () => {
      console.log('🎤 Testing microphone permission denied error...');
      
      const permissionError = new Error('Mikrofonåtkomst nekad av användaren');
      (audioRecordingService.startRecording as jest.Mock).mockRejectedValue(permissionError);
      
      // Simulera mötesflöde med ljudinspelning
      try {
        // Steg 1: Användaren startar möte
        const meeting = await meetingService.createMeeting(mockMeeting);
        
        // Steg 2: Försök starta ljudinspelning
        await audioRecordingService.startRecording({
          meetingId: meeting.id,
          quality: 'high',
          format: 'wav'
        });
        
        fail('Audio recording should have failed due to permission');
      } catch (error) {
        // Steg 3: Verifiera felrapportering
        expect(reportAudioRecordingError).toHaveBeenCalledWith(
          permissionError,
          expect.objectContaining({
            sessionId: expect.any(String),
            deviceType: expect.any(String),
            audioQuality: 'high'
          })
        );
      }
      
      console.log('✅ Microphone permission error correctly reported');
    });

    it('should report audio device unavailable during long recording', async () => {
      console.log('🎤 Testing audio device unavailable during long recording...');
      
      // Simulera långvarig inspelning som misslyckas
      const deviceError = new Error('Ljudenhet blev otillgänglig under inspelning');
      
      // Mock lyckad start men misslyckad fortsättning
      (audioRecordingService.startRecording as jest.Mock).mockResolvedValue({
        sessionId: 'audio-session-123',
        status: 'recording'
      });
      
      (audioRecordingService.stopRecording as jest.Mock).mockRejectedValue(deviceError);
      
      try {
        // Starta inspelning
        const session = await audioRecordingService.startRecording({
          meetingId: mockMeeting.id,
          quality: 'high'
        });
        
        // Simulera lång inspelning (30 minuter)
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulerad tid
        
        // Försök stoppa inspelning
        await audioRecordingService.stopRecording(session.sessionId);
        
        fail('Audio recording stop should have failed');
      } catch (error) {
        expect(reportAudioRecordingError).toHaveBeenCalledWith(
          deviceError,
          expect.objectContaining({
            sessionId: 'audio-session-123',
            duration: expect.any(Number),
            deviceType: expect.any(String)
          })
        );
      }
      
      console.log('✅ Audio device unavailable error correctly reported');
    });
  });

  describe('🤖 AI Protocol Generation Error Scenarios', () => {
    it('should report Azure OpenAI timeout during protocol generation', async () => {
      console.log('🤖 Testing Azure OpenAI timeout during protocol generation...');
      
      const aiTimeoutError = new Error('Azure OpenAI request timeout efter 60 sekunder');
      (aiProtocolService.generateProtocol as jest.Mock).mockRejectedValue(aiTimeoutError);
      
      // Simulera komplett protokollgenereringsflöde
      const transcriptionData = {
        text: 'Mötet öppnas av ordföranden. Närvarande: Test Användare, Anna Andersson...',
        confidence: 0.95,
        duration: 3600, // 1 timme
        language: 'sv-SE'
      };
      
      try {
        await aiProtocolService.generateProtocol({
          transcription: transcriptionData,
          meetingInfo: mockMeeting,
          template: 'annual_meeting'
        });
        
        fail('Protocol generation should have timed out');
      } catch (error) {
        expect(reportAzureOpenAIError).toHaveBeenCalledWith(
          aiTimeoutError,
          expect.objectContaining({
            service: 'openai',
            operation: 'generate_protocol',
            modelName: expect.any(String),
            tokenCount: expect.any(Number)
          })
        );
      }
      
      console.log('✅ Azure OpenAI timeout error correctly reported');
    });

    it('should report rate limit exceeded during peak usage', async () => {
      console.log('🤖 Testing Azure OpenAI rate limit during peak usage...');
      
      const rateLimitError = new Error('Rate limit exceeded: 60 requests per minute');
      (aiProtocolService.generateProtocol as jest.Mock).mockRejectedValue(rateLimitError);
      
      // Simulera flera samtidiga protokollgenereringar
      const promises = Array.from({ length: 5 }, async (_, index) => {
        try {
          await aiProtocolService.generateProtocol({
            transcription: { text: `Möte ${index + 1}`, confidence: 0.9 },
            meetingInfo: { ...mockMeeting, id: `meeting-${index + 1}` },
            template: 'board_meeting'
          });
        } catch (error) {
          // Förväntat fel
          return error;
        }
      });
      
      const results = await Promise.allSettled(promises);
      const failures = results.filter(result => result.status === 'fulfilled' && result.value instanceof Error);
      
      expect(failures.length).toBeGreaterThan(0);
      expect(reportAzureOpenAIError).toHaveBeenCalled();
      
      console.log('✅ Azure OpenAI rate limit error correctly reported');
    });
  });

  describe('🌐 Network Error Scenarios', () => {
    it('should handle network disconnection during critical operations', async () => {
      console.log('🌐 Testing network disconnection during critical operations...');
      
      const networkError = new Error('Network request failed: NETWORK_ERROR');
      
      // Simulera nätverksfel under olika operationer
      (meetingService.saveMeeting as jest.Mock).mockRejectedValue(networkError);
      (audioRecordingService.uploadRecording as jest.Mock).mockRejectedValue(networkError);
      
      // Test 1: Nätverksfel under mötessparning
      try {
        await meetingService.saveMeeting(mockMeeting);
        fail('Meeting save should have failed due to network error');
      } catch (error) {
        expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
      }
      
      // Test 2: Nätverksfel under ljuduppladdning
      try {
        await audioRecordingService.uploadRecording({
          sessionId: 'session-123',
          filePath: '/tmp/recording.wav',
          meetingId: mockMeeting.id
        });
        fail('Audio upload should have failed due to network error');
      } catch (error) {
        expect(reportAudioRecordingError).toHaveBeenCalled();
      }
      
      console.log('✅ Network errors correctly reported to Sentry');
    });
  });

  describe('📊 Error Reporting Verification', () => {
    it('should verify all errors are properly tagged and contextualized', async () => {
      console.log('📊 Verifying error tagging and contextualization...');
      
      const testError = new Error('Test error för verifiering');
      
      // Rapportera fel med olika kontexter
      reportBankIDError(testError, {
        provider: 'criipto',
        step: 'authenticate',
        userType: 'board_member'
      });
      
      reportAudioRecordingError(testError, {
        sessionId: 'test-session',
        duration: 1800,
        deviceType: 'mobile',
        audioQuality: 'high'
      });
      
      // Verifiera att Sentry.withScope anropades för varje fel
      expect(Sentry.withScope).toHaveBeenCalledTimes(2);
      expect(Sentry.captureException).toHaveBeenCalledTimes(2);
      
      console.log('✅ All errors properly tagged and contextualized');
    });

    it('should verify Swedish localization in error contexts', async () => {
      console.log('🇸🇪 Verifying Swedish localization in error contexts...');
      
      const swedishError = new Error('Fel vid anslutning till BankID-tjänsten');
      
      reportBankIDError(swedishError, {
        provider: 'criipto',
        step: 'authenticate',
        userType: 'styrelseledamot'
      });
      
      // Verifiera att svenska taggar används
      const scopeMock = {
        setTag: jest.fn(),
        setLevel: jest.fn(),
        setContext: jest.fn(),
      };
      
      (Sentry.withScope as jest.Mock).mockImplementation((callback) => callback(scopeMock));
      
      reportBankIDError(swedishError, {
        provider: 'criipto',
        step: 'authenticate',
        userType: 'styrelseledamot'
      });
      
      expect(scopeMock.setTag).toHaveBeenCalledWith('country', 'SE');
      expect(scopeMock.setTag).toHaveBeenCalledWith('language', 'sv');
      
      console.log('✅ Swedish localization verified in error contexts');
    });
  });
});
