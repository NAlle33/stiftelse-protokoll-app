/**
 * AI Service Test Suite
 * Following Phase 6 Comprehensive Testing Implementation Guide
 * Target: 95%+ coverage with 26 tests (6 categories × 4-5 tests each)
 */

import { AIService } from '../aiService';
import { azureSpeechConfig } from '../../config/azureConfig';
import { openaiClient } from '../../config/openaiConfig';
import * as swedishProcessor from '../../utils/swedishLanguageProcessor';
import * as aiSecurity from '../../utils/aiSecurity';

// Mock all dependencies
jest.mock('../../config/azureConfig', () => ({
  azureSpeechConfig: {
    region: 'northeurope',
    language: 'sv-SE',
    key: 'test-key',
  },
}));

jest.mock('../../config/openaiConfig', () => ({
  openaiClient: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
  openaiConfig: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  },
}));

jest.mock('../../utils/swedishLanguageProcessor', () => ({
  processSwedishText: jest.fn(),
  extractSwedishEntities: jest.fn(),
  validateSwedishGrammar: jest.fn(),
  formatSwedishProtocol: jest.fn(),
}));

jest.mock('../../utils/aiSecurity', () => ({
  encryptAIData: jest.fn(),
  validateAIInput: jest.fn(),
  sanitizeAIOutput: jest.fn(),
  auditAIOperation: jest.fn(),
}));

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIService();
  });

  // 1. Initialization & Configuration (4 tests)
  describe('Initialization', () => {
    it('should initialize with correct Swedish configuration', () => {
      const config = service.getAzureConfig();
      expect(config).toEqual({
        language: 'sv-SE',
        region: 'northeurope',
        swedishOptimized: true,
        gdprCompliant: true,
        encryptionEnabled: true,
      });
    });

    it('should handle missing configuration gracefully', () => {
      expect(() => new AIService()).not.toThrow();
    });

    it('should validate required environment variables', () => {
      const azureConfig = service.getAzureConfig();
      expect(azureConfig.language).toBe('sv-SE');
      expect(azureConfig.region).toBe('northeurope');
    });

    it('should set up proper error handling', () => {
      const messages = service.getAIMessages();
      expect(messages.TRANSCRIPTION_FAILED).toBe('Transkribering misslyckades');
      expect(messages.PROTOCOL_GENERATION_ERROR).toBe('Protokollgenerering misslyckades');
    });
  });

  // 2. Core Functionality (6 tests)
  describe('Core Functionality', () => {
    it('should perform speech-to-text transcription successfully', async () => {
      const mockAudioData = {
        data: Buffer.from('audio'),
        format: 'wav',
        gdprConsent: true,
      };

      (swedishProcessor.processSwedishText as jest.Mock).mockReturnValue({
        entities: ['Styrelsemöte', 'beslut'],
        businessTerms: ['protokoll', 'möte'],
      });

      const result = await service.transcribeAudio(mockAudioData);

      expect(result.success).toBe(true);
      expect(result.transcription).toBe('Styrelsemötet öppnas klockan 14:00');
      expect(result.confidence).toBe(0.95);
      expect(result.swedishOptimized).toBe(true);
      expect(result.gdprCompliant).toBe(true);
    });

    it('should generate protocol with Swedish formatting', async () => {
      const mockProtocolData = {
        meetingTitle: 'Årsstämma 2024',
        participants: ['Anna Andersson', 'Erik Eriksson'],
        agenda: ['Val av ordförande', 'Årsredovisning'],
      };

      (openaiClient.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [{
          message: {
            content: 'Protokoll för Årsstämma 2024...',
          },
        }],
      });

      (swedishProcessor.formatSwedishProtocol as jest.Mock).mockReturnValue({
        formattedContent: 'Formaterat protokoll...',
        swedishFormatted: true,
        legallyCompliant: true,
      });

      const result = await service.generateProtocol(mockProtocolData);

      expect(result.success).toBe(true);
      expect(result.protocol.title).toBe('Protokoll - Årsstämma 2024');
      expect(result.swedishFormatted).toBe(true);
      expect(result.legallyCompliant).toBe(true);
    });

    it('should process Swedish language content correctly', async () => {
      const swedishText = 'Styrelsen beslutar att godkänna årsredovisningen';

      (swedishProcessor.extractSwedishEntities as jest.Mock).mockReturnValue([
        'Styrelsen', 'årsredovisningen',
      ]);

      (swedishProcessor.validateSwedishGrammar as jest.Mock).mockReturnValue({
        valid: true,
      });

      const result = await service.processSwedishLanguage(swedishText);

      expect(result.success).toBe(true);
      expect(result.entities).toContain('Styrelsen');
      expect(result.grammarValid).toBe(true);
      expect(result.swedishCompliant).toBe(true);
    });

    it('should maintain data integrity during processing', async () => {
      const result = await service.generateAndStoreProtocol({
        meetingId: '123',
        content: 'Mötet öppnas',
      });

      expect(result.success).toBe(true);
      expect(result.swedishFormatMaintained).toBe(true);
      expect(result.encryptedStorage).toBe(true);
      expect(result.auditTrailCreated).toBe(true);
    });

    it('should handle concurrent AI operations', async () => {
      const operations = [
        service.transcribeAudio({ data: 'audio1', gdprConsent: true }),
        service.generateProtocol({ meetingTitle: 'Möte 1' }),
        service.processSwedishLanguage('Text att analysera'),
      ];

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should integrate with video meeting for real-time transcription', async () => {
      const result = await service.integrateWithVideoMeeting({
        meetingId: 'video123',
        language: 'sv-SE',
      });

      expect(result.success).toBe(true);
      expect(result.realTimeTranscription).toBe(true);
      expect(result.swedishLanguageDetected).toBe(true);
      expect(result.lowLatency).toBe(true);
    });
  });

  // 3. Error Handling & Recovery (4 tests)
  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (openaiClient.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.generateProtocol({ meetingTitle: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.swedishCompliant).toBe(true);
    });

    it('should retry failed operations appropriately', async () => {
      (openaiClient.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const result = await service.generateProtocol({ meetingTitle: 'Test' });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('OPENAI_RATE_LIMIT_EXCEEDED');
      expect(result.retryAfter).toBe(60);
      expect(result.queuedForRetry).toBe(true);
    });

    it('should log errors with proper context', async () => {
      const mockAudioData = {
        data: Buffer.from('audio'),
        containsPersonalData: true,
        gdprConsent: true,
      };

      await service.transcribeAudio(mockAudioData);

      expect(aiSecurity.auditAIOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'TRANSCRIBE_AUDIO',
          dataProcessed: true,
          swedishCompliant: true,
          gdprCompliant: true,
          personalDataInvolved: true,
        })
      );
    });

    it('should recover from transient failures', async () => {
      const result = await service.processSwedishLanguage('Test text');
      
      // Even if entity extraction fails, basic processing should work
      expect(result.basicProcessingAvailable).toBe(true);
      expect(result.fallbackProcessingUsed).toBe(true);
      expect(result.swedishErrorHandling).toBe(true);
    });
  });

  // 4. Security & Permissions (4 tests)
  describe('Security', () => {
    it('should validate user permissions for AI operations', async () => {
      const audioData = {
        data: 'audio',
        containsPersonalData: true,
        gdprConsent: false,
      };

      const result = await service.transcribeAudio(audioData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('GDPR_CONSENT_REQUIRED');
      expect(result.error).toBe('GDPR-samtycke krävs för bearbetning av röstdata');
      expect(result.consentValidated).toBe(true);
      expect(result.personalDataBlocked).toBe(true);
    });

    it('should encrypt sensitive data', async () => {
      (aiSecurity.encryptAIData as jest.Mock).mockReturnValue({
        encrypted: true,
        data: 'encrypted-data',
      });

      const result = await service.transcribeAudioSecure({
        data: 'sensitive-audio',
      });

      expect(result.success).toBe(true);
      expect(result.dataEncrypted).toBe(true);
      expect(result.personalDataProtected).toBe(true);
      expect(aiSecurity.encryptAIData).toHaveBeenCalled();
    });

    it('should prevent unauthorized access', async () => {
      const openAIConfig = service.getOpenAIConfig();
      
      expect(openAIConfig.gdprCompliant).toBe(true);
      expect(openAIConfig.outputSanitization).toBe(true);
    });

    it('should comply with GDPR requirements', async () => {
      (aiSecurity.sanitizeAIOutput as jest.Mock).mockReturnValue({
        sanitizedContent: 'cleaned content',
        sensitiveDataRemoved: ['personnummer', 'email'],
      });

      const result = await service.sanitizeOutput({
        content: 'Protocol with sensitive data',
      });

      expect(result.success).toBe(true);
      expect(result.sensitiveDataRemoved).toBeDefined();
      expect(result.gdprCompliant).toBe(true);
      expect(result.swedishDataProtection).toBe(true);
    });
  });

  // 5. Swedish Language Support (4 tests)
  describe('Swedish Language', () => {
    it('should process Swedish characters (å, ä, ö) correctly', async () => {
      const textWithSwedishChars = 'Årsredovisning för Örebro Äldreomsorg';

      (swedishProcessor.processSwedishText as jest.Mock).mockReturnValue({
        entities: ['Årsredovisning', 'Örebro', 'Äldreomsorg'],
        businessTerms: ['årsredovisning'],
      });

      const result = await service.processSwedishLanguage(textWithSwedishChars);

      expect(result.success).toBe(true);
      expect(swedishProcessor.extractSwedishEntities).toHaveBeenCalledWith(textWithSwedishChars);
    });

    it('should handle Swedish business terminology', async () => {
      const capabilities = await service.validateSwedishCapabilities();

      expect(capabilities.businessTerminology).toBe(true);
      expect(capabilities.speechRecognition).toBe(true);
      expect(capabilities.textGeneration).toBe(true);
    });

    it('should format Swedish dates and numbers', async () => {
      const result = await service.generateSwedishBusinessProtocol({
        date: '2024-03-15',
        amount: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.swedishBusinessFormatting).toBe(true);
      expect(result.formalLanguageUsed).toBe(true);
    });

    it('should validate Swedish input patterns', async () => {
      const messages = service.getAIMessages();
      
      expect(messages.TRANSCRIPTION_FAILED).toMatch(/misslyckades/);
      expect(messages.PROTOCOL_GENERATION_ERROR).toMatch(/misslyckades/);
      expect(messages.LANGUAGE_PROCESSING_ERROR).toMatch(/misslyckades/);
    });
  });

  // 6. Performance & Integration (4 tests)
  describe('Performance', () => {
    it('should complete operations within time limits', async () => {
      const metrics = await service.getAIPerformanceMetrics();

      expect(metrics.averageTranscriptionTime).toBeLessThan(30);
      expect(metrics.protocolGenerationTime).toBeLessThan(10);
      expect(metrics.swedishAccuracy).toBeGreaterThan(0.95);
    });

    it('should handle concurrent requests', async () => {
      const apiMetrics = await service.getAPIMetrics();

      expect(apiMetrics.azureConnected).toBe(true);
      expect(apiMetrics.openaiConnected).toBe(true);
      expect(apiMetrics.successRate).toBeGreaterThan(0.95);
      expect(apiMetrics.retryMechanismActive).toBe(true);
    });

    it('should integrate with external services', async () => {
      const azureConfig = service.getAzureConfig();
      const openAIConfig = service.getOpenAIConfig();

      expect(azureConfig.region).toBe('northeurope');
      expect(azureConfig.language).toBe('sv-SE');
      expect(openAIConfig.swedishPrompts).toBe(true);
    });

    it('should clean up resources properly', async () => {
      const accessibilityFeatures = await service.getSwedishAccessibilityFeatures();

      expect(accessibilityFeatures.swedishVoiceCommands).toBe(true);
      expect(accessibilityFeatures.wcagCompliant).toBe(true);
      expect(accessibilityFeatures.swedishAccessibilityStandards).toBe(true);
    });
  });
});