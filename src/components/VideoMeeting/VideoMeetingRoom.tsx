/**
 * VideoMeetingRoom - Huvudkomponent för videomöten
 * 
 * Denna komponent hanterar:
 * - WebRTC videomötesgränssnitt
 * - Deltagarhantering och kontroller
 * - GDPR-samtycke och säkerhet
 * - Svenska lokaliseringar
 * - Cross-platform kompatibilitet
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { RTCView } from '@livekit/react-native-webrtc';
import { useNavigation, useRoute } from '@react-navigation/native';
import { videoMeetingServiceMigrated as videoMeetingService, VideoParticipant } from '../../services/VideoMeetingServiceMigrated';
import { RemotePeer } from '../../services/WebRTCPeerServiceMigrated';
import { ServiceFactory } from '../../services/ServiceFactory';
import { logger } from '../../utils/logger';
import { colors } from '../../theme/colors';
import { VideoControls } from './VideoControls';
import { ParticipantGrid } from './ParticipantGrid';
import { ParticipantList } from './ParticipantList';
import { MeetingConsent } from './MeetingConsent';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorBoundary } from '../ui/ErrorBoundary';

interface VideoMeetingRoomProps {
  roomId: string;
  meetingId: string;
  onMeetingEnd?: () => void;
}

interface MeetingState {
  isConnecting: boolean;
  isConnected: boolean;
  hasError: boolean;
  errorMessage: string;
  showConsentDialog: boolean;
  participants: VideoParticipant[];
  remotePeers: RemotePeer[];
  localStreamUrl: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isModerator: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const VideoMeetingRoom: React.FC<VideoMeetingRoomProps> = ({
  roomId,
  meetingId,
  onMeetingEnd
}) => {
  const navigation = useNavigation();
  const route = useRoute();

  // Service state
  const [webrtcPeerService, setWebrtcPeerService] = useState<any>(null);

  const [state, setState] = useState<MeetingState>({
    isConnecting: true,
    isConnected: false,
    hasError: false,
    errorMessage: '',
    showConsentDialog: true,
    participants: [],
    remotePeers: [],
    localStreamUrl: null,
    isAudioEnabled: true,
    isVideoEnabled: true,
    isModerator: false
  });

  /**
   * Initialiserar videomöte efter samtycke
   */
  const initializeVideoMeeting = useCallback(async (consentGiven: boolean) => {
    try {
      setState(prev => ({
        ...prev,
        isConnecting: true,
        showConsentDialog: false,
        hasError: false
      }));

      logger.info('Initialiserar videomöte', { roomId, meetingId, consentGiven });

      // Initialisera WebRTC peer service via ServiceFactory
      if (!webrtcPeerService) {
        const serviceResult = await ServiceFactory.getWebRTCPeerService();
        setWebrtcPeerService(serviceResult.service);
        logger.info(`WebRTC Peer Service laddad (${serviceResult.isMigrated ? 'Migrerad' : 'Legacy'}) - ${serviceResult.loadTime}ms`);
      }

      // Validera åtkomst till mötet
      const hasAccess = await videoMeetingService.validateMeetingAccess(roomId);
      if (!hasAccess) {
        throw new Error('Du har inte behörighet att gå med i detta möte');
      }

      // Gå med i mötet
      const participant = await videoMeetingService.joinMeeting(roomId, consentGiven);

      // Hämta användar-ID för WebRTC
      const { data: { user } } = await videoMeetingService['supabase'].auth.getUser();
      if (!user) {
        throw new Error('Användare ej autentiserad');
      }

      // Initialisera WebRTC peer service
      const currentService = webrtcPeerService || (await ServiceFactory.getWebRTCPeerService()).service;
      await currentService.initialize(roomId, user.id, {
        onLocalStream: (stream) => {
          setState(prev => ({
            ...prev,
            localStreamUrl: stream.toURL()
          }));
        },
        onRemoteStream: (stream, userId) => {
          logger.info('Remote stream mottagen', { userId });
          setState(prev => ({
            ...prev,
            remotePeers: currentService.getRemotePeers()
          }));
        },
        onConnectionStateChange: (state, userId) => {
          logger.debug('Connection state ändrad', { userId, state });
          if (state === 'connected') {
            setState(prev => ({ ...prev, isConnected: true }));
          }
        },
        onError: (error, userId) => {
          logger.error('WebRTC fel', { error, userId });
          setState(prev => ({
            ...prev,
            hasError: true,
            errorMessage: `Anslutningsfel: ${error.message}`
          }));
        }
      });

      // Hämta deltagarlista
      const participants = await videoMeetingService.getParticipants(roomId);
      
      setState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: true,
        participants,
        isModerator: participant.isModerator
      }));

      logger.info('Videomöte initialiserat', { roomId, participantCount: participants.length });

    } catch (error) {
      logger.error('Fel vid initialisering av videomöte', { error, roomId });
      setState(prev => ({
        ...prev,
        isConnecting: false,
        hasError: true,
        errorMessage: error instanceof Error ? error.message : 'Okänt fel uppstod'
      }));
    }
  }, [roomId, meetingId]);

  /**
   * Hanterar samtycke för videomöte
   */
  const handleConsent = useCallback((consentGiven: boolean) => {
    if (consentGiven) {
      initializeVideoMeeting(true);
    } else {
      Alert.alert(
        'Samtycke krävs',
        'Du måste ge samtycke för att gå med i videomötet. Endast ljud kommer att spelas in för protokollsändamål.',
        [
          { text: 'Avbryt', onPress: () => navigation.goBack() },
          { text: 'Ge samtycke', onPress: () => initializeVideoMeeting(true) }
        ]
      );
    }
  }, [initializeVideoMeeting, navigation]);

  /**
   * Stänger av/på mikrofon
   */
  const toggleAudio = useCallback(async () => {
    if (!webrtcPeerService) return;

    try {
      const newState = !state.isAudioEnabled;
      await webrtcPeerService.toggleAudio(newState);
      setState(prev => ({ ...prev, isAudioEnabled: newState }));
    } catch (error) {
      logger.error('Fel vid toggle av audio', { error });
      Alert.alert('Fel', 'Kunde inte ändra mikrofonsstatus');
    }
  }, [state.isAudioEnabled, webrtcPeerService]);

  /**
   * Stänger av/på kamera
   */
  const toggleVideo = useCallback(async () => {
    if (!webrtcPeerService) return;

    try {
      const newState = !state.isVideoEnabled;
      await webrtcPeerService.toggleVideo(newState);
      setState(prev => ({ ...prev, isVideoEnabled: newState }));
    } catch (error) {
      logger.error('Fel vid toggle av video', { error });
      Alert.alert('Fel', 'Kunde inte ändra kamerastatus');
    }
  }, [state.isVideoEnabled, webrtcPeerService]);

  /**
   * Lämnar videomötet
   */
  const leaveMeeting = useCallback(async () => {
    try {
      Alert.alert(
        'Lämna mötet',
        'Är du säker på att du vill lämna videomötet?',
        [
          { text: 'Avbryt', style: 'cancel' },
          {
            text: 'Lämna',
            style: 'destructive',
            onPress: async () => {
              try {
                await videoMeetingService.leaveMeeting(roomId);
                if (webrtcPeerService) {
                  await webrtcPeerService.cleanup();
                }
                onMeetingEnd?.();
                navigation.goBack();
              } catch (error) {
                logger.error('Fel vid utträde från möte', { error });
                navigation.goBack(); // Gå tillbaka ändå
              }
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Fel vid lämna möte', { error });
    }
  }, [roomId, navigation, onMeetingEnd]);

  /**
   * Avslutar mötet (endast moderatorer)
   */
  const endMeeting = useCallback(async () => {
    if (!state.isModerator) return;

    Alert.alert(
      'Avsluta mötet',
      'Är du säker på att du vill avsluta mötet för alla deltagare?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Avsluta',
          style: 'destructive',
          onPress: async () => {
            try {
              await videoMeetingService.endMeeting(roomId);
              if (webrtcPeerService) {
                await webrtcPeerService.cleanup();
              }
              onMeetingEnd?.();
              navigation.goBack();
            } catch (error) {
              logger.error('Fel vid avslutning av möte', { error });
              Alert.alert('Fel', 'Kunde inte avsluta mötet');
            }
          }
        }
      ]
    );
  }, [state.isModerator, roomId, navigation, onMeetingEnd]);

  /**
   * Cleanup vid unmount
   */
  useEffect(() => {
    return () => {
      if (webrtcPeerService) {
        webrtcPeerService.cleanup().catch(error => {
          logger.error('Fel vid cleanup av WebRTC', { error });
        });
      }
    };
  }, [webrtcPeerService]);

  /**
   * Hantera hårdvaru-tillbaka-knapp på Android
   */
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = () => {
        leaveMeeting();
        return true; // Förhindra default beteende
      };

      // Lägg till event listener för tillbaka-knapp
      // Detta kräver react-native-back-handler eller liknande
      // BackHandler.addEventListener('hardwareBackPress', backHandler);
      
      return () => {
        // BackHandler.removeEventListener('hardwareBackPress', backHandler);
      };
    }
  }, [leaveMeeting]);

  // Visa samtycke-dialog
  if (state.showConsentDialog) {
    return (
      <SafeAreaView style={styles.container}>
        <MeetingConsent
          onConsent={handleConsent}
          meetingId={meetingId}
        />
      </SafeAreaView>
    );
  }

  // Visa laddning
  if (state.isConnecting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>Ansluter till videomötet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Visa fel
  if (state.hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Anslutningsfel</Text>
          <Text style={styles.errorMessage}>{state.errorMessage}</Text>
          <View style={styles.errorActions}>
            <Text 
              style={styles.retryButton}
              onPress={() => initializeVideoMeeting(true)}
            >
              Försök igen
            </Text>
            <Text 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              Tillbaka
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Huvudgränssnitt för videomöte
  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        
        {/* Huvudvideoområde */}
        <View style={styles.videoContainer}>
          {/* Lokal video (liten bild-i-bild) */}
          {state.localStreamUrl && (
            <View style={styles.localVideoContainer}>
              <RTCView
                style={styles.localVideo}
                streamURL={state.localStreamUrl}
                mirror={true}
                objectFit="cover"
                zOrder={1}
              />
              {!state.isVideoEnabled && (
                <View style={styles.videoDisabledOverlay}>
                  <Text style={styles.videoDisabledText}>Kamera av</Text>
                </View>
              )}
            </View>
          )}

          {/* Remote videos grid */}
          <ParticipantGrid
            remotePeers={state.remotePeers}
            participants={state.participants}
            style={styles.participantGrid}
          />

          {/* Deltagarlista (kan togglas) */}
          <ParticipantList
            participants={state.participants}
            currentUserId={state.participants.find(p => p.isModerator)?.userId || ''}
            style={styles.participantList}
          />
        </View>

        {/* Kontroller */}
        <VideoControls
          isAudioEnabled={state.isAudioEnabled}
          isVideoEnabled={state.isVideoEnabled}
          isModerator={state.isModerator}
          participantCount={state.participants.length}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onLeaveMeeting={leaveMeeting}
          onEndMeeting={endMeeting}
          style={styles.controls}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 16,
  },
  retryButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    textAlign: 'center',
  },
  backButton: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    textAlign: 'center',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  videoDisabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDisabledText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  participantGrid: {
    flex: 1,
  },
  participantList: {
    position: 'absolute',
    left: 20,
    top: 20,
    maxHeight: 200,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default VideoMeetingRoom;
