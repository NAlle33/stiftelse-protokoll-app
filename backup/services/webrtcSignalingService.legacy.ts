/**
 * WebRTC Signaling Service - Supabase Realtime-baserad signaling
 * 
 * Denna service hanterar:
 * - WebRTC signaling via Supabase Realtime
 * - Säker överföring av SDP offers/answers
 * - ICE candidate exchange
 * - Deltagarstatus och närvaro
 * 
 * Säkerhetsfokus:
 * - Krypterad signaling via HTTPS/WSS
 * - Validering av alla meddelanden
 * - Rate limiting för att förhindra spam
 * - Audit logging av all signaling-aktivitet
 */

import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface RTCSignal {
  id: string;
  meetingId: string;
  fromUserId: string;
  toUserId?: string; // undefined för broadcast
  signalType: 'offer' | 'answer' | 'ice-candidate' | 'participant-status' | 'meeting-control';
  signalData: any;
  timestamp: string;
}

export interface ParticipantPresence {
  userId: string;
  status: 'online' | 'offline' | 'connecting';
  lastSeen: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface SignalingCallbacks {
  onSignalReceived?: (signal: RTCSignal) => void;
  onParticipantJoined?: (userId: string) => void;
  onParticipantLeft?: (userId: string) => void;
  onParticipantStatusChanged?: (presence: ParticipantPresence) => void;
  onMeetingEnded?: () => void;
  onError?: (error: Error) => void;
}

class WebRTCSignalingService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private callbacks: SignalingCallbacks = {};
  private currentRoomId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private rateLimitMap: Map<string, number[]> = new Map();

  /**
   * Initialiserar signaling för ett specifikt möte
   */
  async initializeMeeting(roomId: string): Promise<void> {
    try {
      logger.info('Initialiserar WebRTC signaling', { roomId });

      // Stäng befintlig kanal om den finns
      if (this.currentRoomId && this.channels.has(this.currentRoomId)) {
        await this.closeMeeting(this.currentRoomId);
      }

      this.currentRoomId = roomId;

      // Skapa Supabase Realtime-kanal för mötet
      const channel = supabase.channel(`video-meeting-${roomId}`, {
        config: {
          presence: {
            key: roomId,
          },
        },
      });

      // Lyssna på signaling-meddelanden
      channel
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `meeting_id=eq.${roomId}`,
        }, (payload) => {
          this.handleSignalingMessage(payload.new as any);
        })
        .on('presence', { event: 'sync' }, () => {
          this.handlePresenceSync(channel);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          this.handlePresenceJoin(newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          this.handlePresenceLeave(leftPresences);
        });

      // Prenumerera på kanalen
      const status = await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('WebRTC signaling kanal aktiv', { roomId });
          
          // Skicka initial presence
          await this.updatePresence(roomId, {
            status: 'online',
            audioEnabled: true,
            videoEnabled: true,
            lastSeen: new Date().toISOString()
          });
        }
      });

      if (status === 'CHANNEL_ERROR') {
        throw new Error('Kunde inte ansluta till signaling-kanal');
      }

      this.channels.set(roomId, channel);

      // Starta heartbeat för att hålla anslutningen aktiv
      this.startHeartbeat(roomId);

      logger.info('WebRTC signaling initialiserat', { roomId });

    } catch (error) {
      logger.error('Fel vid initialisering av WebRTC signaling', { error, roomId });
      throw error;
    }
  }

  /**
   * Skickar WebRTC signal till andra deltagare
   */
  async sendSignal(roomId: string, signal: Omit<RTCSignal, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Rate limiting - max 10 meddelanden per sekund per användare
      if (!this.checkRateLimit(signal.fromUserId)) {
        logger.warn('Rate limit överskriden för signaling', { 
          userId: signal.fromUserId, 
          roomId 
        });
        return;
      }

      // Validera signal-data
      if (!this.validateSignalData(signal)) {
        logger.warn('Ogiltig signal-data', { signal, roomId });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== signal.fromUserId) {
        throw new Error('Obehörig signaling-försök');
      }

      // Skapa signal-post i databas
      const { error } = await supabase
        .from('webrtc_signals')
        .insert({
          meeting_id: roomId,
          from_user_id: signal.fromUserId,
          to_user_id: signal.toUserId,
          signal_type: signal.signalType,
          signal_data: signal.signalData,
        });

      if (error) {
        throw new Error(`Kunde inte skicka signal: ${error.message}`);
      }

      logger.debug('WebRTC signal skickad', { 
        roomId, 
        signalType: signal.signalType,
        fromUserId: signal.fromUserId,
        toUserId: signal.toUserId 
      });

    } catch (error) {
      logger.error('Fel vid sändning av WebRTC signal', { error, roomId, signal });
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Uppdaterar deltagarens presence-status
   */
  async updatePresence(roomId: string, presence: Partial<ParticipantPresence>): Promise<void> {
    try {
      const channel = this.channels.get(roomId);
      if (!channel) {
        throw new Error('Ingen aktiv signaling-kanal');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Användare ej autentiserad');
      }

      const presenceData = {
        userId: user.id,
        status: presence.status || 'online',
        audioEnabled: presence.audioEnabled ?? true,
        videoEnabled: presence.videoEnabled ?? true,
        lastSeen: new Date().toISOString(),
        ...presence
      };

      await channel.track(presenceData);

      logger.debug('Presence uppdaterad', { roomId, userId: user.id, presence: presenceData });

    } catch (error) {
      logger.error('Fel vid uppdatering av presence', { error, roomId, presence });
      throw error;
    }
  }

  /**
   * Registrerar callbacks för signaling-händelser
   */
  setCallbacks(callbacks: SignalingCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Hanterar inkommande signaling-meddelanden
   */
  private handleSignalingMessage(signalData: any): void {
    try {
      const signal: RTCSignal = {
        id: signalData.id,
        meetingId: signalData.meeting_id,
        fromUserId: signalData.from_user_id,
        toUserId: signalData.to_user_id,
        signalType: signalData.signal_type,
        signalData: signalData.signal_data,
        timestamp: signalData.created_at
      };

      // Kontrollera om meddelandet är riktat till denna användare
      const { data: { user } } = supabase.auth.getUser();
      if (signal.toUserId && user?.data?.user?.id !== signal.toUserId) {
        return; // Meddelandet är inte för oss
      }

      // Ignorera egna meddelanden
      if (user?.data?.user?.id === signal.fromUserId) {
        return;
      }

      logger.debug('WebRTC signal mottagen', { 
        signalType: signal.signalType,
        fromUserId: signal.fromUserId,
        toUserId: signal.toUserId 
      });

      // Hantera olika typer av signaler
      switch (signal.signalType) {
        case 'meeting-control':
          this.handleMeetingControlSignal(signal);
          break;
        default:
          this.callbacks.onSignalReceived?.(signal);
          break;
      }

    } catch (error) {
      logger.error('Fel vid hantering av signaling-meddelande', { error, signalData });
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Hanterar mötesstyrning-signaler
   */
  private handleMeetingControlSignal(signal: RTCSignal): void {
    const { action } = signal.signalData;

    switch (action) {
      case 'meeting-ended':
        logger.info('Mötet avslutades av moderator', { fromUserId: signal.fromUserId });
        this.callbacks.onMeetingEnded?.();
        break;
      case 'participant-removed':
        if (signal.toUserId) {
          logger.info('Deltagare borttagen från möte', { 
            removedUserId: signal.toUserId,
            byUserId: signal.fromUserId 
          });
          this.callbacks.onParticipantLeft?.(signal.toUserId);
        }
        break;
      default:
        this.callbacks.onSignalReceived?.(signal);
        break;
    }
  }

  /**
   * Hanterar presence sync-händelser
   */
  private handlePresenceSync(channel: RealtimeChannel): void {
    const presenceState = channel.presenceState();
    logger.debug('Presence sync', { presenceCount: Object.keys(presenceState).length });

    // Uppdatera deltagarlista baserat på presence
    Object.values(presenceState).forEach((presences: any[]) => {
      presences.forEach((presence) => {
        this.callbacks.onParticipantStatusChanged?.(presence as ParticipantPresence);
      });
    });
  }

  /**
   * Hanterar när deltagare går med
   */
  private handlePresenceJoin(newPresences: any[]): void {
    newPresences.forEach((presence) => {
      logger.info('Deltagare gick med i möte', { userId: presence.userId });
      this.callbacks.onParticipantJoined?.(presence.userId);
      this.callbacks.onParticipantStatusChanged?.(presence as ParticipantPresence);
    });
  }

  /**
   * Hanterar när deltagare lämnar
   */
  private handlePresenceLeave(leftPresences: any[]): void {
    leftPresences.forEach((presence) => {
      logger.info('Deltagare lämnade möte', { userId: presence.userId });
      this.callbacks.onParticipantLeft?.(presence.userId);
    });
  }

  /**
   * Validerar signal-data för säkerhet
   */
  private validateSignalData(signal: Omit<RTCSignal, 'id' | 'timestamp'>): boolean {
    // Grundläggande validering
    if (!signal.fromUserId || !signal.signalType || !signal.signalData) {
      return false;
    }

    // Validera signal-typ
    const validTypes = ['offer', 'answer', 'ice-candidate', 'participant-status', 'meeting-control'];
    if (!validTypes.includes(signal.signalType)) {
      return false;
    }

    // Validera signal-data baserat på typ
    switch (signal.signalType) {
      case 'offer':
      case 'answer':
        return signal.signalData.type && signal.signalData.sdp;
      case 'ice-candidate':
        return signal.signalData.candidate !== undefined;
      case 'participant-status':
        return typeof signal.signalData.audioEnabled === 'boolean' &&
               typeof signal.signalData.videoEnabled === 'boolean';
      case 'meeting-control':
        return signal.signalData.action;
      default:
        return true;
    }
  }

  /**
   * Rate limiting för att förhindra spam
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.rateLimitMap.get(userId) || [];
    
    // Ta bort gamla requests (äldre än 1 sekund)
    const recentRequests = userRequests.filter(timestamp => now - timestamp < 1000);
    
    // Kontrollera om under gränsen (10 requests per sekund)
    if (recentRequests.length >= 10) {
      return false;
    }
    
    // Lägg till ny request
    recentRequests.push(now);
    this.rateLimitMap.set(userId, recentRequests);
    
    return true;
  }

  /**
   * Startar heartbeat för att hålla anslutningen aktiv
   */
  private startHeartbeat(roomId: string): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.updatePresence(roomId, {
          lastSeen: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Heartbeat fel', { error, roomId });
      }
    }, 30000); // 30 sekunder
  }

  /**
   * Stoppar heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Stänger signaling för möte och rensar resurser
   */
  async closeMeeting(roomId: string): Promise<void> {
    try {
      const channel = this.channels.get(roomId);
      if (channel) {
        await channel.unsubscribe();
        this.channels.delete(roomId);
      }

      if (this.currentRoomId === roomId) {
        this.currentRoomId = null;
        this.stopHeartbeat();
      }

      // Rensa rate limit cache
      this.rateLimitMap.clear();

      logger.info('WebRTC signaling stängt', { roomId });

    } catch (error) {
      logger.error('Fel vid stängning av WebRTC signaling', { error, roomId });
      throw error;
    }
  }

  /**
   * Hämtar aktuell room ID
   */
  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  /**
   * Kontrollerar om signaling är aktivt
   */
  isActive(): boolean {
    return this.currentRoomId !== null && this.channels.has(this.currentRoomId);
  }

  /**
   * Hämtar antal aktiva deltagare via presence
   */
  getActiveParticipantCount(roomId: string): number {
    const channel = this.channels.get(roomId);
    if (!channel) return 0;

    const presenceState = channel.presenceState();
    return Object.keys(presenceState).length;
  }
}

export const webrtcSignalingService = new WebRTCSignalingService();
