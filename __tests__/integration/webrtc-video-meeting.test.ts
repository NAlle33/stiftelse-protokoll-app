/**
 * WebRTC Video Meeting Integration Tests
 * 
 * Dessa tester validerar:
 * - WebRTC service integration
 * - Videomötesfunktionalitet
 * - GDPR-efterlevnad
 * - Säkerhet och behörigheter
 * - Svenska lokaliseringar
 */

import { videoMeetingService } from '../../src/services/videoMeetingService';
import { webrtcSignalingService } from '../../src/services/webrtcSignalingService';
import { webrtcPeerService } from '../../src/services/webrtcPeerService';
import { supabase } from '../../src/config/supabase';

// Mock WebRTC components
jest.mock('@livekit/react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
    createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
    setLocalDescription: jest.fn().mockResolvedValue(undefined),
    setRemoteDescription: jest.fn().mockResolvedValue(undefined),
    addIceCandidate: jest.fn().mockResolvedValue(undefined),
    addTrack: jest.fn(),
    close: jest.fn(),
    connectionState: 'new',
    iceConnectionState: 'new'
  })),
  RTCIceCandidate: jest.fn(),
  RTCSessionDescription: jest.fn(),
  MediaStream: jest.fn().mockImplementation(() => ({
    getTracks: jest.fn().mockReturnValue([]),
    getAudioTracks: jest.fn().mockReturnValue([]),
    getVideoTracks: jest.fn().mockReturnValue([]),
    toURL: jest.fn().mockReturnValue('mock-stream-url')
  })),
  mediaDevices: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([
        { kind: 'audio', enabled: true, stop: jest.fn() },
        { kind: 'video', enabled: true, stop: jest.fn() }
      ]),
      getAudioTracks: jest.fn().mockReturnValue([{ enabled: true, stop: jest.fn() }]),
      getVideoTracks: jest.fn().mockReturnValue([{ enabled: true, stop: jest.fn() }]),
      toURL: jest.fn().mockReturnValue('mock-local-stream-url')
    })
  },
  registerGlobals: jest.fn()
}));

// Mock Supabase
jest.mock('../../src/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
    },
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-video-meeting-id',
              meeting_id: 'test-meeting-id',
              room_id: 'test-room-id',
              max_participants: 10,
              is_recording_allowed: false,
              consent_required: true,
              data_retention_days: 30,
              created_at: new Date().toISOString()
            },
            error: null
          })
        })
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-video-meeting-id',
              meeting_id: 'test-meeting-id',
              room_id: 'test-room-id',
              consent_required: true
            },
            error: null
          })
        })
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      })
    }),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockResolvedValue('SUBSCRIBED'),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      track: jest.fn().mockResolvedValue(undefined),
      presenceState: jest.fn().mockReturnValue({})
    })
  }
}));

describe('WebRTC Video Meeting Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Video Meeting Service', () => {
    test('skapar videomöte för digitalt möte', async () => {
      // Mock meeting service response
      const mockMeeting = {
        id: 'test-meeting-id',
        meeting_type: 'digital',
        title: 'Test Digital Meeting'
      };

      // Mock meetingService.getMeeting
      const getMeetingMock = jest.fn().mockResolvedValue(mockMeeting);
      (videoMeetingService as any).meetingService = { getMeeting: getMeetingMock };

      const videoMeeting = await videoMeetingService.createVideoMeeting('test-meeting-id');

      expect(videoMeeting).toMatchObject({
        meetingId: 'test-meeting-id',
        roomId: expect.stringMatching(/^room_/),
        maxParticipants: 10,
        isRecordingAllowed: false,
        consentRequired: true
      });

      expect(supabase.from).toHaveBeenCalledWith('video_meetings');
    });

    test('validerar åtkomst till videomöte', async () => {
      // Mock participant data
      const mockParticipant = {
        meeting_id: 'test-meeting-id',
        user_id: 'test-user-id',
        role: 'participant'
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockParticipant,
              error: null
            })
          })
        })
      });

      const hasAccess = await videoMeetingService.validateMeetingAccess('test-room-id');

      expect(hasAccess).toBe(true);
    });

    test('kräver GDPR-samtycke för att gå med i möte', async () => {
      const mockVideoMeeting = {
        id: 'test-video-meeting-id',
        consent_required: true,
        max_participants: 10
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockVideoMeeting,
              error: null
            })
          })
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-participant-id',
                video_meeting_id: 'test-video-meeting-id',
                user_id: 'test-user-id',
                consent_given: true,
                joined_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      // Försök gå med utan samtycke
      await expect(
        videoMeetingService.joinMeeting('test-room-id', false)
      ).rejects.toThrow('GDPR-samtycke krävs');

      // Gå med med samtycke
      const participant = await videoMeetingService.joinMeeting('test-room-id', true);
      expect(participant.consentGiven).toBe(true);
    });

    test('genererar säker möteslänk med join-kod', async () => {
      const mockVideoMeeting = {
        id: 'test-video-meeting-id',
        room_id: 'test-room-id',
        meeting_id: 'test-meeting-id'
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockVideoMeeting,
              error: null
            })
          })
        }),
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const invitation = await videoMeetingService.generateMeetingInvitation('test-video-meeting-id');

      expect(invitation).toMatchObject({
        meetingId: 'test-meeting-id',
        roomId: 'test-room-id',
        meetingLink: expect.stringContaining('test-room-id'),
        joinCode: expect.stringMatching(/^\d{6}$/),
        expiresAt: expect.any(String)
      });
    });
  });

  describe('WebRTC Signaling Service', () => {
    test('initialiserar signaling för möte', async () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockResolvedValue('SUBSCRIBED'),
        track: jest.fn().mockResolvedValue(undefined)
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      await webrtcSignalingService.initializeMeeting('test-room-id');

      expect(supabase.channel).toHaveBeenCalledWith(
        'video-meeting-test-room-id',
        expect.any(Object)
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          table: 'webrtc_signals'
        }),
        expect.any(Function)
      );
    });

    test('skickar WebRTC signal med rate limiting', async () => {
      const mockSignal = {
        fromUserId: 'test-user-id',
        toUserId: 'target-user-id',
        signalType: 'offer' as const,
        signalData: { type: 'offer', sdp: 'mock-sdp' }
      };

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      await webrtcSignalingService.initializeMeeting('test-room-id');
      await webrtcSignalingService.sendSignal('test-room-id', mockSignal);

      expect(supabase.from).toHaveBeenCalledWith('webrtc_signals');
    });

    test('validerar signal-data för säkerhet', async () => {
      const invalidSignal = {
        fromUserId: 'test-user-id',
        signalType: 'invalid-type' as any,
        signalData: {}
      };

      await webrtcSignalingService.initializeMeeting('test-room-id');
      
      // Ska inte skicka ogiltig signal
      await webrtcSignalingService.sendSignal('test-room-id', invalidSignal);
      
      // Verifiera att ingen insert gjordes för ogiltig signal
      expect(supabase.from).not.toHaveBeenCalledWith('webrtc_signals');
    });
  });

  describe('WebRTC Peer Service', () => {
    test('initialiserar peer service med media stream', async () => {
      const mockCallbacks = {
        onLocalStream: jest.fn(),
        onRemoteStream: jest.fn(),
        onConnectionStateChange: jest.fn(),
        onError: jest.fn()
      };

      await webrtcPeerService.initialize('test-room-id', 'test-user-id', mockCallbacks);

      expect(mockCallbacks.onLocalStream).toHaveBeenCalledWith(
        expect.objectContaining({
          toURL: expect.any(Function)
        })
      );
    });

    test('hanterar audio/video toggle', async () => {
      const mockCallbacks = {
        onLocalStream: jest.fn(),
        onRemoteStream: jest.fn(),
        onConnectionStateChange: jest.fn(),
        onError: jest.fn()
      };

      await webrtcPeerService.initialize('test-room-id', 'test-user-id', mockCallbacks);

      // Test audio toggle
      await webrtcPeerService.toggleAudio(false);
      await webrtcPeerService.toggleAudio(true);

      // Test video toggle
      await webrtcPeerService.toggleVideo(false);
      await webrtcPeerService.toggleVideo(true);

      // Verifiera att presence uppdaterades
      expect(webrtcSignalingService.updatePresence).toHaveBeenCalled();
    });

    test('rensar resurser vid cleanup', async () => {
      const mockCallbacks = {
        onLocalStream: jest.fn(),
        onRemoteStream: jest.fn(),
        onConnectionStateChange: jest.fn(),
        onError: jest.fn()
      };

      await webrtcPeerService.initialize('test-room-id', 'test-user-id', mockCallbacks);
      await webrtcPeerService.cleanup();

      // Verifiera att streams stoppades
      const localStream = webrtcPeerService.getLocalStream();
      expect(localStream).toBeNull();
    });
  });

  describe('GDPR Compliance', () => {
    test('loggar samtycke för audit trail', async () => {
      const mockVideoMeeting = {
        id: 'test-video-meeting-id',
        consent_required: true,
        max_participants: 10
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockVideoMeeting,
              error: null
            })
          })
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-participant-id',
                consent_given: true,
                consent_given_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      await videoMeetingService.joinMeeting('test-room-id', true);

      // Verifiera att audit log skapades
      expect(supabase.from).toHaveBeenCalledWith('meeting_audit_log');
    });

    test('säkerställer endast ljudinspelning (ingen video)', async () => {
      const videoMeeting = await videoMeetingService.createVideoMeeting('test-meeting-id');
      
      // Verifiera att videoinspelning är avstängd
      expect(videoMeeting.isRecordingAllowed).toBe(false);
    });

    test('implementerar data retention policy', async () => {
      const videoMeeting = await videoMeetingService.createVideoMeeting('test-meeting-id');
      
      // Verifiera 30-dagars retention
      expect(videoMeeting.dataRetentionDays).toBe(30);
    });
  });

  describe('Säkerhet', () => {
    test('validerar användarautentisering', async () => {
      // Mock ej autentiserad användare
      (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      await expect(
        videoMeetingService.validateMeetingAccess('test-room-id')
      ).resolves.toBe(false);
    });

    test('kontrollerar mötesdeltagare-behörighet', async () => {
      // Mock användare som inte är inbjuden
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Not found')
            })
          })
        })
      });

      const hasAccess = await videoMeetingService.validateMeetingAccess('test-room-id');
      expect(hasAccess).toBe(false);
    });

    test('validerar join-kod för extra säkerhet', async () => {
      const mockInvitation = {
        video_meeting_id: 'test-video-meeting-id',
        join_code: '123456',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockInvitation,
                error: null
              })
            })
          })
        })
      });

      const hasAccess = await videoMeetingService.validateMeetingAccess('test-room-id', '123456');
      expect(hasAccess).toBe(true);

      // Test med fel join-kod
      const hasAccessWrongCode = await videoMeetingService.validateMeetingAccess('test-room-id', '999999');
      expect(hasAccessWrongCode).toBe(false);
    });
  });

  describe('Svenska Lokaliseringar', () => {
    test('använder svenska felmeddelanden', async () => {
      // Mock fel från Supabase
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error')
            })
          })
        })
      });

      await expect(
        videoMeetingService.createVideoMeeting('test-meeting-id')
      ).rejects.toThrow('Kunde inte skapa videomöte');
    });

    test('loggar på svenska för audit trail', async () => {
      // Verifiera att logger använder svenska meddelanden
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await videoMeetingService.createVideoMeeting('test-meeting-id');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skapar videomöte')
      );
      
      logSpy.mockRestore();
    });
  });
});

describe('WebRTC Error Handling', () => {
  test('hanterar WebRTC initialization fel', async () => {
    // Mock getUserMedia fel
    const { mediaDevices } = require('@livekit/react-native-webrtc');
    mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    const mockCallbacks = {
      onLocalStream: jest.fn(),
      onRemoteStream: jest.fn(),
      onConnectionStateChange: jest.fn(),
      onError: jest.fn()
    };

    await expect(
      webrtcPeerService.initialize('test-room-id', 'test-user-id', mockCallbacks)
    ).rejects.toThrow();
  });

  test('hanterar signaling connection fel', async () => {
    const mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockResolvedValue('CHANNEL_ERROR')
    };

    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

    await expect(
      webrtcSignalingService.initializeMeeting('test-room-id')
    ).rejects.toThrow('Kunde inte ansluta till signaling-kanal');
  });
});
