/**
 * GDPR Compliance Tests - Service Layer BaseService Migration
 * 
 * Validerar GDPR-efterlevnad för migrerade tjänster:
 * - Audit trail-loggning för backup-operationer
 * - Recording consent-validering i WebRTC-tjänster
 * - Känslig data-anonymisering och skrubbning
 * - Cache cleanup och dataretention-policies
 * 
 * Följer svensk dataskyddslagstiftning och GDPR-krav.
 */

import { BackupServiceMigrated } from '../../src/services/BackupServiceMigrated';
import { WebRTCPeerServiceMigrated } from '../../src/services/WebRTCPeerServiceMigrated';
import { sentryMigrationMonitor } from '../../src/monitoring/sentryMigrationMonitoring';
import { MigrationMonitor } from '../../src/utils/migrationMonitoring';
import { testUtils } from '../utils/testUtils';

// Mock Supabase
const mockSupabaseClient = testUtils.setupSupabaseMock();

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  configureScope: jest.fn(),
  startTransaction: jest.fn(() => ({
    setTag: jest.fn(),
    setContext: jest.fn(),
    setData: jest.fn(),
    setStatus: jest.fn(),
    finish: jest.fn(),
  })),
}));

describe('GDPR Compliance - Service Layer Migration', () => {
  let backupService: BackupServiceMigrated;
  let webrtcService: WebRTCPeerServiceMigrated;

  beforeEach(() => {
    jest.clearAllMocks();
    backupService = new BackupServiceMigrated();
    webrtcService = new WebRTCPeerServiceMigrated();
  });

  describe('Audit Trail Logging', () => {
    it('ska logga audit trail för backup-operationer med GDPR-säker data', async () => {
      // Arrange
      const testData = {
        meetingId: 'meeting_123',
        userId: 'user_456',
        timestamp: new Date().toISOString(),
        data: { title: 'Styrelsemöte', participants: ['Anna', 'Björn'] },
      };

      const mockAuditLog = jest.fn();
      (backupService as any).auditLog = mockAuditLog;

      // Act
      await backupService.createBackup(testData.meetingId, testData.data);

      // Assert
      expect(mockAuditLog).toHaveBeenCalledWith({
        operation: 'backup_create',
        meetingId: testData.meetingId,
        userId: expect.stringMatching(/^anon_[a-z0-9]{8}$/), // Anonymiserat
        timestamp: expect.any(String),
        dataSize: expect.any(Number),
        gdprCompliant: true,
        retentionPolicy: 'meeting_data_7_years',
      });
    });

    it('ska anonymisera känslig data i audit logs', async () => {
      // Arrange
      const sensitiveData = {
        meetingId: 'meeting_123',
        userId: 'user_456',
        personnummer: '19901201-1234',
        email: 'test@example.com',
        data: { content: 'Känslig information' },
      };

      const mockAuditLog = jest.fn();
      (backupService as any).auditLog = mockAuditLog;

      // Act
      await backupService.createBackup(sensitiveData.meetingId, sensitiveData);

      // Assert
      const auditCall = mockAuditLog.mock.calls[0][0];
      expect(auditCall.userId).toMatch(/^anon_[a-z0-9]{8}$/);
      expect(auditCall.personnummer).toBeUndefined();
      expect(auditCall.email).toBeUndefined();
      expect(auditCall.gdprCompliant).toBe(true);
    });

    it('ska inkludera dataretention-information i audit logs', async () => {
      // Arrange
      const testData = {
        meetingId: 'meeting_123',
        data: { type: 'protocol', content: 'Mötesprotokoll' },
      };

      const mockAuditLog = jest.fn();
      (backupService as any).auditLog = mockAuditLog;

      // Act
      await backupService.createBackup(testData.meetingId, testData.data);

      // Assert
      const auditCall = mockAuditLog.mock.calls[0][0];
      expect(auditCall.retentionPolicy).toBeDefined();
      expect(auditCall.retentionPolicy).toMatch(/^(meeting_data_7_years|protocol_data_10_years)$/);
      expect(auditCall.gdprCompliant).toBe(true);
    });
  });

  describe('Recording Consent Validation', () => {
    it('ska validera recording consent innan WebRTC-session startas', async () => {
      // Arrange
      const sessionConfig = {
        meetingId: 'meeting_123',
        userId: 'user_456',
        recordingEnabled: true,
        consentGiven: true,
        consentTimestamp: new Date().toISOString(),
      };

      const mockValidateConsent = jest.fn().mockResolvedValue(true);
      (webrtcService as any).validateRecordingConsent = mockValidateConsent;

      // Act
      await webrtcService.startSession(sessionConfig);

      // Assert
      expect(mockValidateConsent).toHaveBeenCalledWith({
        userId: sessionConfig.userId,
        meetingId: sessionConfig.meetingId,
        consentGiven: sessionConfig.consentGiven,
        consentTimestamp: sessionConfig.consentTimestamp,
        gdprCompliant: true,
      });
    });

    it('ska neka recording om consent inte givits', async () => {
      // Arrange
      const sessionConfig = {
        meetingId: 'meeting_123',
        userId: 'user_456',
        recordingEnabled: true,
        consentGiven: false,
      };

      // Act & Assert
      await expect(webrtcService.startSession(sessionConfig))
        .rejects.toThrow('Recording consent krävs enligt GDPR');
    });

    it('ska logga consent-validering för audit trail', async () => {
      // Arrange
      const sessionConfig = {
        meetingId: 'meeting_123',
        userId: 'user_456',
        recordingEnabled: true,
        consentGiven: true,
        consentTimestamp: new Date().toISOString(),
      };

      const mockAuditLog = jest.fn();
      (webrtcService as any).auditLog = mockAuditLog;

      // Act
      await webrtcService.startSession(sessionConfig);

      // Assert
      expect(mockAuditLog).toHaveBeenCalledWith({
        operation: 'recording_consent_validation',
        meetingId: sessionConfig.meetingId,
        userId: expect.stringMatching(/^anon_[a-z0-9]{8}$/),
        consentGiven: true,
        consentTimestamp: sessionConfig.consentTimestamp,
        gdprCompliant: true,
        legalBasis: 'consent_article_6_1_a',
      });
    });
  });

  describe('Sensitive Data Anonymization', () => {
    it('ska anonymisera personnummer i Sentry-rapporter', () => {
      // Arrange
      const errorWithPersonnummer = new Error('Fel med personnummer 19901201-1234');
      const context = {
        userId: 'user_456',
        personnummer: '19901201-1234',
        sessionData: 'Känslig session-data',
      };

      // Act
      sentryMigrationMonitor.reportMigrationError('TestService', errorWithPersonnummer, context);

      // Assert
      const sentryCall = require('@sentry/react-native').captureException.mock.calls[0];
      const sentryData = sentryCall[1];
      
      expect(sentryData.extra.context.personnummer).toBe('[REDACTED]');
      expect(sentryData.extra.context.userId).toMatch(/^anon_[a-z0-9]{8}$/);
      expect(sentryData.extra.swedishMessage).toContain('TestService');
      expect(sentryData.extra.swedishMessage).not.toContain('19901201-1234');
    });

    it('ska skrubba känslig data från migration events', () => {
      // Arrange
      const sensitiveEvent = {
        serviceName: 'BackupService',
        eventType: 'success' as const,
        isMigrated: true,
        success: true,
        loadTime: 150,
        fallbackUsed: false,
        metadata: {
          userId: 'user_456',
          personnummer: '19901201-1234',
          email: 'test@example.com',
          sessionId: 'session_789',
        },
      };

      // Act
      MigrationMonitor.getInstance().logMigrationEvent(sensitiveEvent);

      // Assert
      const events = MigrationMonitor.getInstance().getEvents();
      const loggedEvent = events[events.length - 1];
      
      expect(loggedEvent.metadata.personnummer).toBeUndefined();
      expect(loggedEvent.metadata.email).toBeUndefined();
      expect(loggedEvent.metadata.userId).toMatch(/^anon_[a-z0-9]{8}$/);
      expect(loggedEvent.metadata.sessionId).toMatch(/^anon_[a-z0-9]{8}$/);
    });
  });

  describe('Cache Cleanup and Data Retention', () => {
    it('ska rensa cache enligt GDPR dataretention-policies', async () => {
      // Arrange
      const testData = { meetingId: 'meeting_123', data: 'Test data' };
      await backupService.createBackup(testData.meetingId, testData.data);

      const mockClearExpiredCache = jest.fn();
      (backupService as any).clearExpiredCache = mockClearExpiredCache;

      // Act
      await (backupService as any).enforceDataRetention();

      // Assert
      expect(mockClearExpiredCache).toHaveBeenCalledWith({
        maxAge: expect.any(Number), // 7 år för mötesdata
        gdprCompliant: true,
        auditLog: true,
      });
    });

    it('ska logga cache cleanup för audit trail', async () => {
      // Arrange
      const mockAuditLog = jest.fn();
      (backupService as any).auditLog = mockAuditLog;

      // Act
      await (backupService as any).clearExpiredCache({
        maxAge: 7 * 365 * 24 * 60 * 60 * 1000, // 7 år
        gdprCompliant: true,
        auditLog: true,
      });

      // Assert
      expect(mockAuditLog).toHaveBeenCalledWith({
        operation: 'cache_cleanup',
        timestamp: expect.any(String),
        itemsRemoved: expect.any(Number),
        retentionPolicy: 'meeting_data_7_years',
        gdprCompliant: true,
        legalBasis: 'legitimate_interest_article_6_1_f',
      });
    });

    it('ska respektera användarens rätt att bli glömd', async () => {
      // Arrange
      const userId = 'user_456';
      const testData = { meetingId: 'meeting_123', userId, data: 'User data' };
      await backupService.createBackup(testData.meetingId, testData.data);

      const mockDeleteUserData = jest.fn();
      (backupService as any).deleteUserData = mockDeleteUserData;

      // Act
      await (backupService as any).processDataDeletionRequest(userId);

      // Assert
      expect(mockDeleteUserData).toHaveBeenCalledWith({
        userId,
        deleteFromCache: true,
        deleteFromBackups: true,
        auditLog: true,
        gdprCompliant: true,
        legalBasis: 'right_to_be_forgotten_article_17',
      });
    });
  });

  describe('Swedish Localization for GDPR Messages', () => {
    it('ska visa svenska felmeddelanden för GDPR-relaterade fel', async () => {
      // Arrange
      const consentError = new Error('Recording consent required');
      
      // Act
      sentryMigrationMonitor.reportMigrationError('WebRTCPeerService', consentError);

      // Assert
      const sentryCall = require('@sentry/react-native').captureException.mock.calls[0];
      const swedishMessage = sentryCall[1].extra.swedishMessage;
      
      expect(swedishMessage).toContain('WebRTCPeerService');
      expect(swedishMessage).toMatch(/inspelning|samtycke|gdpr/i);
    });

    it('ska använda svenska etiketter i audit logs', async () => {
      // Arrange
      const testData = { meetingId: 'meeting_123', data: 'Test data' };
      const mockAuditLog = jest.fn();
      (backupService as any).auditLog = mockAuditLog;

      // Act
      await backupService.createBackup(testData.meetingId, testData.data);

      // Assert
      const auditCall = mockAuditLog.mock.calls[0][0];
      expect(auditCall.operation).toMatch(/^(backup_create|säkerhetskopiering_skapad)$/);
      expect(auditCall.retentionPolicy).toMatch(/^(meeting_data_7_years|mötesdata_7_år)$/);
    });
  });

  describe('Production Environment Validation', () => {
    it('ska validera GDPR-efterlevnad i produktionsmiljö', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Act
      const gdprCompliant = (backupService as any).validateGDPRCompliance();

      // Assert
      expect(gdprCompliant).toBe(true);
      expect(gdprCompliant).toEqual({
        auditTrailEnabled: true,
        dataAnonymization: true,
        consentValidation: true,
        dataRetention: true,
        rightToBeForgotten: true,
        swedishLocalization: true,
      });

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('ska ha korrekt dataretention-konfiguration för svenska lagar', () => {
      // Arrange & Act
      const retentionPolicies = (backupService as any).getDataRetentionPolicies();

      // Assert
      expect(retentionPolicies).toEqual({
        meetingData: '7_years', // Aktiebolagslagen
        protocolData: '10_years', // Bokföringslagen
        audioRecordings: '3_years', // GDPR minimering
        userConsent: '3_years', // GDPR dokumentation
        auditLogs: '6_years', // Säkerhetsloggning
      });
    });
  });
});

/**
 * Integration tests för GDPR-efterlevnad i produktionsmiljö
 */
describe('GDPR Production Integration', () => {
  beforeEach(() => {
    // Sätt produktionsmiljö för realistiska tester
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('ska hantera fullständig GDPR-workflow för backup-operationer', async () => {
    // Arrange
    const backupService = new BackupServiceMigrated();
    const testData = {
      meetingId: 'meeting_prod_123',
      userId: 'user_prod_456',
      data: {
        title: 'Produktionsmöte',
        participants: ['Anna Andersson', 'Björn Svensson'],
        recording: true,
        consentGiven: true,
      },
    };

    // Act & Assert - Fullständig GDPR-workflow
    const result = await backupService.createBackup(testData.meetingId, testData.data);
    
    expect(result.gdprCompliant).toBe(true);
    expect(result.auditTrail).toBeDefined();
    expect(result.dataRetentionPolicy).toBe('meeting_data_7_years');
    expect(result.anonymizedUserId).toMatch(/^anon_[a-z0-9]{8}$/);
  });

  it('ska hantera WebRTC recording consent i produktionsmiljö', async () => {
    // Arrange
    const webrtcService = new WebRTCPeerServiceMigrated();
    const sessionConfig = {
      meetingId: 'meeting_prod_123',
      userId: 'user_prod_456',
      recordingEnabled: true,
      consentGiven: true,
      consentTimestamp: new Date().toISOString(),
      gdprCompliant: true,
    };

    // Act
    const session = await webrtcService.startSession(sessionConfig);

    // Assert
    expect(session.gdprCompliant).toBe(true);
    expect(session.consentValidated).toBe(true);
    expect(session.auditTrail).toBeDefined();
    expect(session.dataRetentionPolicy).toBe('audio_recordings_3_years');
  });
});
