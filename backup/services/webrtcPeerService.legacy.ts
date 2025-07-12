/**
 * WebRTC Peer Connection Service - Hanterar WebRTC peer-to-peer anslutningar
 * 
 * Denna service hanterar:
 * - RTCPeerConnection setup och konfiguration
 * - Media stream hantering (audio/video)
 * - ICE candidate hantering
 * - SDP offer/answer exchange
 * - Säker konfiguration för svenska användare
 * 
 * Säkerhetsfokus:
 * - End-to-end kryptering via DTLS/SRTP
 * - EU-baserade STUN/TURN servrar
 * - Säker ICE candidate hantering
 * - Automatisk återanslutning vid nätverksproblem
 */

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
  registerGlobals
} from '@livekit/react-native-webrtc';
import { Platform } from 'react-native';
import { ServiceFactory } from './ServiceFactory';
import { RTCSignal } from './webrtcSignalingService';
import { logger } from '../utils/logger';

// Registrera WebRTC globals för kompatibilitet
registerGlobals();

export interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
  bundlePolicy?: 'balanced' | 'max-compat' | 'max-bundle';
  rtcpMuxPolicy?: 'negotiate' | 'require';
  iceCandidatePoolSize?: number;
}

export interface MediaConstraints {
  audio: boolean | MediaTrackConstraints;
  video: boolean | MediaTrackConstraints;
}

export interface PeerConnectionCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream, userId: string) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState, userId: string) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState, userId: string) => void;
  onError?: (error: Error, userId?: string) => void;
}

export interface RemotePeer {
  userId: string;
  peerConnection: RTCPeerConnection;
  remoteStream?: MediaStream;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  isOfferer: boolean;
}

class WebRTCPeerService {
  private localStream: MediaStream | null = null;
  private remotePeers: Map<string, RemotePeer> = new Map();
  private callbacks: PeerConnectionCallbacks = {};
  private roomId: string | null = null;
  private currentUserId: string | null = null;
  private isInitialized: boolean = false;
  private signalingService: any = null; // Cache för WebRTC signaling service

  /**
   * Hämtar WebRTC signaling service via ServiceFactory
   * Cachar instansen för prestanda
   */
  private async getSignalingService(): Promise<any> {
    if (!this.signalingService) {
      try {
        const result = await ServiceFactory.getWebRTCSignalingService();
        this.signalingService = result.service;
        logger.debug('WebRTC signaling service laddad via ServiceFactory', {
          isMigrated: result.isMigrated,
          loadTime: result.loadTime
        });
      } catch (error) {
        logger.error('Fel vid laddning av WebRTC signaling service', { error });
        throw new Error(`Kunde inte ladda WebRTC signaling service: ${error.message}`);
      }
    }
    return this.signalingService;
  }

  /**
   * Säker WebRTC konfiguration för svenska användare
   */
  private getPeerConnectionConfig(): PeerConnectionConfig {
    const config: PeerConnectionConfig = {
      iceServers: [
        // Gratis Google STUN server
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        
        // EU-baserade TURN servrar (konfigureras via miljövariabler)
        ...(process.env.EXPO_PUBLIC_TURN_SERVER_URL ? [{
          urls: process.env.EXPO_PUBLIC_TURN_SERVER_URL,
          username: process.env.EXPO_PUBLIC_TURN_USERNAME || '',
          credential: process.env.EXPO_PUBLIC_TURN_PASSWORD || ''
        }] : [])
      ],
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    };

    // Web-specifika inställningar
    if (Platform.OS === 'web') {
      config.bundlePolicy = 'max-bundle';
    }

    return config;
  }

  /**
   * Media constraints för svenska GDPR-efterlevnad
   */
  private getMediaConstraints(): MediaConstraints {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000, // Hög kvalitet för protokollinspelning
      },
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: 'user'
      }
    };
  }

  /**
   * Initialiserar WebRTC peer service
   */
  async initialize(roomId: string, userId: string, callbacks: PeerConnectionCallbacks): Promise<void> {
    try {
      logger.info('Initialiserar WebRTC peer service', { roomId, userId });

      this.roomId = roomId;
      this.currentUserId = userId;
      this.callbacks = callbacks;

      // Hämta lokal media stream
      await this.setupLocalStream();

      // Konfigurera signaling callbacks via ServiceFactory
      const signalingService = await this.getSignalingService();
      signalingService.setCallbacks({
        onSignalReceived: this.handleSignalingMessage.bind(this),
        onParticipantJoined: this.handleParticipantJoined.bind(this),
        onParticipantLeft: this.handleParticipantLeft.bind(this),
        onError: (error) => this.callbacks.onError?.(error)
      });

      this.isInitialized = true;
      logger.info('WebRTC peer service initialiserat', { roomId, userId });

    } catch (error) {
      logger.error('Fel vid initialisering av WebRTC peer service', { error, roomId, userId });
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Sätter upp lokal media stream
   */
  private async setupLocalStream(): Promise<void> {
    try {
      const constraints = this.getMediaConstraints();
      
      // Begär behörigheter och hämta media stream
      this.localStream = await mediaDevices.getUserMedia(constraints);

      logger.info('Lokal media stream skapad', {
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length
      });

      // Notifiera callback
      this.callbacks.onLocalStream?.(this.localStream);

    } catch (error) {
      logger.error('Fel vid skapande av lokal media stream', { error });
      
      // Försök med endast audio om video misslyckas
      try {
        this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
        logger.warn('Fallback till endast audio', {
          audioTracks: this.localStream.getAudioTracks().length
        });
        this.callbacks.onLocalStream?.(this.localStream);
      } catch (audioError) {
        logger.error('Kunde inte få åtkomst till mikrofon', { audioError });
        throw new Error('Kunde inte få åtkomst till mikrofon eller kamera');
      }
    }
  }

  /**
   * Skapar peer connection för ny deltagare
   */
  private async createPeerConnection(userId: string, isOfferer: boolean): Promise<RTCPeerConnection> {
    try {
      const config = this.getPeerConnectionConfig();
      const peerConnection = new RTCPeerConnection(config);

      // Lägg till lokal stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.localStream!);
        });
      }

      // Event listeners
      peerConnection.addEventListener('connectionstatechange', () => {
        const state = peerConnection.connectionState;
        logger.debug('Peer connection state ändrad', { userId, state });
        
        const peer = this.remotePeers.get(userId);
        if (peer) {
          peer.connectionState = state;
          this.callbacks.onConnectionStateChange?.(state, userId);
        }

        // Hantera frånkoppling
        if (state === 'disconnected' || state === 'failed') {
          this.handlePeerDisconnection(userId);
        }
      });

      peerConnection.addEventListener('iceconnectionstatechange', () => {
        const state = peerConnection.iceConnectionState;
        logger.debug('ICE connection state ändrad', { userId, state });
        
        const peer = this.remotePeers.get(userId);
        if (peer) {
          peer.iceConnectionState = state;
          this.callbacks.onIceConnectionStateChange?.(state, userId);
        }

        // Försök återanslutning vid problem
        if (state === 'failed') {
          this.attemptReconnection(userId);
        }
      });

      peerConnection.addEventListener('icecandidate', async (event) => {
        if (event.candidate) {
          logger.debug('ICE candidate genererad', { userId });

          const signalingService = await this.getSignalingService();
          await signalingService.sendSignal(this.roomId!, {
            fromUserId: this.currentUserId!,
            toUserId: userId,
            signalType: 'ice-candidate',
            signalData: {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid
            }
          });
        }
      });

      peerConnection.addEventListener('track', (event) => {
        logger.info('Remote track mottagen', { userId, trackKind: event.track.kind });
        
        const peer = this.remotePeers.get(userId);
        if (peer && event.streams[0]) {
          peer.remoteStream = event.streams[0];
          this.callbacks.onRemoteStream?.(event.streams[0], userId);
        }
      });

      peerConnection.addEventListener('negotiationneeded', async () => {
        if (isOfferer) {
          logger.debug('Negotiation needed - skapar offer', { userId });
          await this.createAndSendOffer(userId, peerConnection);
        }
      });

      return peerConnection;

    } catch (error) {
      logger.error('Fel vid skapande av peer connection', { error, userId });
      throw error;
    }
  }

  /**
   * Skapar och skickar SDP offer
   */
  private async createAndSendOffer(userId: string, peerConnection: RTCPeerConnection): Promise<void> {
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true
      });

      await peerConnection.setLocalDescription(offer);

      const signalingService = await this.getSignalingService();
      await signalingService.sendSignal(this.roomId!, {
        fromUserId: this.currentUserId!,
        toUserId: userId,
        signalType: 'offer',
        signalData: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      logger.debug('SDP offer skickat', { userId });

    } catch (error) {
      logger.error('Fel vid skapande av offer', { error, userId });
      throw error;
    }
  }

  /**
   * Skapar och skickar SDP answer
   */
  private async createAndSendAnswer(userId: string, peerConnection: RTCPeerConnection): Promise<void> {
    try {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      const signalingService = await this.getSignalingService();
      await signalingService.sendSignal(this.roomId!, {
        fromUserId: this.currentUserId!,
        toUserId: userId,
        signalType: 'answer',
        signalData: {
          type: answer.type,
          sdp: answer.sdp
        }
      });

      logger.debug('SDP answer skickat', { userId });

    } catch (error) {
      logger.error('Fel vid skapande av answer', { error, userId });
      throw error;
    }
  }

  /**
   * Hanterar inkommande signaling-meddelanden
   */
  private async handleSignalingMessage(signal: RTCSignal): Promise<void> {
    try {
      const { fromUserId, signalType, signalData } = signal;

      if (!this.isInitialized || fromUserId === this.currentUserId) {
        return;
      }

      logger.debug('Hanterar signaling-meddelande', { fromUserId, signalType });

      let peer = this.remotePeers.get(fromUserId);

      switch (signalType) {
        case 'offer':
          if (!peer) {
            const peerConnection = await this.createPeerConnection(fromUserId, false);
            peer = {
              userId: fromUserId,
              peerConnection,
              connectionState: 'new',
              iceConnectionState: 'new',
              isOfferer: false
            };
            this.remotePeers.set(fromUserId, peer);
          }

          await peer.peerConnection.setRemoteDescription(
            new RTCSessionDescription(signalData)
          );
          await this.createAndSendAnswer(fromUserId, peer.peerConnection);
          break;

        case 'answer':
          if (peer) {
            await peer.peerConnection.setRemoteDescription(
              new RTCSessionDescription(signalData)
            );
          }
          break;

        case 'ice-candidate':
          if (peer && signalData.candidate) {
            const candidate = new RTCIceCandidate({
              candidate: signalData.candidate,
              sdpMLineIndex: signalData.sdpMLineIndex,
              sdpMid: signalData.sdpMid
            });
            await peer.peerConnection.addIceCandidate(candidate);
          }
          break;
      }

    } catch (error) {
      logger.error('Fel vid hantering av signaling-meddelande', { error, signal });
      this.callbacks.onError?.(error as Error, signal.fromUserId);
    }
  }

  /**
   * Hanterar när ny deltagare går med
   */
  private async handleParticipantJoined(userId: string): Promise<void> {
    try {
      if (userId === this.currentUserId || this.remotePeers.has(userId)) {
        return;
      }

      logger.info('Ny deltagare gick med - skapar peer connection', { userId });

      // Skapa peer connection som offerer
      const peerConnection = await this.createPeerConnection(userId, true);
      const peer: RemotePeer = {
        userId,
        peerConnection,
        connectionState: 'new',
        iceConnectionState: 'new',
        isOfferer: true
      };

      this.remotePeers.set(userId, peer);

    } catch (error) {
      logger.error('Fel vid hantering av ny deltagare', { error, userId });
      this.callbacks.onError?.(error as Error, userId);
    }
  }

  /**
   * Hanterar när deltagare lämnar
   */
  private async handleParticipantLeft(userId: string): Promise<void> {
    try {
      const peer = this.remotePeers.get(userId);
      if (peer) {
        peer.peerConnection.close();
        this.remotePeers.delete(userId);
        logger.info('Deltagare lämnade - peer connection stängd', { userId });
      }
    } catch (error) {
      logger.error('Fel vid hantering av deltagare som lämnade', { error, userId });
    }
  }

  /**
   * Hanterar peer disconnection
   */
  private async handlePeerDisconnection(userId: string): Promise<void> {
    logger.warn('Peer frånkopplad', { userId });
    
    // Vänta lite innan återanslutning för att undvika spam
    setTimeout(() => {
      this.attemptReconnection(userId);
    }, 2000);
  }

  /**
   * Försöker återanslutning till peer
   */
  private async attemptReconnection(userId: string): Promise<void> {
    try {
      const peer = this.remotePeers.get(userId);
      if (!peer) return;

      logger.info('Försöker återanslutning', { userId });

      // Stäng befintlig connection
      peer.peerConnection.close();

      // Skapa ny connection
      const newPeerConnection = await this.createPeerConnection(userId, peer.isOfferer);
      peer.peerConnection = newPeerConnection;
      peer.connectionState = 'new';
      peer.iceConnectionState = 'new';

      // Initiera ny handshake om vi är offerer
      if (peer.isOfferer) {
        await this.createAndSendOffer(userId, newPeerConnection);
      }

    } catch (error) {
      logger.error('Fel vid återanslutning', { error, userId });
      this.callbacks.onError?.(error as Error, userId);
    }
  }

  /**
   * Stänger av/på mikrofon
   */
  async toggleAudio(enabled: boolean): Promise<void> {
    try {
      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = enabled;
        });

        // Uppdatera presence via ServiceFactory
        const signalingService = await this.getSignalingService();
        await signalingService.updatePresence(this.roomId!, {
          audioEnabled: enabled
        });

        logger.info('Audio togglad', { enabled });
      }
    } catch (error) {
      logger.error('Fel vid toggle av audio', { error, enabled });
      throw error;
    }
  }

  /**
   * Stänger av/på kamera
   */
  async toggleVideo(enabled: boolean): Promise<void> {
    try {
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = enabled;
        });

        // Uppdatera presence via ServiceFactory
        const signalingService = await this.getSignalingService();
        await signalingService.updatePresence(this.roomId!, {
          videoEnabled: enabled
        });

        logger.info('Video togglad', { enabled });
      }
    } catch (error) {
      logger.error('Fel vid toggle av video', { error, enabled });
      throw error;
    }
  }

  /**
   * Hämtar lokal stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Hämtar remote stream för specifik användare
   */
  getRemoteStream(userId: string): MediaStream | null {
    const peer = this.remotePeers.get(userId);
    return peer?.remoteStream || null;
  }

  /**
   * Hämtar alla remote peers
   */
  getRemotePeers(): RemotePeer[] {
    return Array.from(this.remotePeers.values());
  }

  /**
   * Stänger alla peer connections och rensar resurser
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Rensar WebRTC peer service');

      // Stäng alla peer connections
      this.remotePeers.forEach(peer => {
        peer.peerConnection.close();
      });
      this.remotePeers.clear();

      // Stoppa lokal stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      this.isInitialized = false;
      this.roomId = null;
      this.currentUserId = null;

      logger.info('WebRTC peer service rensat');

    } catch (error) {
      logger.error('Fel vid rensning av WebRTC peer service', { error });
      throw error;
    }
  }
}

export const webrtcPeerService = new WebRTCPeerService();
