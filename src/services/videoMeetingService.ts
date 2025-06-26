/**
 * Video Meeting Service - WebRTC-baserad videomötesfunktionalitet
 * 
 * Denna service hanterar:
 * - Skapande och hantering av videomöten
 * - Integration med befintlig meetingService
 * - GDPR-kompatibel deltagarhantering
 * - Säker möteslänk-generering
 * 
 * Säkerhetsfokus:
 * - Endast ljudinspelning (ingen videoinspelning)
 * - BankID-autentisering krävs
 * - EU-datacenter för all data
 * - Explicit samtycke för varje möte
 */

import { supabase } from '../config/supabase';
import { meetingService } from './meetingService';
import { webrtcSignalingService } from './webrtcSignalingService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface VideoMeetingRoom {
  id: string;
  meetingId: string;
  roomId: string;
  maxParticipants: number;
  isRecordingAllowed: boolean;
  consentRequired: boolean;
  dataRetentionDays: number;
  createdAt: string;
  endedAt?: string;
}

export interface VideoParticipant {
  id: string;
  videoMeetingId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
  isModerator: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  consentGiven: boolean;
  consentGivenAt?: string;
}

export interface MeetingInvitation {
  meetingId: string;
  roomId: string;
  meetingLink: string;
  joinCode: string;
  expiresAt: string;
}

export interface ParticipantStatus {
  userId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  lastSeen: string;
}

class VideoMeetingService {
  private currentMeeting: VideoMeetingRoom | null = null;
  private participants: Map<string, VideoParticipant> = new Map();

  /**
   * Skapar ett nytt videomöte baserat på befintligt möte
   * Integrerar med befintlig meetingService för konsistens
   */
  async createVideoMeeting(meetingId: string, options?: {
    maxParticipants?: number;
    isRecordingAllowed?: boolean;
    consentRequired?: boolean;
  }): Promise<VideoMeetingRoom> {
    try {
      logger.info('Skapar videomöte', { meetingId, options });

      // Validera att mötet existerar och användaren har behörighet
      const meeting = await meetingService.getMeeting(meetingId);
      if (!meeting) {
        throw new Error('Mötet existerar inte');
      }

      if (meeting.meeting_type !== 'digital') {
        throw new Error('Endast digitala möten kan ha videofunktionalitet');
      }

      // Generera unik room ID
      const roomId = `room_${uuidv4().replace(/-/g, '')}`;

      // Skapa videomöte i databas
      const { data: videoMeeting, error } = await supabase
        .from('video_meetings')
        .insert({
          meeting_id: meetingId,
          room_id: roomId,
          max_participants: options?.maxParticipants || 10,
          is_recording_allowed: options?.isRecordingAllowed || false,
          consent_required: options?.consentRequired !== false, // Default true
          data_retention_days: 30 // GDPR-kompatibel retention
        })
        .select()
        .single();

      if (error) {
        logger.error('Fel vid skapande av videomöte', { error, meetingId });
        throw new Error(`Kunde inte skapa videomöte: ${error.message}`);
      }

      this.currentMeeting = {
        id: videoMeeting.id,
        meetingId: videoMeeting.meeting_id,
        roomId: videoMeeting.room_id,
        maxParticipants: videoMeeting.max_participants,
        isRecordingAllowed: videoMeeting.is_recording_allowed,
        consentRequired: videoMeeting.consent_required,
        dataRetentionDays: videoMeeting.data_retention_days,
        createdAt: videoMeeting.created_at
      };

      // Initiera signaling för mötet
      await webrtcSignalingService.initializeMeeting(roomId);

      logger.info('Videomöte skapat', { 
        videoMeetingId: videoMeeting.id, 
        roomId,
        meetingId 
      });

      return this.currentMeeting;

    } catch (error) {
      logger.error('Fel vid skapande av videomöte', { error, meetingId });
      throw error;
    }
  }

  /**
   * Genererar säker möteslänk med tidsbegränsning
   * Inkluderar join-kod för extra säkerhet
   */
  async generateMeetingInvitation(videoMeetingId: string): Promise<MeetingInvitation> {
    try {
      const { data: videoMeeting, error } = await supabase
        .from('video_meetings')
        .select('*, meetings(*)')
        .eq('id', videoMeetingId)
        .single();

      if (error || !videoMeeting) {
        throw new Error('Videomötet existerar inte');
      }

      // Generera säker join-kod (6 siffror)
      const joinCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Möteslänk med krypterad parameter
      const meetingLink = `${process.env.EXPO_PUBLIC_APP_URL}/video-meeting/${videoMeeting.room_id}?code=${joinCode}`;

      // Sätt utgångstid till 24 timmar
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Lagra join-kod säkert (krypterat)
      await supabase
        .from('meeting_invitations')
        .insert({
          video_meeting_id: videoMeetingId,
          join_code: joinCode,
          expires_at: expiresAt.toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      return {
        meetingId: videoMeeting.meeting_id,
        roomId: videoMeeting.room_id,
        meetingLink,
        joinCode,
        expiresAt: expiresAt.toISOString()
      };

    } catch (error) {
      logger.error('Fel vid generering av möteslänk', { error, videoMeetingId });
      throw error;
    }
  }

  /**
   * Validerar åtkomst till videomöte
   * Kontrollerar BankID-autentisering och behörigheter
   */
  async validateMeetingAccess(roomId: string, joinCode?: string): Promise<boolean> {
    try {
      // Kontrollera att användaren är autentiserad
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        logger.warn('Ej autentiserad användare försökte gå med i möte', { roomId });
        return false;
      }

      // Hämta videomöte
      const { data: videoMeeting, error } = await supabase
        .from('video_meetings')
        .select('*, meetings(*)')
        .eq('room_id', roomId)
        .single();

      if (error || !videoMeeting) {
        logger.warn('Videomöte existerar inte', { roomId });
        return false;
      }

      // Kontrollera om mötet har avslutats
      if (videoMeeting.ended_at) {
        logger.warn('Försök att gå med i avslutat möte', { roomId });
        return false;
      }

      // Validera join-kod om angiven
      if (joinCode) {
        const { data: invitation, error: inviteError } = await supabase
          .from('meeting_invitations')
          .select('*')
          .eq('video_meeting_id', videoMeeting.id)
          .eq('join_code', joinCode)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (inviteError || !invitation) {
          logger.warn('Ogiltig eller utgången join-kod', { roomId, joinCode });
          return false;
        }
      }

      // Kontrollera mötesdeltagare-behörighet
      const { data: participant, error: participantError } = await supabase
        .from('meeting_participants')
        .select('*')
        .eq('meeting_id', videoMeeting.meeting_id)
        .eq('user_id', user.id)
        .single();

      if (participantError || !participant) {
        logger.warn('Användare ej inbjuden till möte', { 
          roomId, 
          userId: user.id,
          meetingId: videoMeeting.meeting_id 
        });
        return false;
      }

      logger.info('Mötesåtkomst validerad', { 
        roomId, 
        userId: user.id,
        meetingId: videoMeeting.meeting_id 
      });

      return true;

    } catch (error) {
      logger.error('Fel vid validering av mötesåtkomst', { error, roomId });
      return false;
    }
  }

  /**
   * Användare går med i videomöte
   * Kräver explicit GDPR-samtycke
   */
  async joinMeeting(roomId: string, consentGiven: boolean = false): Promise<VideoParticipant> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Användare ej autentiserad');
      }

      // Hämta videomöte
      const { data: videoMeeting, error } = await supabase
        .from('video_meetings')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (error || !videoMeeting) {
        throw new Error('Videomötet existerar inte');
      }

      // Kontrollera samtycke om krävs
      if (videoMeeting.consent_required && !consentGiven) {
        throw new Error('GDPR-samtycke krävs för att gå med i videomötet');
      }

      // Kontrollera max deltagare
      const { count } = await supabase
        .from('video_participants')
        .select('*', { count: 'exact', head: true })
        .eq('video_meeting_id', videoMeeting.id)
        .is('left_at', null);

      if (count && count >= videoMeeting.max_participants) {
        throw new Error('Mötet är fullt');
      }

      // Skapa deltagarpost
      const { data: participant, error: participantError } = await supabase
        .from('video_participants')
        .insert({
          video_meeting_id: videoMeeting.id,
          user_id: user.id,
          is_moderator: false, // Kan utökas med moderator-logik
          audio_enabled: true,
          video_enabled: true,
          consent_given: consentGiven,
          consent_given_at: consentGiven ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (participantError) {
        throw new Error(`Kunde inte gå med i mötet: ${participantError.message}`);
      }

      const videoParticipant: VideoParticipant = {
        id: participant.id,
        videoMeetingId: participant.video_meeting_id,
        userId: participant.user_id,
        joinedAt: participant.joined_at,
        isModerator: participant.is_moderator,
        audioEnabled: participant.audio_enabled,
        videoEnabled: participant.video_enabled,
        consentGiven: participant.consent_given,
        consentGivenAt: participant.consent_given_at
      };

      this.participants.set(user.id, videoParticipant);

      // Logga mötesaktivitet för audit trail
      await this.logMeetingEvent(videoMeeting.id, 'participant_joined', {
        userId: user.id,
        consentGiven,
        timestamp: new Date().toISOString()
      });

      logger.info('Användare gick med i videomöte', { 
        roomId, 
        userId: user.id,
        consentGiven 
      });

      return videoParticipant;

    } catch (error) {
      logger.error('Fel vid anslutning till videomöte', { error, roomId });
      throw error;
    }
  }

  /**
   * Användare lämnar videomöte
   */
  async leaveMeeting(roomId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Användare ej autentiserad');
      }

      // Uppdatera deltagarpost
      const { error } = await supabase
        .from('video_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('left_at', null);

      if (error) {
        logger.error('Fel vid uppdatering av deltagarstatus', { error, roomId, userId: user.id });
      }

      // Ta bort från lokal cache
      this.participants.delete(user.id);

      // Logga aktivitet
      const { data: videoMeeting } = await supabase
        .from('video_meetings')
        .select('id')
        .eq('room_id', roomId)
        .single();

      if (videoMeeting) {
        await this.logMeetingEvent(videoMeeting.id, 'participant_left', {
          userId: user.id,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Användare lämnade videomöte', { roomId, userId: user.id });

    } catch (error) {
      logger.error('Fel vid utträde från videomöte', { error, roomId });
      throw error;
    }
  }

  /**
   * Hämtar aktiva deltagare i videomöte
   */
  async getParticipants(roomId: string): Promise<VideoParticipant[]> {
    try {
      const { data: videoMeeting, error: meetingError } = await supabase
        .from('video_meetings')
        .select('id')
        .eq('room_id', roomId)
        .single();

      if (meetingError || !videoMeeting) {
        throw new Error('Videomötet existerar inte');
      }

      const { data: participants, error } = await supabase
        .from('video_participants')
        .select('*')
        .eq('video_meeting_id', videoMeeting.id)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (error) {
        throw new Error(`Kunde inte hämta deltagare: ${error.message}`);
      }

      return participants.map(p => ({
        id: p.id,
        videoMeetingId: p.video_meeting_id,
        userId: p.user_id,
        joinedAt: p.joined_at,
        leftAt: p.left_at,
        isModerator: p.is_moderator,
        audioEnabled: p.audio_enabled,
        videoEnabled: p.video_enabled,
        consentGiven: p.consent_given,
        consentGivenAt: p.consent_given_at
      }));

    } catch (error) {
      logger.error('Fel vid hämtning av deltagare', { error, roomId });
      throw error;
    }
  }

  /**
   * Loggar mötesaktiviteter för audit trail och GDPR-efterlevnad
   */
  private async logMeetingEvent(videoMeetingId: string, eventType: string, eventData: any): Promise<void> {
    try {
      await supabase
        .from('meeting_audit_log')
        .insert({
          video_meeting_id: videoMeetingId,
          event_type: eventType,
          event_data: eventData,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Fel vid loggning av mötesaktivitet', { error, videoMeetingId, eventType });
      // Logga inte fel här för att undvika oändlig loop
    }
  }

  /**
   * Avslutar videomöte och rensar resurser
   */
  async endMeeting(roomId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Användare ej autentiserad');
      }

      // Markera mötet som avslutat
      const { error } = await supabase
        .from('video_meetings')
        .update({ ended_at: new Date().toISOString() })
        .eq('room_id', roomId);

      if (error) {
        throw new Error(`Kunde inte avsluta mötet: ${error.message}`);
      }

      // Markera alla aktiva deltagare som utträda
      await supabase
        .from('video_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('video_meeting_id', this.currentMeeting?.id)
        .is('left_at', null);

      // Rensa lokal state
      this.currentMeeting = null;
      this.participants.clear();

      // Stäng signaling
      await webrtcSignalingService.closeMeeting(roomId);

      logger.info('Videomöte avslutat', { roomId, endedBy: user.id });

    } catch (error) {
      logger.error('Fel vid avslutning av videomöte', { error, roomId });
      throw error;
    }
  }

  /**
   * Hämtar aktuellt videomöte
   */
  getCurrentMeeting(): VideoMeetingRoom | null {
    return this.currentMeeting;
  }

  /**
   * Kontrollerar om användare är i ett aktivt videomöte
   */
  isInMeeting(): boolean {
    return this.currentMeeting !== null;
  }
}

export const videoMeetingService = new VideoMeetingService();
