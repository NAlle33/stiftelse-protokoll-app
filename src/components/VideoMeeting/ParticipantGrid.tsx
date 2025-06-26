/**
 * ParticipantGrid - Grid-layout för videomötesdeltagare
 * 
 * Denna komponent hanterar:
 * - Responsiv grid-layout för video streams
 * - Automatisk anpassning baserat på antal deltagare
 * - Fallback för deltagare utan video
 * - Deltagarnamn och status-indikatorer
 * - Cross-platform kompatibilitet
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ViewStyle
} from 'react-native';
import { RTCView } from '@livekit/react-native-webrtc';
import { RemotePeer } from '../../services/webrtcPeerService';
import { VideoParticipant } from '../../services/videoMeetingService';
import { SafeIonicons } from '../ui/SafeIonicons';
import { colors } from '../../theme/colors';

interface ParticipantGridProps {
  remotePeers: RemotePeer[];
  participants: VideoParticipant[];
  style?: ViewStyle;
}

interface GridDimensions {
  columns: number;
  rows: number;
  itemWidth: number;
  itemHeight: number;
}

interface ParticipantData {
  userId: string;
  streamUrl?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connectionState: string;
  displayName: string;
  isModerator: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  remotePeers,
  participants,
  style
}) => {
  /**
   * Beräknar optimal grid-layout baserat på antal deltagare
   */
  const gridDimensions = useMemo((): GridDimensions => {
    const participantCount = remotePeers.length;
    
    if (participantCount === 0) {
      return {
        columns: 1,
        rows: 1,
        itemWidth: screenWidth - 40,
        itemHeight: screenHeight * 0.6,
      };
    }

    let columns: number;
    let rows: number;

    if (participantCount === 1) {
      columns = 1;
      rows = 1;
    } else if (participantCount <= 4) {
      columns = 2;
      rows = Math.ceil(participantCount / 2);
    } else if (participantCount <= 6) {
      columns = 3;
      rows = Math.ceil(participantCount / 3);
    } else {
      columns = 3;
      rows = Math.ceil(participantCount / 3);
    }

    const availableWidth = screenWidth - 40; // Padding
    const availableHeight = screenHeight * 0.7; // Reservera plats för kontroller

    const itemWidth = (availableWidth - (columns - 1) * 8) / columns; // 8px gap
    const itemHeight = Math.min(
      (availableHeight - (rows - 1) * 8) / rows,
      itemWidth * 0.75 // 4:3 aspect ratio
    );

    return {
      columns,
      rows,
      itemWidth: Math.floor(itemWidth),
      itemHeight: Math.floor(itemHeight),
    };
  }, [remotePeers.length]);

  /**
   * Kombinerar peer-data med participant-data
   */
  const participantData = useMemo((): ParticipantData[] => {
    return remotePeers.map(peer => {
      const participant = participants.find(p => p.userId === peer.userId);
      
      return {
        userId: peer.userId,
        streamUrl: peer.remoteStream?.toURL(),
        audioEnabled: participant?.audioEnabled ?? true,
        videoEnabled: participant?.videoEnabled ?? true,
        connectionState: peer.connectionState,
        displayName: `Deltagare ${peer.userId.slice(-4)}`, // Fallback namn
        isModerator: participant?.isModerator ?? false,
      };
    });
  }, [remotePeers, participants]);

  /**
   * Renderar en enskild deltagare
   */
  const renderParticipant = (data: ParticipantData, index: number) => {
    const { itemWidth, itemHeight } = gridDimensions;
    
    return (
      <View
        key={data.userId}
        style={[
          styles.participantContainer,
          {
            width: itemWidth,
            height: itemHeight,
          }
        ]}
      >
        {/* Video eller fallback */}
        {data.streamUrl && data.videoEnabled ? (
          <RTCView
            style={styles.videoView}
            streamURL={data.streamUrl}
            objectFit="cover"
            mirror={false}
            zOrder={0}
          />
        ) : (
          <View style={styles.videoFallback}>
            <View style={styles.avatarContainer}>
              <SafeIonicons
                name="person"
                size={Math.min(itemWidth, itemHeight) * 0.3}
                color={colors.textSecondary}
              />
            </View>
          </View>
        )}

        {/* Overlay med deltagarinfo */}
        <View style={styles.participantOverlay}>
          {/* Namn och status */}
          <View style={styles.participantInfo}>
            <Text style={styles.participantName} numberOfLines={1}>
              {data.displayName}
            </Text>
            
            {/* Moderator-badge */}
            {data.isModerator && (
              <View style={styles.moderatorBadge}>
                <SafeIonicons
                  name="shield-checkmark"
                  size={12}
                  color={colors.primary}
                />
              </View>
            )}
          </View>

          {/* Audio/Video status */}
          <View style={styles.statusIndicators}>
            {/* Mikrofon status */}
            <View style={[
              styles.statusIcon,
              !data.audioEnabled && styles.statusIconDisabled
            ]}>
              <SafeIonicons
                name={data.audioEnabled ? 'mic' : 'mic-off'}
                size={16}
                color={data.audioEnabled ? colors.white : colors.error}
              />
            </View>

            {/* Video status */}
            {!data.videoEnabled && (
              <View style={[styles.statusIcon, styles.statusIconDisabled]}>
                <SafeIonicons
                  name="videocam-off"
                  size={16}
                  color={colors.error}
                />
              </View>
            )}

            {/* Anslutningsstatus */}
            {data.connectionState !== 'connected' && (
              <View style={styles.connectionStatus}>
                <View style={[
                  styles.connectionDot,
                  {
                    backgroundColor: 
                      data.connectionState === 'connecting' ? colors.warning :
                      data.connectionState === 'failed' ? colors.error :
                      colors.textSecondary
                  }
                ]} />
              </View>
            )}
          </View>
        </View>

        {/* Loading overlay för anslutning */}
        {data.connectionState === 'connecting' && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Ansluter...</Text>
          </View>
        )}

        {/* Fel overlay */}
        {data.connectionState === 'failed' && (
          <View style={styles.errorOverlay}>
            <SafeIonicons
              name="warning"
              size={24}
              color={colors.error}
            />
            <Text style={styles.errorText}>Anslutningsfel</Text>
          </View>
        )}
      </View>
    );
  };

  /**
   * Renderar tom grid om inga deltagare
   */
  if (participantData.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyState}>
          <SafeIonicons
            name="people"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyStateTitle}>Väntar på deltagare</Text>
          <Text style={styles.emptyStateText}>
            Andra deltagare kommer att visas här när de går med i mötet
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.grid,
        {
          width: gridDimensions.columns * gridDimensions.itemWidth + 
                 (gridDimensions.columns - 1) * 8, // Gap mellan kolumner
        }
      ]}>
        {participantData.map((data, index) => renderParticipant(data, index))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  participantContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  videoFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  participantOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  moderatorBadge: {
    marginLeft: 6,
    padding: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  statusIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconDisabled: {
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
  },
  connectionStatus: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ParticipantGrid;
