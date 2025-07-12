/**
 * ProtocolAIService - AI-baserad protokollgenerering
 * 
 * Migrerad till AIBaseService-mönster för:
 * - Enhetlig felhantering och validering
 * - GDPR-efterlevnad och prompt-sanitisering
 * - Token-hantering och kostnadskontroll
 * - Caching och prestanda-optimering
 * - Svensk lokalisering genomgående
 * 
 * Integreras med ProtocolService för komplett protokollworkflow.
 */

import { AIBaseService, AIRequest, AIResponse } from './AIBaseService';
import { supabase } from './supabaseClient';
import {
  reportAzureOpenAIError,
  reportTranscriptionError,
  trackProtocolGenerationPerformance,
  reportAIRateLimitError
} from './sentryService';

// Interfaces för protokoll-AI-funktionalitet
export interface ProtocolGenerationRequest {
  transcription: string;
  meetingId: string;
  meetingType: 'board_meeting' | 'annual_meeting' | 'constituting_meeting';
  organizationName: string;
  meetingDate: string;
  participants: Array<{
    name: string;
    role: string;
  }>;
  templateId?: string;
  userId: string; // Krävs för BaseService
}

export interface ProtocolGenerationResponse {
  protocol: string;
  success: boolean;
  error?: string;
  tokensUsed?: number;
  cost?: number;
  gdprCompliant: boolean;
}

export interface ProtocolGenerationStatus {
  status: 'idle' | 'generating' | 'completed' | 'error';
  progress?: number;
  error?: string;
  protocol?: string;
  phase?: 'validation' | 'ai_processing' | 'formatting' | 'saving';
}

export interface ProtocolGenerationWorkflow {
  transcription: string;
  template?: any; // Will be properly typed when integrated with ProtocolService
  meetingContext: {
    id: string;
    type: string;
    date: string;
    organization: string;
    participants: Array<{ name: string; role: string }>;
  };
  aiOptions: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export class ProtocolAIService extends AIBaseService {
  protected readonly serviceName = 'ProtocolAIService';
  private statusCallbacks: Map<string, (status: ProtocolGenerationStatus) => void> = new Map();

  /**
   * Initialiserar ProtocolAIService
   */
  protected async initialize(): Promise<void> {
    // Ingen specifik initialisering krävs för ProtocolAIService
    // Denna metod implementerar den abstrakta metoden från BaseService
  }

  /**
   * Skapar ett fel med svensk lokalisering
   */
  private createError(message: string, code: string, metadata?: Record<string, any>): Error {
    const error = new Error(message);
    error.name = code;
    return error;
  }

  // Validationsscheman
  protected readonly protocolRequestSchema = {
    required: ['transcription', 'meetingId', 'meetingType', 'organizationName', 'meetingDate', 'participants', 'userId'],
    types: {
      transcription: 'string',
      meetingId: 'string',
      meetingType: 'string',
      organizationName: 'string',
      meetingDate: 'string',
      participants: 'object',
      userId: 'string'
    },
    custom: {
      transcription: (value: string) => value.length > 50 && value.length <= 100000,
      meetingType: (value: string) => ['board_meeting', 'annual_meeting', 'constituting_meeting'].includes(value),
      participants: (value: any[]) => Array.isArray(value) && value.length > 0
    }
  };

  /**
   * Genererar protokoll från mötesutskrift med AI
   */
  async generateProtocol(request: ProtocolGenerationRequest): Promise<ProtocolGenerationResponse> {
    // Validera input med BaseService
    this.validateInput(request, this.protocolRequestSchema);

    const startTime = Date.now();
    const inputLength = request.transcription.length;

    return this.executeQuery(async () => {
      // Uppdatera status till generating
      this.updateStatus(request.meetingId, { 
        status: 'generating', 
        progress: 0, 
        phase: 'validation' 
      });

      // Kontrollera token-gränser
      const estimatedTokens = Math.ceil(inputLength / 4);
      await this.checkTokenLimits(request.userId, estimatedTokens);

      // Sanitisera prompt för GDPR-efterlevnad
      this.updateStatus(request.meetingId, { 
        status: 'generating', 
        progress: 15, 
        phase: 'ai_processing' 
      });

      const sanitization = await this.sanitizePrompt(request.transcription, request.userId);
      
      // Skapa AI-request
      const aiRequest: AIRequest = {
        prompt: this.buildProtocolPrompt(request, sanitization.sanitizedPrompt),
        maxTokens: request.aiOptions?.maxTokens || 4000,
        temperature: request.aiOptions?.temperature || 0.3,
        model: request.aiOptions?.model || 'gpt-4',
        userId: request.userId,
        sessionId: request.meetingId
      };

      // Utför AI-request med BaseService
      this.updateStatus(request.meetingId, { 
        status: 'generating', 
        progress: 40, 
        phase: 'ai_processing' 
      });

      const aiResponse = await this.executeAIRequest(aiRequest);

      // Formatera och validera AI-svar
      this.updateStatus(request.meetingId, { 
        status: 'generating', 
        progress: 75, 
        phase: 'formatting' 
      });

      const formattedProtocol = this.formatProtocolResponse(aiResponse.content, request);

      // Spara resultat
      this.updateStatus(request.meetingId, { 
        status: 'generating', 
        progress: 90, 
        phase: 'saving' 
      });

      await this.saveGeneratedProtocol(request.meetingId, formattedProtocol, aiResponse);

      // Slutför med framgångsstatus
      this.updateStatus(request.meetingId, {
        status: 'completed',
        progress: 100,
        protocol: formattedProtocol
      });

      // Spåra framgångsrik protokollgenerering
      trackProtocolGenerationPerformance({
        inputLength,
        outputLength: formattedProtocol.length,
        success: true,
        startTime,
        service: 'openai',
        operation: 'generate_protocol',
        requestId: request.meetingId,
        tokenCount: aiResponse.tokensUsed,
      });

      return {
        protocol: formattedProtocol,
        success: true,
        tokensUsed: aiResponse.tokensUsed,
        cost: aiResponse.cost,
        gdprCompliant: sanitization.gdprCompliant
      };

    }, 'generateProtocol');
  }

  /**
   * Bygger AI-prompt för protokollgenerering
   */
  private buildProtocolPrompt(request: ProtocolGenerationRequest, sanitizedTranscription: string): string {
    const { meetingType, organizationName, meetingDate, participants } = request;
    
    const participantsList = participants
      .map(p => `- ${p.name} (${p.role})`)
      .join('\n');

    return `
Du är en expert på svenska stiftelsemöten och protokollskrivning. Generera ett professionellt protokoll baserat på följande mötesutskrift.

MÖTESKONTEXT:
- Typ: ${this.translateMeetingType(meetingType)}
- Organisation: ${organizationName}
- Datum: ${meetingDate}
- Deltagare:
${participantsList}

UTSKRIFT (GDPR-sanitiserad):
${sanitizedTranscription}

INSTRUKTIONER:
1. Skapa ett strukturerat protokoll enligt svensk stiftelsepraxis
2. Inkludera: Dagordning, Beslut, Åtgärder, Närvaro
3. Använd formell svenska språket
4. Markera tydligt alla beslut och åtgärder
5. Följ GDPR-riktlinjer - inkludera inga personuppgifter utöver namn och roller
6. Formatera som välstrukturerad text med tydliga rubriker

PROTOKOLL:`;
  }

  /**
   * Översätter mötestyp till svenska
   */
  private translateMeetingType(type: string): string {
    const translations = {
      'board_meeting': 'Styrelsemöte',
      'annual_meeting': 'Årsmöte',
      'constituting_meeting': 'Konstituerande möte'
    };
    return translations[type] || type;
  }

  /**
   * Formaterar AI-svar till strukturerat protokoll
   */
  private formatProtocolResponse(aiContent: string, request: ProtocolGenerationRequest): string {
    // Lägg till protokollhuvud
    const header = `
PROTOKOLL
${this.translateMeetingType(request.meetingType)}
${request.organizationName}

Datum: ${request.meetingDate}
Tid: [Tid från mötesdata]
Plats: [Plats från mötesdata]

NÄRVARANDE:
${request.participants.map(p => `${p.name} - ${p.role}`).join('\n')}

---

${aiContent}

---

Protokollet justerat och godkänt.

Sekreterare: [Sekreterare]
Ordförande: [Ordförande]
`;

    return header.trim();
  }

  /**
   * Sparar genererat protokoll i databasen
   */
  private async saveGeneratedProtocol(
    meetingId: string, 
    protocol: string, 
    aiResponse: AIResponse
  ): Promise<void> {
    const { error } = await supabase
      .from('meetings')
      .update({
        ai_generated_protocol: protocol,
        protocol_status: 'generated',
        ai_tokens_used: aiResponse.tokensUsed,
        ai_cost: aiResponse.cost,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    if (error) {
      throw this.createError(
        'Kunde inte spara genererat protokoll',
        'DATABASE_ERROR',
        { meetingId, error: error.message }
      );
    }
  }

  /**
   * Hämtar aktuell status för protokollgenerering
   */
  async getGenerationStatus(meetingId: string): Promise<ProtocolGenerationStatus> {
    this.validateInput({ meetingId }, {
      required: ['meetingId'],
      types: { meetingId: 'string' }
    });

    const cacheKey = `protocol_status_${meetingId}`;
    const cached = this.getFromCache<ProtocolGenerationStatus>(cacheKey);
    if (cached) return cached;

    return this.executeQuery(async () => {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .select('protocol_status, ai_generated_protocol, updated_at')
        .eq('id', meetingId)
        .single();

      if (error) {
        throw this.createError('Kunde inte hämta mötestatus', 'NOT_FOUND');
      }

      const status = this.mapDatabaseStatusToEnum(meeting);
      
      // Cache status i 30 sekunder
      this.setCache(cacheKey, status, 30);
      
      return status;
    }, 'getGenerationStatus');
  }

  /**
   * Mappar databasstatus till enum
   */
  private mapDatabaseStatusToEnum(meeting: any): ProtocolGenerationStatus {
    switch (meeting.protocol_status) {
      case 'transcribed':
        return { status: 'idle' };
      case 'generating':
        return { status: 'generating', progress: 50 };
      case 'generated':
        return { 
          status: 'completed', 
          progress: 100,
          protocol: meeting.ai_generated_protocol 
        };
      case 'error':
        return { status: 'error', error: 'Protokollgenerering misslyckades' };
      default:
        return { status: 'idle' };
    }
  }

  /**
   * Prenumerera på realtidsuppdateringar för protokollgenerering
   */
  subscribeToStatus(meetingId: string, callback: (status: ProtocolGenerationStatus) => void): () => void {
    // Lagra callback för manuella uppdateringar
    this.statusCallbacks.set(meetingId, callback);

    // Prenumerera på realtidsuppdateringar från Supabase
    const subscription = supabase
      .channel(`protocol_generation_${meetingId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'meetings',
          filter: `id=eq.${meetingId}`
        }, 
        (payload) => {
          const status = this.mapDatabaseStatusToEnum(payload.new);
          callback(status);
        }
      )
      .subscribe();

    // Returnera unsubscribe-funktion
    return () => {
      this.statusCallbacks.delete(meetingId);
      subscription.unsubscribe();
    };
  }

  /**
   * Uppdaterar status manuellt (för intern användning)
   */
  private updateStatus(meetingId: string, status: ProtocolGenerationStatus): void {
    const callback = this.statusCallbacks.get(meetingId);
    if (callback) {
      callback(status);
    }
    
    // Rensa cache för status
    this.clearCache(`protocol_status_${meetingId}`);
  }

  /**
   * Uppskattar kostnad för protokollgenerering
   */
  async estimateCost(transcriptionLength: number): Promise<{ estimatedCost: number; currency: string }> {
    const estimatedTokens = Math.ceil(transcriptionLength / 4) * 1.5; // Input + output estimate
    const costPerToken = 0.00003; // GPT-4 pricing approximation
    const estimatedCost = estimatedTokens * costPerToken;

    return {
      estimatedCost: Math.round(estimatedCost * 100) / 100, // Round to 2 decimals
      currency: 'SEK'
    };
  }

  /**
   * Validerar protokollgenereringsförfrågan
   */
  private validateRequest(request: ProtocolGenerationRequest): void {
    if (!request.transcription || request.transcription.length < 50) {
      throw this.createError(
        'Transkribering måste vara minst 50 tecken lång',
        'VALIDATION_ERROR'
      );
    }

    if (!request.meetingId || !request.userId) {
      throw this.createError(
        'Mötes-ID och användar-ID krävs',
        'VALIDATION_ERROR'
      );
    }

    if (!request.participants || request.participants.length === 0) {
      throw this.createError(
        'Minst en deltagare krävs',
        'VALIDATION_ERROR'
      );
    }
  }

  /**
   * Rensa alla aktiva prenumerationer och callbacks
   */
  cleanup(): void {
    this.statusCallbacks.clear();
  }
}

// Exportera singleton-instans
export const protocolAIService = new ProtocolAIService();
