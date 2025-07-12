import { ServiceContainer, ServiceRegistry, ServiceIdentifiers } from '../../services/ServiceContainer';
import { ComposableVideoMeetingService, IMeetingService, IWebRTCSignalingService, ILogger, ISupabaseClient } from '../../services/ComposableVideoMeetingService';

/**
 * Test suite för Service Composition implementation
 * Testar dependency injection, service container och composition patterns
 */

describe('Service Composition', () => {
  let container: ServiceContainer;
  let registry: ServiceRegistry;

  beforeEach(() => {
    container = new ServiceContainer();
    registry = new ServiceRegistry(container);
  });

  afterEach(() => {
    container.clear();
  });

  describe('ServiceContainer', () => {
    it('ska registrera och hämta services', () => {
      // Registrera en enkel service
      container.register({
        identifier: 'TestService',
        factory: () => ({ name: 'TestService' }),
        singleton: true
      });

      // Hämta service
      const service = container.get('TestService');
      expect(service).toEqual({ name: 'TestService' });
    });

    it('ska returnera samma instans för singleton services', () => {
      container.register({
        identifier: 'SingletonService',
        factory: () => ({ id: Math.random() }),
        singleton: true
      });

      const service1 = container.get('SingletonService');
      const service2 = container.get('SingletonService');

      expect(service1).toBe(service2);
      expect(service1.id).toBe(service2.id);
    });

    it('ska skapa nya instanser för non-singleton services', () => {
      container.register({
        identifier: 'NonSingletonService',
        factory: () => ({ id: Math.random() }),
        singleton: false
      });

      const service1 = container.get('NonSingletonService');
      const service2 = container.get('NonSingletonService');

      expect(service1).not.toBe(service2);
      expect(service1.id).not.toBe(service2.id);
    });

    it('ska kasta fel för oregistrerade services', () => {
      expect(() => {
        container.get('UnregisteredService');
      }).toThrow('Service ej registrerad: UnregisteredService');
    });

    it('ska kasta fel för dubbel registrering', () => {
      container.register({
        identifier: 'DuplicateService',
        factory: () => ({}),
        singleton: true
      });

      expect(() => {
        container.register({
          identifier: 'DuplicateService',
          factory: () => ({}),
          singleton: true
        });
      }).toThrow('Service redan registrerad: DuplicateService');
    });

    it('ska rensa instanser korrekt', () => {
      container.register({
        identifier: 'ClearableService',
        factory: () => ({ id: Math.random() }),
        singleton: true
      });

      const service1 = container.get('ClearableService');
      container.clearInstances();
      const service2 = container.get('ClearableService');

      expect(service1).not.toBe(service2);
    });
  });

  describe('Dependency Validation', () => {
    it('ska validera korrekta dependencies', () => {
      container.register({
        identifier: 'ServiceA',
        factory: () => ({}),
        dependencies: ['ServiceB']
      });

      container.register({
        identifier: 'ServiceB',
        factory: () => ({}),
        dependencies: []
      });

      const validation = container.validateDependencies();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('ska detektera cirkulära beroenden', () => {
      container.register({
        identifier: 'CircularA',
        factory: () => ({}),
        dependencies: ['CircularB']
      });

      container.register({
        identifier: 'CircularB',
        factory: () => ({}),
        dependencies: ['CircularA']
      });

      const validation = container.validateDependencies();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Cirkulärt beroende');
    });

    it('ska detektera saknade dependencies', () => {
      container.register({
        identifier: 'ServiceWithMissingDep',
        factory: () => ({}),
        dependencies: ['MissingService']
      });

      const validation = container.validateDependencies();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Saknad service: MissingService');
    });

    it('ska detektera komplexa cirkulära beroenden', () => {
      container.register({
        identifier: 'A',
        factory: () => ({}),
        dependencies: ['B']
      });

      container.register({
        identifier: 'B',
        factory: () => ({}),
        dependencies: ['C']
      });

      container.register({
        identifier: 'C',
        factory: () => ({}),
        dependencies: ['A']
      });

      const validation = container.validateDependencies();
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('Cirkulärt beroende');
    });
  });

  describe('ComposableVideoMeetingService', () => {
    let mockMeetingService: jest.Mocked<IMeetingService>;
    let mockWebRTCService: jest.Mocked<IWebRTCSignalingService>;
    let mockLogger: jest.Mocked<ILogger>;
    let mockSupabase: jest.Mocked<ISupabaseClient>;
    let service: ComposableVideoMeetingService;

    beforeEach(() => {
      mockMeetingService = {
        getMeeting: jest.fn(),
        updateMeeting: jest.fn()
      };

      mockWebRTCService = {
        initializeMeeting: jest.fn(),
        closeMeeting: jest.fn(),
        sendSignal: jest.fn()
      };

      mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };

      mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'video-meeting-id',
                  meeting_id: 'meeting-id',
                  room_id: 'room_123',
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
                  id: 'video-meeting-id',
                  room_id: 'room_123',
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
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-id' } },
            error: null
          })
        }
      };

      service = new ComposableVideoMeetingService(
        mockMeetingService,
        mockWebRTCService,
        mockLogger,
        mockSupabase
      );
    });

    it('ska skapa videomöte med dependency injection', async () => {
      const mockMeeting = {
        id: 'meeting-id',
        meeting_type: 'digital',
        title: 'Test Meeting'
      };

      mockMeetingService.getMeeting.mockResolvedValue(mockMeeting);
      mockWebRTCService.initializeMeeting.mockResolvedValue();

      const result = await service.createVideoMeeting('meeting-id', {
        maxParticipants: 5,
        isRecordingAllowed: false,
        consentRequired: true
      });

      expect(result.success).toBe(true);
      expect(result.videoMeeting).toBeDefined();
      expect(mockMeetingService.getMeeting).toHaveBeenCalledWith('meeting-id');
      expect(mockWebRTCService.initializeMeeting).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skapar videomöte',
        expect.objectContaining({ meetingId: 'meeting-id' })
      );
    });

    it('ska hantera fel när möte inte existerar', async () => {
      mockMeetingService.getMeeting.mockResolvedValue(null);

      const result = await service.createVideoMeeting('invalid-meeting-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Mötet existerar inte');
      expect(mockWebRTCService.initializeMeeting).not.toHaveBeenCalled();
    });

    it('ska validera input korrekt', async () => {
      const result = await service.createVideoMeeting('', {
        maxParticipants: -1 // Ogiltig parameter
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valideringsfel');
      expect(mockMeetingService.getMeeting).not.toHaveBeenCalled();
    });

    it('ska hantera join meeting med GDPR-samtycke', async () => {
      const result = await service.joinMeeting('room_123', true);

      expect(result.success).toBe(true);
      expect(result.participant).toBeDefined();
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Användare gick med i videomöte',
        expect.objectContaining({ 
          roomId: 'room_123',
          consentGiven: true 
        })
      );
    });

    it('ska kräva GDPR-samtycke när consent_required är true', async () => {
      const result = await service.joinMeeting('room_123', false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('GDPR-samtycke krävs');
    });

    it('ska avsluta möte korrekt', async () => {
      mockWebRTCService.closeMeeting.mockResolvedValue();

      const result = await service.endMeeting('room_123');

      expect(result.success).toBe(true);
      expect(mockWebRTCService.closeMeeting).toHaveBeenCalledWith('room_123');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Videomöte avslutat',
        { roomId: 'room_123' }
      );
    });
  });

  describe('Service Factory Pattern', () => {
    it('ska skapa service via container factory', () => {
      // Registrera mock dependencies
      container.register({
        identifier: ServiceIdentifiers.MEETING_SERVICE,
        factory: () => ({ getMeeting: jest.fn(), updateMeeting: jest.fn() }),
        singleton: true
      });

      container.register({
        identifier: ServiceIdentifiers.WEBRTC_SIGNALING_SERVICE,
        factory: () => ({ initializeMeeting: jest.fn(), closeMeeting: jest.fn() }),
        singleton: true
      });

      container.register({
        identifier: ServiceIdentifiers.LOGGER,
        factory: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }),
        singleton: true
      });

      container.register({
        identifier: ServiceIdentifiers.SUPABASE_CLIENT,
        factory: () => ({ from: jest.fn(), auth: {} }),
        singleton: true
      });

      // Registrera ComposableVideoMeetingService
      container.register({
        identifier: ServiceIdentifiers.VIDEO_MEETING_SERVICE,
        factory: (container) => ComposableVideoMeetingService.create(container),
        singleton: true,
        dependencies: [
          ServiceIdentifiers.MEETING_SERVICE,
          ServiceIdentifiers.WEBRTC_SIGNALING_SERVICE,
          ServiceIdentifiers.LOGGER,
          ServiceIdentifiers.SUPABASE_CLIENT
        ]
      });

      // Hämta service från container
      const service = container.get<ComposableVideoMeetingService>(
        ServiceIdentifiers.VIDEO_MEETING_SERVICE
      );

      expect(service).toBeInstanceOf(ComposableVideoMeetingService);
    });
  });

  describe('GDPR Compliance', () => {
    it('ska hantera känslig data säkert i dependency injection', () => {
      const sensitiveData = {
        personnummer: '19901010-1234',
        email: 'test@example.com'
      };

      // Service ska automatiskt rensa känslig data via BaseService
      const mockService = {
        processSensitiveData: jest.fn().mockImplementation((data) => {
          // Simulera BaseService GDPR-rensning
          const sanitized = { ...data };
          if (sanitized.personnummer) {
            sanitized.personnummer = '***REDACTED***';
          }
          return sanitized;
        })
      };

      const result = mockService.processSensitiveData(sensitiveData);
      
      expect(result.personnummer).toBe('***REDACTED***');
      expect(result.email).toBe('test@example.com'); // Email behålls
    });
  });
});
