/**
 * VideoMeetingScreen - Huvudskärm för videomöten
 * 
 * Denna skärm hanterar:
 * - Navigation till videomöte
 * - Parameter-validering och säkerhet
 * - Integration med befintlig mötesworkflow
 * - Error handling och fallbacks
 * - Svenska lokaliseringar
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  BackHandler,
  Platform
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { VideoMeetingRoom } from '../components/VideoMeeting/VideoMeetingRoom';
import { videoMeetingServiceMigrated as videoMeetingService } from '../services/VideoMeetingServiceMigrated';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { logger } from '../utils/logger';
import { colors } from '../theme/colors';

// Navigation types
type RootStackParamList = {
  VideoMeeting: {
    roomId: string;
    meetingId: string;
    joinCode?: string;
  };
  MeetingDetails: {
    meetingId: string;
  };
  RecordingScreen: {
    meetingId: string;
    isDigital: boolean;
  };
};

type VideoMeetingScreenRouteProp = RouteProp<RootStackParamList, 'VideoMeeting'>;
type VideoMeetingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VideoMeeting'>;

interface ValidationState {
  isValidating: boolean;
  isValid: boolean;
  errorMessage: string;
  hasAccess: boolean;
}

export const VideoMeetingScreen: React.FC = () => {
  const route = useRoute<VideoMeetingScreenRouteProp>();
  const navigation = useNavigation<VideoMeetingScreenNavigationProp>();
  
  const { roomId, meetingId, joinCode } = route.params;

  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: true,
    isValid: false,
    errorMessage: '',
    hasAccess: false
  });

  /**
   * Validerar åtkomst till videomöte vid mount
   */
  useEffect(() => {
    validateMeetingAccess();
  }, [roomId, meetingId, joinCode]);

  /**
   * Hanterar Android tillbaka-knapp
   */
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        handleBackPress
      );

      return () => backHandler.remove();
    }
  }, []);

  /**
   * Validerar åtkomst till mötet
   */
  const validateMeetingAccess = async () => {
    try {
      logger.info('Validerar åtkomst till videomöte', { roomId, meetingId, joinCode });

      setValidationState(prev => ({ 
        ...prev, 
        isValidating: true, 
        errorMessage: '' 
      }));

      // Kontrollera att parametrar är giltiga
      if (!roomId || !meetingId) {
        throw new Error('Ogiltiga mötesparametrar');
      }

      // Validera åtkomst via videoMeetingService
      const hasAccess = await videoMeetingService.validateMeetingAccess(roomId, joinCode);
      
      if (!hasAccess) {
        throw new Error('Du har inte behörighet att gå med i detta möte');
      }

      // Kontrollera att mötet fortfarande är aktivt
      const currentMeeting = videoMeetingService.getCurrentMeeting();
      if (currentMeeting && currentMeeting.roomId !== roomId) {
        // Användaren är redan i ett annat möte
        Alert.alert(
          'Redan i möte',
          'Du är redan i ett annat videomöte. Vill du lämna det och gå med i detta?',
          [
            { text: 'Avbryt', style: 'cancel', onPress: () => navigation.goBack() },
            { 
              text: 'Byt möte', 
              style: 'destructive',
              onPress: async () => {
                try {
                  await videoMeetingService.leaveMeeting(currentMeeting.roomId);
                  setValidationState({
                    isValidating: false,
                    isValid: true,
                    errorMessage: '',
                    hasAccess: true
                  });
                } catch (error) {
                  logger.error('Fel vid byte av möte', { error });
                  setValidationState(prev => ({
                    ...prev,
                    isValidating: false,
                    errorMessage: 'Kunde inte lämna föregående möte'
                  }));
                }
              }
            }
          ]
        );
        return;
      }

      setValidationState({
        isValidating: false,
        isValid: true,
        errorMessage: '',
        hasAccess: true
      });

      logger.info('Åtkomst till videomöte validerad', { roomId, meetingId });

    } catch (error) {
      logger.error('Fel vid validering av mötesåtkomst', { error, roomId, meetingId });
      
      const errorMessage = error instanceof Error ? error.message : 'Okänt fel uppstod';
      
      setValidationState({
        isValidating: false,
        isValid: false,
        errorMessage,
        hasAccess: false
      });

      // Visa felmeddelande och navigera tillbaka efter en stund
      setTimeout(() => {
        Alert.alert(
          'Åtkomst nekad',
          errorMessage,
          [
            { 
              text: 'Tillbaka', 
              onPress: () => navigation.goBack() 
            }
          ]
        );
      }, 1000);
    }
  };

  /**
   * Hanterar när mötet avslutas
   */
  const handleMeetingEnd = () => {
    logger.info('Videomöte avslutat', { roomId, meetingId });
    
    // Navigera tillbaka till mötesdetaljer eller recording screen
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Fallback navigation
      navigation.navigate('RecordingScreen', {
        meetingId,
        isDigital: true
      });
    }
  };

  /**
   * Hanterar tillbaka-knapp
   */
  const handleBackPress = (): boolean => {
    Alert.alert(
      'Lämna videomötet',
      'Är du säker på att du vill lämna videomötet?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { 
          text: 'Lämna', 
          style: 'destructive',
          onPress: () => {
            handleMeetingEnd();
          }
        }
      ]
    );
    return true; // Förhindra default back-beteende
  };

  /**
   * Renderar laddningsskärm
   */
  if (validationState.isValidating) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Validerar mötesåtkomst...</Text>
        <Text style={styles.loadingSubtext}>
          Kontrollerar behörigheter och mötesstatus
        </Text>
      </View>
    );
  }

  /**
   * Renderar felskärm
   */
  if (!validationState.isValid || !validationState.hasAccess) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Åtkomst nekad</Text>
        <Text style={styles.errorMessage}>
          {validationState.errorMessage || 'Du har inte behörighet att gå med i detta möte'}
        </Text>
        <Text style={styles.errorSubtext}>
          Kontakta mötesorganisatören om du tror detta är ett fel
        </Text>
      </View>
    );
  }

  /**
   * Renderar videomöte
   */
  return (
    <ErrorBoundary
      fallback={
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Tekniskt fel</Text>
          <Text style={styles.errorMessage}>
            Ett oväntat fel uppstod i videomötet
          </Text>
          <Text 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            Tillbaka
          </Text>
        </View>
      }
    >
      <VideoMeetingRoom
        roomId={roomId}
        meetingId={meetingId}
        onMeetingEnd={handleMeetingEnd}
      />
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    textAlign: 'center',
  },
});

export default VideoMeetingScreen;
