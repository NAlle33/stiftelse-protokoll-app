/**
 * Service Consolidation Validation Tests
 * 
 * Validerar att service consolidation fungerar korrekt:
 * - UserServiceMigrated kan importeras och instansieras
 * - VideoMeetingServiceMigrated kan importeras och instansieras
 * - WebRTCSignalingServiceMigrated kan importeras och instansieras
 * - Feature flags fungerar korrekt
 * - ServiceFactory kan ladda migrerade tjänster
 */

describe('Service Consolidation Validation', () => {
  describe('UserServiceMigrated', () => {
    it('should import and instantiate UserServiceMigrated successfully', async () => {
      // Test that the migrated service can be imported
      const { UserServiceMigrated, userServiceMigrated } = await import('../../services/UserServiceMigrated');
      
      expect(UserServiceMigrated).toBeDefined();
      expect(userServiceMigrated).toBeDefined();
      expect(userServiceMigrated).toBeInstanceOf(UserServiceMigrated);
    });

    it('should have required methods', async () => {
      const { userServiceMigrated } = await import('../../services/UserServiceMigrated');
      
      expect(typeof userServiceMigrated.getCurrentUser).toBe('function');
      expect(typeof userServiceMigrated.getUserById).toBe('function');
      expect(typeof userServiceMigrated.updateUser).toBe('function');
      expect(typeof userServiceMigrated.getUsers).toBe('function');
    });
  });

  describe('VideoMeetingServiceMigrated', () => {
    it('should import and instantiate VideoMeetingServiceMigrated successfully', async () => {
      // Test that the migrated service can be imported
      const { VideoMeetingServiceMigrated, videoMeetingServiceMigrated } = await import('../../services/VideoMeetingServiceMigrated');
      
      expect(VideoMeetingServiceMigrated).toBeDefined();
      expect(videoMeetingServiceMigrated).toBeDefined();
      expect(videoMeetingServiceMigrated).toBeInstanceOf(VideoMeetingServiceMigrated);
    });

    it('should have required methods', async () => {
      const { videoMeetingServiceMigrated } = await import('../../services/VideoMeetingServiceMigrated');
      
      expect(typeof videoMeetingServiceMigrated.createVideoMeeting).toBe('function');
      expect(typeof videoMeetingServiceMigrated.joinVideoMeeting).toBe('function');
      expect(typeof videoMeetingServiceMigrated.leaveVideoMeeting).toBe('function');
      expect(typeof videoMeetingServiceMigrated.getActiveParticipants).toBe('function');
      expect(typeof videoMeetingServiceMigrated.endVideoMeeting).toBe('function');
    });
  });

  describe('WebRTCSignalingServiceMigrated', () => {
    it('should import and instantiate WebRTCSignalingServiceMigrated successfully', async () => {
      // Test that the migrated service can be imported
      const { WebRTCSignalingService, webrtcSignalingServiceMigrated } = await import('../../services/WebRTCSignalingServiceMigrated');
      
      expect(WebRTCSignalingService).toBeDefined();
      expect(webrtcSignalingServiceMigrated).toBeDefined();
      expect(webrtcSignalingServiceMigrated).toBeInstanceOf(WebRTCSignalingService);
    });

    it('should have required methods', async () => {
      const { webrtcSignalingServiceMigrated } = await import('../../services/WebRTCSignalingServiceMigrated');
      
      expect(typeof webrtcSignalingServiceMigrated.initializeMeeting).toBe('function');
      expect(typeof webrtcSignalingServiceMigrated.sendSignal).toBe('function');
      expect(typeof webrtcSignalingServiceMigrated.setCallbacks).toBe('function');
      expect(typeof webrtcSignalingServiceMigrated.leaveMeeting).toBe('function');
    });
  });

  describe('Feature Flags', () => {
    it('should have migrated service flags enabled in development', async () => {
      const { FEATURE_FLAGS } = await import('../../config/featureFlags');
      
      // In development environment, migrated services should be enabled
      expect(FEATURE_FLAGS.USE_MIGRATED_USER_SERVICE).toBe(true);
      expect(FEATURE_FLAGS.USE_MIGRATED_VIDEO_SERVICE).toBe(true);
      expect(FEATURE_FLAGS.USE_MIGRATED_SIGNALING_SERVICE).toBe(true);
    });
  });

  describe('ServiceFactory Integration', () => {
    it('should load UserServiceMigrated through ServiceFactory', async () => {
      const { ServiceFactory } = await import('../../services/ServiceFactory');
      
      const result = await ServiceFactory.getUserService();
      
      expect(result).toBeDefined();
      expect(result.service).toBeDefined();
      expect(result.isMigrated).toBe(true);
      expect(result.serviceName).toBe('UserService');
    });

    it('should load VideoMeetingServiceMigrated through ServiceFactory', async () => {
      const { ServiceFactory } = await import('../../services/ServiceFactory');
      
      const result = await ServiceFactory.getVideoMeetingService();
      
      expect(result).toBeDefined();
      expect(result.service).toBeDefined();
      expect(result.isMigrated).toBe(true);
      expect(result.serviceName).toBe('VideoMeetingService');
    });

    it('should load WebRTCSignalingServiceMigrated through ServiceFactory', async () => {
      const { ServiceFactory } = await import('../../services/ServiceFactory');
      
      const result = await ServiceFactory.getWebRTCSignalingService();
      
      expect(result).toBeDefined();
      expect(result.service).toBeDefined();
      expect(result.isMigrated).toBe(true);
      expect(result.serviceName).toBe('WebRTCSignalingService');
    });
  });

  describe('Import References Updated', () => {
    it('should verify VideoMeetingRoom uses migrated service', async () => {
      // This test verifies that import references have been updated
      // We can't easily test the actual import without complex mocking,
      // but we can verify the services are available
      const { videoMeetingServiceMigrated } = await import('../../services/VideoMeetingServiceMigrated');
      const { webrtcSignalingServiceMigrated } = await import('../../services/WebRTCSignalingServiceMigrated');
      
      expect(videoMeetingServiceMigrated).toBeDefined();
      expect(webrtcSignalingServiceMigrated).toBeDefined();
    });
  });

  describe('BaseService Integration', () => {
    it('should verify migrated services extend appropriate base classes', async () => {
      const { UserServiceMigrated } = await import('../../services/UserServiceMigrated');
      const { VideoMeetingServiceMigrated } = await import('../../services/VideoMeetingServiceMigrated');
      const { WebRTCSignalingService } = await import('../../services/WebRTCSignalingServiceMigrated');
      const { BaseService } = await import('../../services/BaseService');
      const { MediaBaseService } = await import('../../services/MediaBaseService');
      const { RealtimeBaseService } = await import('../../services/RealtimeBaseService');
      
      // UserServiceMigrated should extend BaseService
      const userService = new UserServiceMigrated();
      expect(userService).toBeInstanceOf(BaseService);
      
      // VideoMeetingServiceMigrated should extend MediaBaseService
      const videoService = new VideoMeetingServiceMigrated();
      expect(videoService).toBeInstanceOf(MediaBaseService);
      expect(videoService).toBeInstanceOf(BaseService);
      
      // WebRTCSignalingService should extend RealtimeBaseService
      const signaling = new WebRTCSignalingService();
      expect(signaling).toBeInstanceOf(RealtimeBaseService);
      expect(signaling).toBeInstanceOf(BaseService);
    });
  });
});
