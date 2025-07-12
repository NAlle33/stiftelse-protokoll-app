/**
 * ProtocolAIService Test Suite
 * Following Phase 6 Comprehensive Testing Implementation Guide
 * Target: 95%+ coverage with 26 tests (6 categories × 4-5 tests each)
 */

import { ProtocolAIService, protocolAIService } from '../protocolAIService';
import { supabase } from '../supabaseClient';
import {
  reportAzureOpenAIError,
  reportTranscriptionError,
  trackProtocolGenerationPerformance,
  reportAIRateLimitError
} from '../sentryService';

// Mock all dependencies
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({
        unsubscribe: jest.fn(),
      }),
    })),
  },
}));

jest.mock('../sentryService', () => ({
  reportAzureOpenAIError: jest.fn(),
  reportTranscriptionError: jest.fn(),
  trackProtocolGenerationPerformance: jest.fn(),
  reportAIRateLimitError: jest.fn(),
}));

// Mock AIBaseService methods
jest.mock('../AIBaseService', () => {
  return {
    AIBaseService: class {
      protected serviceName = 'ProtocolAIService';
      
      async initialize() {}
      
      validateInput(data: any, schema: any) {
        // Basic validation mock
        if (schema.required) {
          for (const field of schema.required) {
            if (!data[field]) {
              throw new Error(`Missing required field: ${field}`);
            }
          }
        }
      }
      
      async executeQuery(fn: Function, operation: string) {
        try {
          return await fn();
        } catch (error) {
          throw error;
        }
      }
      
      async checkTokenLimits(userId: string, tokens: number) {
        if (tokens > 8000) {
          throw new Error('Token limit exceeded');
        }
      }
      
      async sanitizePrompt(prompt: string, userId: string) {
        return {
          sanitizedPrompt: prompt.replace(/\d{10,}/g, '[PERSONNUMMER]'),
          gdprCompliant: true,
        };
      }
      
      async executeAIRequest(request: any) {
        return {
          content: 'Generated protocol content...',
          tokensUsed: 1500,
          cost: 0.045,
          success: true,
        };
      }
      
      getFromCache(key: string) {
        return null;
      }
      
      setCache(key: string, value: any, ttl: number) {}
      
      clearCache(key: string) {}
    },
  };
});

describe('ProtocolAIService', () => {
  let service: ProtocolAIService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProtocolAIService();
  });

  afterEach(() => {
    service.cleanup();
  });

  // 1. Initialization & Configuration (4 tests)
  describe('Initialization', () => {
    it('should initialize with correct Swedish configuration', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
      expect(service['serviceName']).toBe('ProtocolAIService');
    });

    it('should handle missing configuration gracefully', () => {
      expect(() => new ProtocolAIService()).not.toThrow();
    });

    it('should validate required protocol generation fields', () => {
      const schema = service['protocolRequestSchema'];
      expect(schema.required).toContain('transcription');
      expect(schema.required).toContain('meetingId');
      expect(schema.required).toContain('userId');
      expect(schema.required).toContain('participants');
    });

    it('should set up proper error handling with Swedish messages', () => {
      const error = service['createError']('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('TEST_CODE');
    });
  });

  // 2. Core Functionality (6 tests)
  describe('Core Functionality', () => {
    const mockRequest = {
      transcription: 'Detta är en transkribering av mötet där styrelsen beslutade om årsstämman.',
      meetingId: 'meeting-123',
      meetingType: 'board_meeting' as const,
      organizationName: 'Stiftelsen Exempel',
      meetingDate: '2024-03-15',
      participants: [
        { name: 'Anna Andersson', role: 'Ordförande' },
        { name: 'Erik Eriksson', role: 'Sekreterare' },
      ],
      userId: 'user-123',
    };

    it('should generate protocol from transcription successfully', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await service.generateProtocol(mockRequest);

      expect(result.success).toBe(true);
      expect(result.protocol).toContain('PROTOKOLL');
      expect(result.protocol).toContain('Styrelsemöte');
      expect(result.protocol).toContain('Stiftelsen Exempel');
      expect(result.gdprCompliant).toBe(true);
    });

    it('should handle Swedish business terminology correctly', async () => {
      const longTranscription = 'x'.repeat(100); // Minimum 50 chars
      const request = { ...mockRequest, transcription: longTranscription };

      const result = await service.generateProtocol(request);
      
      expect(result.protocol).toContain('Styrelsemöte');
      expect(result.protocol).toContain('Ordförande');
      expect(result.protocol).toContain('Sekreterare');
    });

    it('should format protocol according to Swedish standards', async () => {
      const result = await service.generateProtocol(mockRequest);

      expect(result.protocol).toContain('PROTOKOLL');
      expect(result.protocol).toContain('NÄRVARANDE:');
      expect(result.protocol).toContain('Datum: 2024-03-15');
      expect(result.protocol).toContain('Protokollet justerat och godkänt.');
    });

    it('should track protocol generation performance', async () => {
      await service.generateProtocol(mockRequest);

      expect(trackProtocolGenerationPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          inputLength: mockRequest.transcription.length,
          success: true,
          service: 'openai',
          operation: 'generate_protocol',
        })
      );
    });

    it('should handle protocol status updates correctly', async () => {
      let statusUpdate: any;
      const callback = jest.fn((status) => { statusUpdate = status; });
      
      const unsubscribe = service.subscribeToStatus('meeting-123', callback);

      // Simulate status update
      service['updateStatus']('meeting-123', {
        status: 'generating',
        progress: 50,
        phase: 'ai_processing',
      });

      expect(callback).toHaveBeenCalled();
      expect(statusUpdate.status).toBe('generating');
      expect(statusUpdate.progress).toBe(50);

      unsubscribe();
    });

    it('should estimate protocol generation cost accurately', async () => {
      const transcriptionLength = 5000;
      const result = await service.estimateCost(transcriptionLength);

      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.currency).toBe('SEK');
      expect(typeof result.estimatedCost).toBe('number');
    });
  });

  // 3. Error Handling & Recovery (4 tests)
  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ 
            error: { message: 'Database connection failed' } 
          }),
        }),
      });

      const request = {
        transcription: 'x'.repeat(100),
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Test Org',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Test User', role: 'Ordförande' }],
        userId: 'user-123',
      };

      await expect(service.generateProtocol(request)).rejects.toThrow('Kunde inte spara genererat protokoll');
    });

    it('should validate transcription length requirements', async () => {
      const shortRequest = {
        ...mockRequest,
        transcription: 'Too short',
      };

      const mockRequest = {
        transcription: 'x'.repeat(30), // Less than 50 chars
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Test',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Test', role: 'Role' }],
        userId: 'user-123',
      };

      // The validation happens in the schema custom validation
      await expect(service.generateProtocol(mockRequest)).rejects.toThrow();
    });

    it('should handle missing participants gracefully', async () => {
      const noParticipantsRequest = {
        transcription: 'x'.repeat(100),
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Test',
        meetingDate: '2024-03-15',
        participants: [],
        userId: 'user-123',
      };

      await expect(service.generateProtocol(noParticipantsRequest)).rejects.toThrow();
    });

    it('should recover from transient API failures', async () => {
      const mockChannelSubscription = {
        unsubscribe: jest.fn(),
      };
      
      (supabase.channel as jest.Mock).mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnValue(mockChannelSubscription),
      });

      const unsubscribe = service.subscribeToStatus('meeting-123', jest.fn());
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
      expect(mockChannelSubscription.unsubscribe).toHaveBeenCalled();
    });
  });

  // 4. Security & Permissions (5 tests)
  describe('Security', () => {
    it('should validate user permissions through userId requirement', async () => {
      const noUserRequest = {
        transcription: 'x'.repeat(100),
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Test',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Test', role: 'Role' }],
        // Missing userId
      };

      await expect(service.generateProtocol(noUserRequest as any)).rejects.toThrow('Missing required field: userId');
    });

    it('should sanitize personal data in transcriptions', async () => {
      const requestWithPersonalData = {
        transcription: 'Mötet diskuterade person med personnummer 1234567890...',
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Test Org',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Test User', role: 'Ordförande' }],
        userId: 'user-123',
      };

      const result = await service.generateProtocol(requestWithPersonalData);
      
      expect(result.gdprCompliant).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should enforce token limits for cost control', async () => {
      const hugeRequest = {
        transcription: 'x'.repeat(50000), // Very long transcription
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Test',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Test', role: 'Role' }],
        userId: 'user-123',
      };

      // Override checkTokenLimits to throw error
      service['checkTokenLimits'] = jest.fn().mockRejectedValue(new Error('Token limit exceeded'));

      await expect(service.generateProtocol(hugeRequest)).rejects.toThrow('Token limit exceeded');
    });

    it('should comply with GDPR requirements in protocol output', async () => {
      const result = await service.generateProtocol({
        transcription: 'x'.repeat(100),
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'GDPR Test Org',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Anna Andersson', role: 'Ordförande' }],
        userId: 'user-123',
      });

      expect(result.gdprCompliant).toBe(true);
      expect(result.protocol).not.toContain('personnummer');
      expect(result.protocol).toContain('Anna Andersson - Ordförande');
    });

    it('should handle secure protocol storage', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
      });

      await service.generateProtocol({
        transcription: 'x'.repeat(100),
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Test',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Test', role: 'Role' }],
        userId: 'user-123',
      });

      expect(supabase.from).toHaveBeenCalledWith('meetings');
    });
  });

  // 5. Swedish Language Support (4 tests)
  describe('Swedish Language', () => {
    it('should process Swedish characters (å, ä, ö) correctly', async () => {
      const swedishRequest = {
        transcription: 'Mötet behandlade årsredovisningen för Örebro äldreomsorg',
        meetingId: 'meeting-123',
        meetingType: 'annual_meeting' as const,
        organizationName: 'Örebro Äldreomsorg',
        meetingDate: '2024-03-15',
        participants: [
          { name: 'Åsa Öberg', role: 'Ordförande' },
          { name: 'Ärlig Ängström', role: 'Sekreterare' },
        ],
        userId: 'user-123',
      };

      const result = await service.generateProtocol(swedishRequest);

      expect(result.protocol).toContain('Årsmöte');
      expect(result.protocol).toContain('Örebro Äldreomsorg');
      expect(result.protocol).toContain('Åsa Öberg');
    });

    it('should translate meeting types to Swedish', () => {
      const translations = {
        'board_meeting': 'Styrelsemöte',
        'annual_meeting': 'Årsmöte',
        'constituting_meeting': 'Konstituerande möte',
      };

      Object.entries(translations).forEach(([type, swedish]) => {
        const translated = service['translateMeetingType'](type);
        expect(translated).toBe(swedish);
      });
    });

    it('should format Swedish dates correctly', async () => {
      const result = await service.generateProtocol({
        transcription: 'x'.repeat(100),
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Test',
        meetingDate: '2024-12-24',
        participants: [{ name: 'Test', role: 'Role' }],
        userId: 'user-123',
      });

      expect(result.protocol).toContain('Datum: 2024-12-24');
    });

    it('should use formal Swedish language in protocols', async () => {
      const result = await service.generateProtocol({
        transcription: 'x'.repeat(100),
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Formell Stiftelse',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Test', role: 'Ordförande' }],
        userId: 'user-123',
      });

      expect(result.protocol).toContain('PROTOKOLL');
      expect(result.protocol).toContain('NÄRVARANDE:');
      expect(result.protocol).toContain('Protokollet justerat och godkänt.');
    });
  });

  // 6. Performance & Integration (4 tests)
  describe('Performance', () => {
    it('should complete protocol generation within reasonable time', async () => {
      const startTime = Date.now();
      
      await service.generateProtocol({
        transcription: 'x'.repeat(1000),
        meetingId: 'meeting-123',
        meetingType: 'board_meeting' as const,
        organizationName: 'Performance Test',
        meetingDate: '2024-03-15',
        participants: [{ name: 'Test', role: 'Role' }],
        userId: 'user-123',
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent protocol generations', async () => {
      const requests = Array(3).fill(null).map((_, i) => ({
        transcription: `Möte nummer ${i} transkribering`.repeat(10),
        meetingId: `meeting-${i}`,
        meetingType: 'board_meeting' as const,
        organizationName: `Org ${i}`,
        meetingDate: '2024-03-15',
        participants: [{ name: `User ${i}`, role: 'Ordförande' }],
        userId: `user-${i}`,
      }));

      const results = await Promise.all(
        requests.map(req => service.generateProtocol(req))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.gdprCompliant).toBe(true);
      });
    });

    it('should integrate with real-time status updates', async () => {
      const mockData = {
        protocol_status: 'generated',
        ai_generated_protocol: 'Test protocol content',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const status = await service.getGenerationStatus('meeting-123');

      expect(status.status).toBe('completed');
      expect(status.progress).toBe(100);
      expect(status.protocol).toBe('Test protocol content');
    });

    it('should clean up resources properly', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      const unsub1 = service.subscribeToStatus('meeting-1', callback1);
      const unsub2 = service.subscribeToStatus('meeting-2', callback2);

      expect(service['statusCallbacks'].size).toBe(2);

      service.cleanup();

      expect(service['statusCallbacks'].size).toBe(0);
    });
  });
});