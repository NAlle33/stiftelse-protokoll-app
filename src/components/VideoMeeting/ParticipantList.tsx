/**
 * ParticipantList - Lista över mötesdeltagare
 * 
 * Denna komponent hanterar:
 * - Kompakt lista över alla deltagare
 * - Status-indikatorer för audio/video
 * - Moderator-kontroller (om tillämpligt)
 * - Kollapsbar design för att spara skärmutrymme
 * - Svenska lokaliseringar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  ScrollView
} from 'react-native';
import { VideoParticipant } from '../../services/videoMeetingService';
import { SafeIonicons } from '../ui/SafeIonicons';
import { colors } from '../../theme/colors';

interface ParticipantListProps {
  participants: VideoParticipant[];
  currentUserId: string;
  style?: ViewStyle;
  onParticipantAction?: (userId: string, action: 'mute' | 'remove') => void;
}

interface ParticipantItemProps {
  participant: VideoParticipant;
  isCurrentUser: boolean;
  canModerate: boolean;
  onAction?: (action: 'mute' | 'remove') => void;
}

const ParticipantItem: React.FC<ParticipantItemProps> = ({
  participant,
  isCurrentUser,
  canModerate,
  onAction
}) => {
  return (
    <View style={styles.participantItem}>
      {/* Avatar och status */}
      <View style={styles.participantAvatar}>
        <SafeIonicons
          name="person"
          size={20}
          color={colors.textSecondary}
        />
        
        {/* Online-indikator */}
        <View style={[
          styles.onlineIndicator,
          { backgroundColor: colors.success }
        ]} />
      </View>

      {/* Deltagarinfo */}
      <View style={styles.participantInfo}>
        <View style={styles.participantNameRow}>
          <Text style={styles.participantName} numberOfLines={1}>
            {isCurrentUser ? 'Du' : `Deltagare ${participant.userId.slice(-4)}`}
          </Text>
          
          {/* Moderator-badge */}
          {participant.isModerator && (
            <View style={styles.moderatorBadge}>
              <SafeIonicons
                name="shield-checkmark"
                size={10}
                color={colors.primary}
              />
              <Text style={styles.moderatorText}>Mod</Text>
            </View>
          )}
        </View>

        {/* Status-indikatorer */}
        <View style={styles.statusRow}>
          {/* Audio status */}
          <View style={styles.statusItem}>
            <SafeIonicons
              name={participant.audioEnabled ? 'mic' : 'mic-off'}
              size={12}
              color={participant.audioEnabled ? colors.success : colors.error}
            />
            <Text style={[
              styles.statusText,
              { color: participant.audioEnabled ? colors.success : colors.error }
            ]}>
              {participant.audioEnabled ? 'Ljud på' : 'Ljud av'}
            </Text>
          </View>

          {/* Video status */}
          <View style={styles.statusItem}>
            <SafeIonicons
              name={participant.videoEnabled ? 'videocam' : 'videocam-off'}
              size={12}
              color={participant.videoEnabled ? colors.success : colors.error}
            />
            <Text style={[
              styles.statusText,
              { color: participant.videoEnabled ? colors.success : colors.error }
            ]}>
              {participant.videoEnabled ? 'Video på' : 'Video av'}
            </Text>
          </View>
        </View>
      </View>

      {/* Moderator-kontroller */}
      {canModerate && !isCurrentUser && (
        <View style={styles.moderatorControls}>
          {/* Stäng av ljud */}
          {participant.audioEnabled && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => onAction?.('mute')}
              accessibilityLabel={`Stäng av ${participant.userId}s mikrofon`}
            >
              <SafeIonicons
                name="mic-off"
                size={14}
                color={colors.warning}
              />
            </TouchableOpacity>
          )}

          {/* Ta bort deltagare */}
          <TouchableOpacity
            style={[styles.controlButton, styles.removeButton]}
            onPress={() => onAction?.('remove')}
            accessibilityLabel={`Ta bort ${participant.userId} från mötet`}
          >
            <SafeIonicons
              name="person-remove"
              size={14}
              color={colors.error}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUserId,
  style,
  onParticipantAction
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sortera deltagare: moderatorer först, sedan nuvarande användare, sedan andra
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.isModerator && !b.isModerator) return -1;
    if (!a.isModerator && b.isModerator) return 1;
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return 0;
  });

  // Kontrollera om nuvarande användare är moderator
  const currentUserParticipant = participants.find(p => p.userId === currentUserId);
  const canModerate = currentUserParticipant?.isModerator ?? false;

  // Visa endast första 3 deltagare om inte expanderad
  const visibleParticipants = isExpanded 
    ? sortedParticipants 
    : sortedParticipants.slice(0, 3);

  const hasMoreParticipants = sortedParticipants.length > 3;

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
        accessibilityLabel={`${isExpanded ? 'Dölj' : 'Visa'} deltagarlista`}
        accessibilityRole="button"
      >
        <View style={styles.headerContent}>
          <SafeIonicons
            name="people"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.headerTitle}>
            Deltagare ({participants.length})
          </Text>
        </View>
        
        {hasMoreParticipants && (
          <SafeIonicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        )}
      </TouchableOpacity>

      {/* Deltagarlista */}
      {(isExpanded || !hasMoreParticipants) && (
        <View style={styles.listContainer}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {visibleParticipants.map((participant) => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                isCurrentUser={participant.userId === currentUserId}
                canModerate={canModerate}
                onAction={(action) => 
                  onParticipantAction?.(participant.userId, action)
                }
              />
            ))}
          </ScrollView>

          {/* Visa mer-knapp */}
          {!isExpanded && hasMoreParticipants && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setIsExpanded(true)}
            >
              <Text style={styles.showMoreText}>
                Visa {sortedParticipants.length - 3} till...
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Kompakt vy när kollapsad */}
      {!isExpanded && hasMoreParticipants && (
        <View style={styles.compactView}>
          {sortedParticipants.slice(0, 3).map((participant, index) => (
            <View key={participant.id} style={styles.compactParticipant}>
              <View style={styles.compactAvatar}>
                <SafeIonicons
                  name="person"
                  size={12}
                  color={colors.textSecondary}
                />
                {participant.isModerator && (
                  <View style={styles.compactModeratorBadge} />
                )}
              </View>
            </View>
          ))}
          
          {sortedParticipants.length > 3 && (
            <View style={styles.moreIndicator}>
              <Text style={styles.moreIndicatorText}>
                +{sortedParticipants.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 200,
    maxWidth: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContainer: {
    maxHeight: 200,
  },
  scrollView: {
    flex: 1,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: 12,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.8)',
  },
  participantInfo: {
    flex: 1,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  moderatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  moderatorText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: '600',
    marginLeft: 2,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    marginLeft: 3,
    fontWeight: '500',
  },
  moderatorControls: {
    flexDirection: 'row',
    gap: 4,
  },
  controlButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
  },
  showMoreButton: {
    padding: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  showMoreText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  compactView: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
  },
  compactParticipant: {
    position: 'relative',
  },
  compactAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  compactModeratorBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.8)',
  },
  moreIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  moreIndicatorText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
});

export default ParticipantList;
