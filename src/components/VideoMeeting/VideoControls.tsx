/**
 * VideoControls - Kontroller för videomöten
 * 
 * Denna komponent hanterar:
 * - Mikrofon och kamera-kontroller
 * - Mötesstyrning (lämna/avsluta)
 * - Moderator-specifika funktioner
 * - Svenska lokaliseringar
 * - Tillgänglighet och användarvänlighet
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ViewStyle
} from 'react-native';
import { SafeIonicons } from '../ui/SafeIonicons';
import { colors } from '../../theme/colors';

interface VideoControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isModerator: boolean;
  participantCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeaveMeeting: () => void;
  onEndMeeting?: () => void;
  style?: ViewStyle;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isAudioEnabled,
  isVideoEnabled,
  isModerator,
  participantCount,
  onToggleAudio,
  onToggleVideo,
  onLeaveMeeting,
  onEndMeeting,
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Mötesinfo */}
      <View style={styles.meetingInfo}>
        <View style={styles.participantInfo}>
          <SafeIonicons 
            name="people" 
            size={16} 
            color={colors.textSecondary} 
          />
          <Text style={styles.participantCount}>
            {participantCount} deltagare
          </Text>
        </View>
      </View>

      {/* Huvudkontroller */}
      <View style={styles.mainControls}>
        {/* Mikrofon-kontroll */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            !isAudioEnabled && styles.controlButtonDisabled
          ]}
          onPress={onToggleAudio}
          accessibilityLabel={isAudioEnabled ? 'Stäng av mikrofon' : 'Sätt på mikrofon'}
          accessibilityRole="button"
        >
          <SafeIonicons
            name={isAudioEnabled ? 'mic' : 'mic-off'}
            size={24}
            color={isAudioEnabled ? colors.white : colors.error}
          />
        </TouchableOpacity>

        {/* Kamera-kontroll */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            !isVideoEnabled && styles.controlButtonDisabled
          ]}
          onPress={onToggleVideo}
          accessibilityLabel={isVideoEnabled ? 'Stäng av kamera' : 'Sätt på kamera'}
          accessibilityRole="button"
        >
          <SafeIonicons
            name={isVideoEnabled ? 'videocam' : 'videocam-off'}
            size={24}
            color={isVideoEnabled ? colors.white : colors.error}
          />
        </TouchableOpacity>

        {/* Lämna mötet */}
        <TouchableOpacity
          style={[styles.controlButton, styles.leaveButton]}
          onPress={onLeaveMeeting}
          accessibilityLabel="Lämna mötet"
          accessibilityRole="button"
        >
          <SafeIonicons
            name="call"
            size={24}
            color={colors.white}
            style={styles.leaveIcon}
          />
        </TouchableOpacity>

        {/* Avsluta mötet (endast moderatorer) */}
        {isModerator && onEndMeeting && (
          <TouchableOpacity
            style={[styles.controlButton, styles.endMeetingButton]}
            onPress={onEndMeeting}
            accessibilityLabel="Avsluta mötet för alla"
            accessibilityRole="button"
          >
            <SafeIonicons
              name="stop"
              size={24}
              color={colors.white}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Statustext */}
      <View style={styles.statusContainer}>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            { backgroundColor: colors.success }
          ]} />
          <Text style={styles.statusText}>Ansluten</Text>
        </View>

        {/* Moderator-indikator */}
        {isModerator && (
          <View style={styles.moderatorBadge}>
            <SafeIonicons
              name="shield-checkmark"
              size={12}
              color={colors.primary}
            />
            <Text style={styles.moderatorText}>Moderator</Text>
          </View>
        )}
      </View>

      {/* Hjälptext för kontroller */}
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          {!isAudioEnabled && !isVideoEnabled
            ? 'Mikrofon och kamera är avstängda'
            : !isAudioEnabled
            ? 'Mikrofon är avstängd'
            : !isVideoEnabled
            ? 'Kamera är avstängd'
            : 'Mikrofon och kamera är påslagna'
          }
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Safe area för iPhone
  },
  meetingInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  participantCount: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 12,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  controlButtonDisabled: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderColor: colors.error,
  },
  leaveButton: {
    backgroundColor: colors.error,
  },
  leaveIcon: {
    transform: [{ rotate: '135deg' }], // Rotera för att visa "lägg på"
  },
  endMeetingButton: {
    backgroundColor: colors.error,
    borderColor: colors.white,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  moderatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  moderatorText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  helpContainer: {
    alignItems: 'center',
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VideoControls;
