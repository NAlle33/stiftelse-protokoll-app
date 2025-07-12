import { BaseService, ValidationSchema } from './BaseService';
import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';

/**
 * RealtimeBaseService - Specialiserad BaseService för Supabase Realtime-tjänster
 * 
 * Utökar BaseService med realtime-specifika mönster för:
 * - Supabase Realtime subscription-hantering
 * - Connection state-hantering och monitoring
 * - Automatisk reconnection-logik med exponential backoff
 * - Rate limiting för realtime-meddelanden
 * - Presence-hantering för användare
 * - GDPR-kompatibel realtime-datahantering
 * 
 * Används av: webrtcSignalingService, notificationService, auditService
 */

export interface RealtimeSubscription {
  channelName: string;
  channel: RealtimeChannel;
  isActive: boolean;
  lastActivity: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

export interface PresenceState {
  userId: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen: string;
  metadata?: Record<string, any>;
}

export interface RateLimitConfig {
  maxMessages: number;
  timeWindow: number; // milliseconds
  userId: string;
}

export interface RealtimeMessage {
  type: string;
  payload: any;
  timestamp: string;
  fromUserId?: string;
  toUserId?: string;
}

export abstract class RealtimeBaseService extends BaseService {
  protected subscriptions: Map<string, RealtimeSubscription> = new Map();
  protected presenceStates: Map<string, PresenceState> = new Map();
  protected rateLimitMap: Map<string, number[]> = new Map();
  protected reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Realtime-specifika konfigurationer
  protected readonly DEFAULT_RECONNECT_DELAY = 1000; // 1 sekund
  protected readonly MAX_RECONNECT_ATTEMPTS = 5;
  protected readonly RATE_LIMIT_WINDOW = 60000; // 1 minut
  protected readonly DEFAULT_RATE_LIMIT = 60; // 60 meddelanden per minut

  // Validationsscheman för realtime-data
  protected readonly messageSchema: ValidationSchema = {
    required: ['type', 'payload', 'timestamp'],
    types: {
      type: 'string',
      payload: 'object',
      timestamp: 'string',
      fromUserId: 'string',
      toUserId: 'string'
    },
    patterns: {
      fromUserId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      toUserId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    }
  };

  protected readonly presenceSchema: ValidationSchema = {
    required: ['userId', 'status', 'lastSeen'],
    types: {
      userId: 'string',
      status: 'string',
      lastSeen: 'string',
      metadata: 'object'
    },
    custom: {
      status: (value: string) => ['online', 'offline', 'away', 'busy'].includes(value)
    }
  };

  /**
   * Skapar och hanterar Supabase Realtime-prenumeration
   */
  protected async createSubscription(
    channelName: string,
    callbacks: {
      onMessage?: (message: RealtimeMessage) => void;
      onPresenceSync?: (presences: PresenceState[]) => void;
      onPresenceJoin?: (presence: PresenceState) => void;
      onPresenceLeave?: (presence: PresenceState) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<RealtimeSubscription> {
    try {
      const { supabase } = require('./supabaseClient');
      
      // Skapa kanal
      const channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: 'user_id'
          }
        }
      });

      // Konfigurera event-lyssnare
      if (callbacks.onMessage) {
        channel.on('broadcast', { event: 'message' }, (payload: any) => {
          try {
            const message: RealtimeMessage = {
              type: payload.type || 'unknown',
              payload: payload.payload || {},
              timestamp: payload.timestamp || new Date().toISOString(),
              fromUserId: payload.fromUserId,
              toUserId: payload.toUserId
            };

            // Validera meddelande
            const validation = this.validateInput(message, this.messageSchema);
            if (!validation.isValid) {
              console.warn(`Ogiltigt realtime-meddelande: ${validation.errors.join(', ')}`);
              return;
            }

            callbacks.onMessage(message);
          } catch (error) {
            callbacks.onError?.(error as Error);
          }
        });
      }

      // Presence-hantering
      if (callbacks.onPresenceSync) {
        channel.on('presence', { event: 'sync' }, () => {
          const presences = this.extractPresenceStates(channel.presenceState());
          callbacks.onPresenceSync(presences);
        });
      }

      if (callbacks.onPresenceJoin) {
        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
          const presence = this.extractPresenceState(key, newPresences[0]);
          if (presence) {
            this.presenceStates.set(presence.userId, presence);
            callbacks.onPresenceJoin(presence);
          }
        });
      }

      if (callbacks.onPresenceLeave) {
        channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          const presence = this.extractPresenceState(key, leftPresences[0]);
          if (presence) {
            this.presenceStates.delete(presence.userId);
            callbacks.onPresenceLeave(presence);
          }
        });
      }

      // Prenumerera på kanalen
      const status = await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ ${this.serviceName}: Prenumererar på kanal ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          const error = new Error(`Kunde inte prenumerera på kanal ${channelName}`);
          callbacks.onError?.(error);
          await this.handleReconnection(channelName);
        }
      });

      // Skapa subscription-objekt
      const subscription: RealtimeSubscription = {
        channelName,
        channel,
        isActive: status === 'SUBSCRIBED',
        lastActivity: new Date(),
        reconnectAttempts: 0,
        maxReconnectAttempts: this.MAX_RECONNECT_ATTEMPTS
      };

      this.subscriptions.set(channelName, subscription);
      return subscription;

    } catch (error) {
      throw this.handleError(error as Error, 'createSubscription', { channelName });
    }
  }

  /**
   * Skickar meddelande via realtime-kanal med rate limiting
   */
  protected async sendMessage(
    channelName: string,
    message: Omit<RealtimeMessage, 'timestamp'>,
    userId: string
  ): Promise<RealtimeChannelSendResponse> {
    try {
      // Kontrollera rate limiting
      if (!this.checkRateLimit(userId)) {
        throw new Error('Rate limit överskriden. Försök igen senare.');
      }

      // Validera meddelande
      const fullMessage: RealtimeMessage = {
        ...message,
        timestamp: new Date().toISOString()
      };

      const validation = this.validateInput(fullMessage, this.messageSchema);
      if (!validation.isValid) {
        throw new Error(`Ogiltigt meddelande: ${validation.errors.join(', ')}`);
      }

      // Hämta subscription
      const subscription = this.subscriptions.get(channelName);
      if (!subscription || !subscription.isActive) {
        throw new Error(`Kanal ${channelName} är inte aktiv`);
      }

      // Skicka meddelande
      const response = await subscription.channel.send({
        type: 'broadcast',
        event: 'message',
        payload: fullMessage
      });

      // Uppdatera aktivitet
      subscription.lastActivity = new Date();

      return response;

    } catch (error) {
      throw this.handleError(error as Error, 'sendMessage', { channelName, userId });
    }
  }

  /**
   * Uppdaterar presence-status för användare
   */
  protected async updatePresence(
    channelName: string,
    presence: Omit<PresenceState, 'lastSeen'>
  ): Promise<void> {
    try {
      const fullPresence: PresenceState = {
        ...presence,
        lastSeen: new Date().toISOString()
      };

      // Validera presence
      const validation = this.validateInput(fullPresence, this.presenceSchema);
      if (!validation.isValid) {
        throw new Error(`Ogiltig presence: ${validation.errors.join(', ')}`);
      }

      // Hämta subscription
      const subscription = this.subscriptions.get(channelName);
      if (!subscription || !subscription.isActive) {
        throw new Error(`Kanal ${channelName} är inte aktiv`);
      }

      // Uppdatera presence
      await subscription.channel.track(fullPresence);
      this.presenceStates.set(presence.userId, fullPresence);

    } catch (error) {
      throw this.handleError(error as Error, 'updatePresence', { channelName, userId: presence.userId });
    }
  }

  /**
   * Kontrollerar rate limiting för användare
   */
  protected checkRateLimit(userId: string, limit: number = this.DEFAULT_RATE_LIMIT): boolean {
    const now = Date.now();
    const userMessages = this.rateLimitMap.get(userId) || [];
    
    // Filtrera bort gamla meddelanden utanför tidsfönstret
    const recentMessages = userMessages.filter(timestamp => 
      now - timestamp < this.RATE_LIMIT_WINDOW
    );

    // Kontrollera om gränsen överskrids
    if (recentMessages.length >= limit) {
      return false;
    }

    // Lägg till nytt meddelande
    recentMessages.push(now);
    this.rateLimitMap.set(userId, recentMessages);
    
    return true;
  }

  /**
   * Hanterar automatisk återanslutning med exponential backoff
   */
  protected async handleReconnection(channelName: string): Promise<void> {
    const subscription = this.subscriptions.get(channelName);
    if (!subscription) return;

    subscription.reconnectAttempts++;
    
    if (subscription.reconnectAttempts > subscription.maxReconnectAttempts) {
      console.error(`❌ ${this.serviceName}: Max återanslutningsförsök nådda för ${channelName}`);
      return;
    }

    // Exponential backoff
    const delay = this.DEFAULT_RECONNECT_DELAY * Math.pow(2, subscription.reconnectAttempts - 1);
    
    console.log(`🔄 ${this.serviceName}: Återansluter till ${channelName} om ${delay}ms (försök ${subscription.reconnectAttempts})`);

    const timeout = setTimeout(async () => {
      try {
        await subscription.channel.subscribe();
        subscription.isActive = true;
        subscription.reconnectAttempts = 0;
        console.log(`✅ ${this.serviceName}: Återansluten till ${channelName}`);
      } catch (error) {
        console.error(`❌ ${this.serviceName}: Återanslutning misslyckades för ${channelName}:`, error);
        await this.handleReconnection(channelName);
      }
    }, delay);

    this.reconnectTimeouts.set(channelName, timeout);
  }

  /**
   * Extraherar presence-states från Supabase presence-objekt
   */
  private extractPresenceStates(presenceState: any): PresenceState[] {
    const states: PresenceState[] = [];
    
    Object.entries(presenceState).forEach(([key, presences]: [string, any]) => {
      if (Array.isArray(presences) && presences.length > 0) {
        const presence = this.extractPresenceState(key, presences[0]);
        if (presence) {
          states.push(presence);
        }
      }
    });

    return states;
  }

  /**
   * Extraherar enskild presence-state
   */
  private extractPresenceState(key: string, presence: any): PresenceState | null {
    try {
      return {
        userId: presence.userId || key,
        status: presence.status || 'online',
        lastSeen: presence.lastSeen || new Date().toISOString(),
        metadata: presence.metadata || {}
      };
    } catch (error) {
      console.warn(`Kunde inte extrahera presence för ${key}:`, error);
      return null;
    }
  }

  /**
   * Rensar alla realtime-resurser
   */
  protected async cleanupRealtimeResources(): Promise<void> {
    try {
      // Avsluta alla timeouts
      this.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
      this.reconnectTimeouts.clear();

      // Avsluta alla prenumerationer
      for (const [channelName, subscription] of this.subscriptions) {
        try {
          await subscription.channel.unsubscribe();
          console.log(`✅ ${this.serviceName}: Avslutade prenumeration på ${channelName}`);
        } catch (error) {
          console.error(`❌ ${this.serviceName}: Fel vid avslutning av ${channelName}:`, error);
        }
      }

      this.subscriptions.clear();
      this.presenceStates.clear();
      this.rateLimitMap.clear();

      console.log(`✅ ${this.serviceName}: Realtime-resurser rensade`);
    } catch (error) {
      console.error(`❌ ${this.serviceName}: Fel vid rensning av realtime-resurser:`, error);
    }
  }
}
