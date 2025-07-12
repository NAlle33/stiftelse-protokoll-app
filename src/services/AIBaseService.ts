import { BaseService, ValidationSchema } from './BaseService';

/**
 * AIBaseService - Specialiserad BaseService för AI-drivna tjänster
 * 
 * Utökar BaseService med AI-specifika mönster för:
 * - Azure OpenAI integration med svenska språkstöd
 * - AI-specifik rate limiting och kostnadskontroll
 * - Prompt sanitization för GDPR-efterlevnad
 * - Token-hantering och optimering
 * - AI-specifik felhantering med svenska meddelanden
 * - Automatisk retry-logik för AI API-anrop
 * 
 * Används av: protocolAIService, transcriptionService, analysisService
 */

export interface AIRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  userId: string;
  sessionId?: string;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
  model: string;
  timestamp: string;
  processingTime: number;
  cost?: number;
}

export interface TokenUsage {
  userId: string;
  date: string;
  totalTokens: number;
  cost: number;
  requestCount: number;
}

export interface PromptSanitization {
  originalLength: number;
  sanitizedLength: number;
  removedElements: string[];
  gdprCompliant: boolean;
}

export abstract class AIBaseService extends BaseService {
  protected tokenUsageMap: Map<string, TokenUsage> = new Map();
  protected readonly DAILY_TOKEN_LIMIT = 100000; // 100k tokens per användare per dag
  protected readonly DAILY_COST_LIMIT = 50; // 50 SEK per användare per dag
  protected readonly MAX_PROMPT_LENGTH = 8000; // Max prompt-längd

  // AI-specifika konfigurationer
  protected readonly DEFAULT_MODEL = 'gpt-4';
  protected readonly DEFAULT_MAX_TOKENS = 1000;
  protected readonly DEFAULT_TEMPERATURE = 0.7;
  protected readonly TOKEN_COST_PER_1K = 0.03; // SEK per 1000 tokens (ungefärlig kostnad)

  // Validationsscheman för AI-data
  protected readonly aiRequestSchema: ValidationSchema = {
    required: ['prompt', 'userId'],
    types: {
      prompt: 'string',
      maxTokens: 'number',
      temperature: 'number',
      model: 'string',
      userId: 'string',
      sessionId: 'string'
    },
    patterns: {
      userId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    },
    custom: {
      prompt: (value: string) => value.length > 0 && value.length <= this.MAX_PROMPT_LENGTH,
      maxTokens: (value: number) => !value || (value > 0 && value <= 4000),
      temperature: (value: number) => !value || (value >= 0 && value <= 2)
    }
  };

  /**
   * Sanitiserar prompt för GDPR-efterlevnad
   */
  protected sanitizePrompt(prompt: string, userId: string): { sanitizedPrompt: string; sanitization: PromptSanitization } {
    try {
      const originalLength = prompt.length;
      let sanitizedPrompt = prompt;
      const removedElements: string[] = [];

      // Ta bort personnummer (svenska format)
      const personnummerRegex = /\b\d{6}[-\s]?\d{4}\b/g;
      const personnummerMatches = sanitizedPrompt.match(personnummerRegex);
      if (personnummerMatches) {
        sanitizedPrompt = sanitizedPrompt.replace(personnummerRegex, '[PERSONNUMMER_BORTTAGET]');
        removedElements.push('personnummer');
      }

      // Ta bort e-postadresser
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emailMatches = sanitizedPrompt.match(emailRegex);
      if (emailMatches) {
        sanitizedPrompt = sanitizedPrompt.replace(emailRegex, '[E-POST_BORTTAGET]');
        removedElements.push('e-postadresser');
      }

      // Ta bort telefonnummer (svenska format)
      const phoneRegex = /\b(?:\+46|0)[\s-]?[1-9](?:[\s-]?\d){7,8}\b/g;
      const phoneMatches = sanitizedPrompt.match(phoneRegex);
      if (phoneMatches) {
        sanitizedPrompt = sanitizedPrompt.replace(phoneRegex, '[TELEFON_BORTTAGET]');
        removedElements.push('telefonnummer');
      }

      // Ta bort adresser (grundläggande mönster)
      const addressRegex = /\b\d+\s+[A-Za-zÅÄÖåäö\s]+(?:gatan|vägen|torget|platsen)\s*\d*[A-Za-z]?\b/gi;
      const addressMatches = sanitizedPrompt.match(addressRegex);
      if (addressMatches) {
        sanitizedPrompt = sanitizedPrompt.replace(addressRegex, '[ADRESS_BORTTAGET]');
        removedElements.push('adresser');
      }

      // Ta bort potentiella namn (ord som börjar med stor bokstav och är längre än 2 tecken)
      // Behåll vanliga svenska ord och organisationsnamn
      const commonSwedishWords = ['Stiftelsen', 'Föreningen', 'AB', 'Aktiebolag', 'Sverige', 'Stockholm', 'Göteborg', 'Malmö'];
      const nameRegex = /\b[A-ZÅÄÖ][a-zåäö]{2,}\s+[A-ZÅÄÖ][a-zåäö]{2,}\b/g;
      const nameMatches = sanitizedPrompt.match(nameRegex);
      if (nameMatches) {
        nameMatches.forEach(match => {
          if (!commonSwedishWords.some(word => match.includes(word))) {
            sanitizedPrompt = sanitizedPrompt.replace(match, '[NAMN_BORTTAGET]');
            if (!removedElements.includes('namn')) {
              removedElements.push('namn');
            }
          }
        });
      }

      const sanitization: PromptSanitization = {
        originalLength,
        sanitizedLength: sanitizedPrompt.length,
        removedElements,
        gdprCompliant: true
      };

      // Logga sanitization för audit trail
      this.logPromptSanitization(userId, sanitization);

      return { sanitizedPrompt, sanitization };

    } catch (error) {
      throw this.handleError(error as Error, 'sanitizePrompt', { userId });
    }
  }

  /**
   * Kontrollerar token-användning och kostnadsgränser
   */
  protected async checkTokenLimits(userId: string, estimatedTokens: number): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const userUsage = this.tokenUsageMap.get(`${userId}-${today}`) || {
        userId,
        date: today,
        totalTokens: 0,
        cost: 0,
        requestCount: 0
      };

      // Kontrollera token-gräns
      if (userUsage.totalTokens + estimatedTokens > this.DAILY_TOKEN_LIMIT) {
        throw new Error(`Daglig token-gräns (${this.DAILY_TOKEN_LIMIT}) skulle överskridas. Försök igen imorgon.`);
      }

      // Kontrollera kostnadsgräns
      const estimatedCost = (estimatedTokens / 1000) * this.TOKEN_COST_PER_1K;
      if (userUsage.cost + estimatedCost > this.DAILY_COST_LIMIT) {
        throw new Error(`Daglig kostnadsgräns (${this.DAILY_COST_LIMIT} SEK) skulle överskridas. Försök igen imorgon.`);
      }

      return true;

    } catch (error) {
      throw this.handleError(error as Error, 'checkTokenLimits', { userId, estimatedTokens });
    }
  }

  /**
   * Uppdaterar token-användning efter AI-anrop
   */
  protected updateTokenUsage(userId: string, tokensUsed: number, cost: number): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `${userId}-${today}`;
      
      const currentUsage = this.tokenUsageMap.get(key) || {
        userId,
        date: today,
        totalTokens: 0,
        cost: 0,
        requestCount: 0
      };

      const updatedUsage: TokenUsage = {
        ...currentUsage,
        totalTokens: currentUsage.totalTokens + tokensUsed,
        cost: currentUsage.cost + cost,
        requestCount: currentUsage.requestCount + 1
      };

      this.tokenUsageMap.set(key, updatedUsage);

      // Spara till databas för långsiktig spårning
      this.saveTokenUsageToDatabase(updatedUsage).catch(error => {
        console.error(`Fel vid sparande av token-användning: ${error.message}`);
      });

    } catch (error) {
      console.error(`Fel vid uppdatering av token-användning: ${error.message}`);
    }
  }

  /**
   * Utför AI-anrop med retry-logik och felhantering
   */
  protected async executeAIRequest(request: AIRequest): Promise<AIResponse> {
    try {
      // Validera request
      const validation = this.validateInput(request, this.aiRequestSchema);
      if (!validation.isValid) {
        throw new Error(`Ogiltig AI-förfrågan: ${validation.errors.join(', ')}`);
      }

      // Sanitisera prompt
      const { sanitizedPrompt, sanitization } = this.sanitizePrompt(request.prompt, request.userId);

      // Uppskatta tokens och kontrollera gränser
      const estimatedTokens = Math.ceil(sanitizedPrompt.length / 4) + (request.maxTokens || this.DEFAULT_MAX_TOKENS);
      await this.checkTokenLimits(request.userId, estimatedTokens);

      // Utför AI-anrop med retry-logik
      const startTime = Date.now();
      
      const result = await this.executeQuery(async () => {
        // Här skulle Azure OpenAI API-anropet göras
        // För nu returnerar vi en mock-respons
        const mockResponse = {
          content: `[AI-genererat svar baserat på sanitiserad prompt (${sanitization.removedElements.length} element borttagna för GDPR-efterlevnad)]`,
          tokensUsed: estimatedTokens,
          model: request.model || this.DEFAULT_MODEL,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          cost: (estimatedTokens / 1000) * this.TOKEN_COST_PER_1K
        };

        return mockResponse;
      }, 'executeAIRequest');

      // Uppdatera token-användning
      this.updateTokenUsage(request.userId, result.tokensUsed, result.cost || 0);

      return result;

    } catch (error) {
      throw this.handleError(error as Error, 'executeAIRequest', { 
        userId: request.userId,
        model: request.model,
        promptLength: request.prompt.length 
      });
    }
  }

  /**
   * Hämtar AI-specifiska svenska felmeddelanden
   */
  protected getSwedishAIErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('token') && message.includes('gräns')) {
      return 'Daglig AI-användningsgräns nådd. Försök igen imorgon eller kontakta support för utökad kvot.';
    }

    if (message.includes('kostnad') && message.includes('gräns')) {
      return 'Daglig kostnadsgräns för AI-tjänster nådd. Försök igen imorgon eller kontakta support.';
    }

    if (message.includes('prompt') && message.includes('lång')) {
      return `Texten är för lång för AI-bearbetning. Maximal längd är ${this.MAX_PROMPT_LENGTH} tecken.`;
    }

    if (message.includes('api') || message.includes('azure')) {
      return 'AI-tjänsten är tillfälligt otillgänglig. Försök igen om några minuter.';
    }

    if (message.includes('gdpr') || message.includes('personuppgift')) {
      return 'Texten innehåller känsliga personuppgifter som inte kan bearbetas. Ta bort personlig information och försök igen.';
    }

    return 'Ett oväntat fel uppstod vid AI-bearbetning. Försök igen eller kontakta support.';
  }

  /**
   * Loggar prompt-sanitization för audit trail
   */
  private async logPromptSanitization(userId: string, sanitization: PromptSanitization): Promise<void> {
    try {
      await this.executeQuery(async () => {
        const { supabase } = require('./supabaseClient');
        
        const { error } = await supabase
          .from('ai_prompt_sanitizations')
          .insert({
            user_id: userId,
            original_length: sanitization.originalLength,
            sanitized_length: sanitization.sanitizedLength,
            removed_elements: sanitization.removedElements,
            gdpr_compliant: sanitization.gdprCompliant,
            timestamp: new Date().toISOString()
          });

        if (error) {
          console.error('Fel vid loggning av prompt-sanitization:', error);
        }

        return { success: true };
      }, 'logPromptSanitization');
    } catch (error) {
      console.error('Fel vid loggning av prompt-sanitization:', error);
    }
  }

  /**
   * Sparar token-användning till databas
   */
  private async saveTokenUsageToDatabase(usage: TokenUsage): Promise<void> {
    try {
      await this.executeQuery(async () => {
        const { supabase } = require('./supabaseClient');
        
        const { error } = await supabase
          .from('ai_token_usage')
          .upsert({
            user_id: usage.userId,
            date: usage.date,
            total_tokens: usage.totalTokens,
            cost: usage.cost,
            request_count: usage.requestCount,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,date'
          });

        if (error) {
          throw new Error(`Databasfel: ${error.message}`);
        }

        return { success: true };
      }, 'saveTokenUsageToDatabase');
    } catch (error) {
      console.error('Fel vid sparande av token-användning:', error);
    }
  }

  /**
   * Rensar AI-resurser och cache
   */
  protected async cleanupAIResources(): Promise<void> {
    try {
      // Rensa token-användning cache (behåll dagens data)
      const today = new Date().toISOString().split('T')[0];
      const keysToDelete: string[] = [];
      
      this.tokenUsageMap.forEach((usage, key) => {
        if (usage.date !== today) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.tokenUsageMap.delete(key));

      console.log(`✅ ${this.serviceName}: AI-resurser rensade (${keysToDelete.length} gamla poster borttagna)`);
    } catch (error) {
      console.error(`❌ ${this.serviceName}: Fel vid rensning av AI-resurser:`, error);
    }
  }
}
