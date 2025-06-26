/**
 * Basic WebRTC Implementation Test
 * Verifies that the WebRTC services are properly implemented
 */

describe('WebRTC Implementation', () => {
  test('WebRTC services can be imported', () => {
    // Test that the services can be imported without errors
    expect(() => {
      const videoMeetingService = require('../../src/services/videoMeetingService');
      const webrtcSignalingService = require('../../src/services/webrtcSignalingService');
      const webrtcPeerService = require('../../src/services/webrtcPeerService');
      
      expect(videoMeetingService).toBeDefined();
      expect(webrtcSignalingService).toBeDefined();
      expect(webrtcPeerService).toBeDefined();
    }).not.toThrow();
  });

  test('WebRTC components can be imported', () => {
    // Test that the components can be imported without errors
    expect(() => {
      const VideoMeetingRoom = require('../../src/components/VideoMeeting/VideoMeetingRoom');
      const VideoControls = require('../../src/components/VideoMeeting/VideoControls');
      const MeetingConsent = require('../../src/components/VideoMeeting/MeetingConsent');
      
      expect(VideoMeetingRoom).toBeDefined();
      expect(VideoControls).toBeDefined();
      expect(MeetingConsent).toBeDefined();
    }).not.toThrow();
  });

  test('WebRTC screen can be imported', () => {
    // Test that the screen can be imported without errors
    expect(() => {
      const VideoMeetingScreen = require('../../src/screens/VideoMeetingScreen');
      expect(VideoMeetingScreen).toBeDefined();
    }).not.toThrow();
  });

  test('WebRTC library is installed', () => {
    // Test that the WebRTC library is available
    expect(() => {
      const webrtc = require('@livekit/react-native-webrtc');
      expect(webrtc).toBeDefined();
    }).not.toThrow();
  });
});
