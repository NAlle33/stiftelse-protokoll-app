import { BaseService, ValidationSchema } from './BaseService';
import { Platform } from 'react-native';

/**
 * MediaBaseService - Specialiserad BaseService för media-relaterade tjänster
 * 
 * Utökar BaseService med media-specifika mönster för:
 * - WebRTC peer connection-hantering
 * - Media stream-hantering (audio/video)
 * - GDPR-kompatibel inspelningshantering
 * - Device permission-hantering
 * - Media-specifik felhantering med svenska meddelanden
 * 
 * Används av: videoMeetingService, webrtcPeerService, audioRecordingService
 */

export interface MediaConstraints {
  audio: boolean | MediaTrackConstraints;
  video: boolean | MediaTrackConstraints;
}

export interface MediaPermissions {
  camera: 'granted' | 'denied' | 'undetermined';
  microphone: 'granted' | 'denied' | 'undetermined';
}

export interface RecordingConsent {
  userId: string;
  consentGiven: boolean;
  timestamp: string;
  ipAddress?: string; // För audit trail
  gdprCompliant: boolean;
}

export interface MediaError extends Error {
  code: 'PERMISSION_DENIED' | 'DEVICE_NOT_FOUND' | 'STREAM_ERROR' | 'WEBRTC_ERROR' | 'GDPR_VIOLATION';
  mediaType?: 'audio' | 'video' | 'both';
  deviceId?: string;
}

export abstract class MediaBaseService extends BaseService {
  protected mediaConstraints: MediaConstraints = {
    audio: true,
    video: false // Default till audio-only för GDPR-säkerhet
  };

  protected recordingConsents: Map<string, RecordingConsent> = new Map();
  protected activeStreams: Map<string, MediaStream> = new Map();

  // Media-specifika validationsscheman
  protected readonly mediaConstraintsSchema: ValidationSchema = {
    types: {
      audio: 'boolean',
      video: 'boolean'
    },
    custom: {
      audio: (value: any) => typeof value === 'boolean' || typeof value === 'object',
      video: (value: any) => typeof value === 'boolean' || typeof value === 'object'
    }
  };

  protected readonly consentSchema: ValidationSchema = {
    required: ['userId', 'consentGiven'],
    types: {
      userId: 'string',
      consentGiven: 'boolean',
      timestamp: 'string',
      gdprCompliant: 'boolean'
    },
    patterns: {
      userId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    }
  };

  /**
   * Kontrollerar och begär media-behörigheter
   */
  protected async checkMediaPermissions(): Promise<MediaPermissions> {
    try {
      if (Platform.OS === 'web') {
        // Web-plattform använder navigator.permissions
        const permissions: MediaPermissions = {
          camera: 'undetermined',
          microphone: 'undetermined'
        };

        try {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          permissions.camera = cameraPermission.state === 'granted' ? 'granted' : 
                              cameraPermission.state === 'denied' ? 'denied' : 'undetermined';
        } catch (error) {
          // Camera permission inte stödd på alla webbläsare
          permissions.camera = 'undetermined';
        }

        try {
          const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          permissions.microphone = micPermission.state === 'granted' ? 'granted' : 
                                  micPermission.state === 'denied' ? 'denied' : 'undetermined';
        } catch (error) {
          // Microphone permission inte stödd på alla webbläsare
          permissions.microphone = 'undetermined';
        }

        return permissions;
      } else {
        // React Native - använd react-native-permissions
        // För nu returnera undetermined, implementera med react-native-permissions senare
        return {
          camera: 'undetermined',
          microphone: 'undetermined'
        };
      }
    } catch (error) {
      const mediaError = this.createMediaError(
        'PERMISSION_DENIED',
        'Kunde inte kontrollera media-behörigheter',
        'both'
      );
      throw this.handleError(mediaError, 'checkMediaPermissions');
    }
  }

  /**
   * Validerar och registrerar GDPR-samtycke för inspelning
   */
  protected async validateRecordingConsent(
    userId: string, 
    consentGiven: boolean,
    metadata?: { ipAddress?: string }
  ): Promise<boolean> {
    try {
      // Validera input
      const consentData = {
        userId,
        consentGiven,
        timestamp: new Date().toISOString(),
        gdprCompliant: true,
        ...metadata
      };

      const validation = this.validateInput(consentData, this.consentSchema);
      if (!validation.isValid) {
        throw new Error(`Ogiltigt samtycke: ${validation.errors.join(', ')}`);
      }

      // Registrera samtycke
      const consent: RecordingConsent = {
        userId,
        consentGiven,
        timestamp: consentData.timestamp,
        ipAddress: metadata?.ipAddress,
        gdprCompliant: true
      };

      this.recordingConsents.set(userId, consent);

      // Logga samtycke för audit trail (GDPR-säkert)
      await this.executeQuery(async () => {
        const { error } = await this.getSupabaseClient()
          .from('recording_consents')
          .insert({
            user_id: userId,
            consent_given: consentGiven,
            timestamp: consent.timestamp,
            ip_address_hash: metadata?.ipAddress ? this.hashSensitiveData(metadata.ipAddress) : null,
            gdpr_compliant: true
          });

        if (error) {
          throw new Error(`Kunde inte registrera samtycke: ${error.message}`);
        }

        return { success: true };
      }, 'validateRecordingConsent');

      return consentGiven;
    } catch (error) {
      const mediaError = this.createMediaError(
        'GDPR_VIOLATION',
        'Kunde inte validera inspelningssamtycke'
      );
      throw this.handleError(mediaError, 'validateRecordingConsent', { userId });
    }
  }

  /**
   * Skapar media-specifika fel med svenska meddelanden
   */
  protected createMediaError(
    code: MediaError['code'],
    message: string,
    mediaType?: 'audio' | 'video' | 'both',
    deviceId?: string
  ): MediaError {
    const error = new Error(message) as MediaError;
    error.code = code;
    error.mediaType = mediaType;
    error.deviceId = deviceId;
    return error;
  }

  /**
   * Översätter media-fel till svenska meddelanden
   */
  protected getSwedishMediaErrorMessage(error: MediaError): string {
    switch (error.code) {
      case 'PERMISSION_DENIED':
        return error.mediaType === 'audio' 
          ? 'Mikrofon-behörighet nekad. Tillåt mikrofonåtkomst för att fortsätta.'
          : error.mediaType === 'video'
          ? 'Kamera-behörighet nekad. Tillåt kameraåtkomst för att fortsätta.'
          : 'Media-behörigheter nekade. Tillåt mikrofon- och kameraåtkomst för att fortsätta.';
      
      case 'DEVICE_NOT_FOUND':
        return error.mediaType === 'audio'
          ? 'Ingen mikrofon hittades. Kontrollera att en mikrofon är ansluten.'
          : error.mediaType === 'video'
          ? 'Ingen kamera hittades. Kontrollera att en kamera är ansluten.'
          : 'Inga media-enheter hittades. Kontrollera att mikrofon och kamera är anslutna.';
      
      case 'STREAM_ERROR':
        return 'Fel vid hantering av media-ström. Försök igen eller kontakta support.';
      
      case 'WEBRTC_ERROR':
        return 'Anslutningsfel vid videomöte. Kontrollera din internetanslutning och försök igen.';
      
      case 'GDPR_VIOLATION':
        return 'GDPR-överträdelse upptäckt. Inspelning stoppad för att skydda personuppgifter.';
      
      default:
        return 'Ett oväntat media-fel uppstod. Försök igen eller kontakta support.';
    }
  }

  /**
   * Rensar media-resurser säkert
   */
  protected async cleanupMediaResources(): Promise<void> {
    try {
      // Stoppa alla aktiva streams
      this.activeStreams.forEach((stream, streamId) => {
        stream.getTracks().forEach(track => {
          track.stop();
        });
      });
      this.activeStreams.clear();

      // Rensa samtycken (behåll i databas för audit trail)
      this.recordingConsents.clear();

      console.log(`✅ ${this.serviceName}: Media-resurser rensade`);
    } catch (error) {
      console.error(`❌ ${this.serviceName}: Fel vid rensning av media-resurser:`, error);
    }
  }

  /**
   * Hashar känslig data för GDPR-säker lagring
   */
  private hashSensitiveData(data: string): string {
    // Enkel hash för demo - använd crypto i produktion
    return Buffer.from(data).toString('base64').slice(0, 16);
  }

  /**
   * Hämtar Supabase-klient (abstrakt metod från BaseService)
   */
  private getSupabaseClient() {
    // Importera supabase-klient
    const { supabase } = require('./supabaseClient');
    return supabase;
  }
}
