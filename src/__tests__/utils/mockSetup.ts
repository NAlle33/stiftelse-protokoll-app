/**
 * Centralized Mock Setup Utilities for Swedish Board Meeting App
 * Provides consistent service mocking with Swedish localization and GDPR compliance
 */

import { jest } from '@jest/globals';

// Types for service mocks
export interface MockMeetingService {
  createMeeting: jest.Mock;
  getMeeting: jest.Mock;
  getUserMeetings: jest.Mock;
  updateMeeting: jest.Mock;
  deleteMeeting: jest.Mock;
  progressMeetingStatus: jest.Mock;
  validateMeetingAccess: jest.Mock;
}

export interface MockProtocolAIService {
  generateProtocol: jest.Mock;
  subscribeToStatus: jest.Mock;
  estimateCost: jest.Mock;
}

export interface MockProtocolService {
  // Basic Operations
  getTemplates: jest.Mock;
  getTemplateById: jest.Mock;
  createProtocol: jest.Mock;
  getProtocol: jest.Mock;
  getProtocolsForMeeting: jest.Mock;
  updateProtocol: jest.Mock;
  updateProtocolSection: jest.Mock;
  generateProtocolFromTranscription: jest.Mock;

  // Version Management
  createVersion: jest.Mock;
  getVersionHistory: jest.Mock;
  getCurrentVersion: jest.Mock;
  getVersion: jest.Mock;
  compareVersions: jest.Mock;
  revertToVersion: jest.Mock;
  isProtocolLocked: jest.Mock;
  lockVersion: jest.Mock;

  // History Management
  getUserProtocols: jest.Mock;
  searchProtocols: jest.Mock;
  getProtocolContent: jest.Mock;
  exportProtocol: jest.Mock;
  deleteProtocol: jest.Mock;

  // Signing Workflows
  initiateSigningFlow: jest.Mock;
  signProtocol: jest.Mock;
  getSigningFlow: jest.Mock;
  getSigningFlowsForProtocol: jest.Mock;
  cancelSigningFlow: jest.Mock;
  verifySigningIntegrity: jest.Mock;

  // Archive Management
  createLongTermArchive: jest.Mock;
  getArchivedProtocol: jest.Mock;
  listArchivedProtocols: jest.Mock;
  scheduleDestruction: jest.Mock;
  destroyArchive: jest.Mock;
  verifyArchiveIntegrity: jest.Mock;

  // Legacy methods for backward compatibility
  generateProtocol: jest.Mock;
  saveProtocol: jest.Mock;
  validateProtocolData: jest.Mock;
}

export interface MockAuthService {
  authenticate: jest.Mock;
  validateSession: jest.Mock;
  logout: jest.Mock;
  refreshToken: jest.Mock;
  validateBankID: jest.Mock;
  checkPermissions: jest.Mock;
}

export interface MockAuditService {
  logAction: jest.Mock;
  getAuditTrail: jest.Mock;
  validateGDPRCompliance: jest.Mock;
  anonymizeData: jest.Mock;
  exportAuditLog: jest.Mock;
  // Additional methods for E2E security tests
  logBreachEvent: jest.Mock;
  logIncidentResponse: jest.Mock;
  logRecoveryAction: jest.Mock;
  logSystemEvent: jest.Mock;
  logUserGuidance: jest.Mock;
  logGDPREvent: jest.Mock;
  logDataProcessingEvent: jest.Mock;
  logEncryptionEvent: jest.Mock;
  logKeyManagementEvent: jest.Mock;
  logSecurityEvent: jest.Mock;
  createBreachAuditTrail: jest.Mock;
  logUserAction: jest.Mock;
}

export interface MockRateLimitService {
  checkRateLimit: jest.Mock;
  incrementCounter: jest.Mock;
  resetCounter: jest.Mock;
  getUsageStats: jest.Mock;
}

export interface MockSearchService {
  searchMeetings: jest.Mock;
  searchProtocols: jest.Mock;
  indexMeeting: jest.Mock;
  updateIndex: jest.Mock;
}

export interface MockNotificationService {
  sendNotification: jest.Mock;
  scheduleNotification: jest.Mock;
  cancelNotification: jest.Mock;
  getNotificationHistory: jest.Mock;
  validateGDPRConsent: jest.Mock;
}

/**
 * Setup comprehensive service mocks with Swedish localization and GDPR compliance
 */
export const setupServiceMocks = () => {
  // Meeting Service Mock
  const mockMeetingService: MockMeetingService = {
    createMeeting: jest.fn().mockResolvedValue({
      id: 'test-meeting-id',
      title: 'Test Styrelsemöte',
      status: 'planerat',
      created_at: new Date().toISOString(),
      gdpr_compliant: true
    }),
    getMeeting: jest.fn().mockResolvedValue({
      id: 'test-meeting-id',
      title: 'Test Styrelsemöte',
      status: 'planerat',
      participants: [],
      gdpr_compliant: true
    }),
    getUserMeetings: jest.fn().mockResolvedValue([
      {
        id: 'meeting-1',
        title: 'Styrelsemöte Januari',
        status: 'planerat',
        date: '2024-01-15',
        gdpr_compliant: true
      }
    ]),
    updateMeeting: jest.fn().mockResolvedValue({
      success: true,
      message: 'Möte uppdaterat framgångsrikt'
    }),
    deleteMeeting: jest.fn().mockResolvedValue({
      success: true,
      message: 'Möte raderat enligt GDPR-krav'
    }),
    progressMeetingStatus: jest.fn().mockResolvedValue({
      success: true,
      newStatus: 'pågående'
    }),
    validateMeetingAccess: jest.fn().mockResolvedValue(true)
  };

  // Protocol Service Mock - Consolidated Service
  const mockProtocolService: MockProtocolService = {
    // Basic Operations
    getTemplates: jest.fn().mockReturnValue([
      { id: 'board-meeting', name: 'Styrelsemöte', sections: [] },
      { id: 'annual-meeting', name: 'Årsmöte', sections: [] }
    ]),
    getTemplateById: jest.fn().mockReturnValue({
      id: 'board-meeting',
      name: 'Styrelsemöte',
      sections: [{ id: 'decisions', title: 'Beslut', content: '' }]
    }),
    createProtocol: jest.fn().mockResolvedValue({
      id: 'protocol-id',
      meeting_id: 'meeting-id',
      title: 'Test Protokoll',
      status: 'draft',
      sections: [],
      created_at: new Date().toISOString()
    }),
    getProtocol: jest.fn().mockResolvedValue({
      id: 'protocol-id',
      title: 'Test Protokoll',
      status: 'draft',
      sections: [],
      gdpr_compliant: true
    }),
    getProtocolsForMeeting: jest.fn().mockResolvedValue([
      {
        id: 'protocol-1',
        title: 'Protokoll 1',
        status: 'draft',
        created_at: new Date().toISOString()
      }
    ]),
    updateProtocol: jest.fn().mockResolvedValue(true),
    updateProtocolSection: jest.fn().mockResolvedValue(true),
    generateProtocolFromTranscription: jest.fn().mockResolvedValue({
      id: 'protocol-id',
      title: 'Genererat Protokoll',
      status: 'draft',
      sections: []
    }),

    // Version Management
    createVersion: jest.fn().mockResolvedValue({
      id: 'version-id',
      protocol_id: 'protocol-id',
      version_number: 1,
      content: 'Protokollinnehåll',
      content_hash: 'hash123',
      changes_summary: 'Första versionen',
      created_by: 'user-id',
      created_at: new Date().toISOString(),
      is_current: true,
      signature_status: 'unsigned',
      locked: false
    }),
    getVersionHistory: jest.fn().mockResolvedValue([
      {
        id: 'version-1',
        version_number: 1,
        changes_summary: 'Första versionen',
        created_at: new Date().toISOString()
      }
    ]),
    getCurrentVersion: jest.fn().mockResolvedValue({
      id: 'current-version',
      version_number: 1,
      is_current: true,
      signature_status: 'unsigned'
    }),
    getVersion: jest.fn().mockResolvedValue({
      id: 'version-id',
      content: 'Dekrypterat innehåll',
      version_number: 1
    }),
    compareVersions: jest.fn().mockResolvedValue([
      {
        type: 'modified',
        section: 'content',
        oldContent: 'Gammalt innehåll',
        newContent: 'Nytt innehåll',
        lineNumber: 1
      }
    ]),
    revertToVersion: jest.fn().mockResolvedValue({
      id: 'new-version',
      version_number: 2,
      changes_summary: 'Återställd till version 1'
    }),
    isProtocolLocked: jest.fn().mockResolvedValue(false),
    lockVersion: jest.fn().mockResolvedValue(true),

    // History Management
    getUserProtocols: jest.fn().mockResolvedValue([
      {
        id: 'protocol-1',
        title: 'Styrelsemöte Januari',
        meeting_date: '2024-01-15',
        status: 'completed',
        created_at: new Date().toISOString()
      }
    ]),
    searchProtocols: jest.fn().mockResolvedValue([
      {
        id: 'protocol-1',
        title: 'Sökresultat Protokoll',
        meeting_date: '2024-01-15',
        status: 'completed'
      }
    ]),
    getProtocolContent: jest.fn().mockResolvedValue('Protokollinnehåll från fil'),
    exportProtocol: jest.fn().mockResolvedValue('Exporterat innehåll'),
    deleteProtocol: jest.fn().mockResolvedValue(true),

    // Signing Workflows
    initiateSigningFlow: jest.fn().mockResolvedValue({
      id: 'signing-flow-id',
      protocol_id: 'protocol-id',
      status: 'pending',
      required_signatures: [],
      completed_signatures: [],
      created_at: new Date().toISOString(),
      immutable_hash: 'hash123'
    }),
    signProtocol: jest.fn().mockResolvedValue({
      id: 'signature-id',
      user_id: 'user-id',
      signed_at: new Date().toISOString(),
      bankid_reference: 'bankid-ref'
    }),
    getSigningFlow: jest.fn().mockResolvedValue({
      id: 'signing-flow-id',
      status: 'pending',
      required_signatures: [],
      completed_signatures: []
    }),
    getSigningFlowsForProtocol: jest.fn().mockResolvedValue([
      {
        id: 'signing-flow-1',
        status: 'completed',
        created_at: new Date().toISOString()
      }
    ]),
    cancelSigningFlow: jest.fn().mockResolvedValue(true),
    verifySigningIntegrity: jest.fn().mockResolvedValue(true),

    // Archive Management
    createLongTermArchive: jest.fn().mockResolvedValue({
      id: 'archive-id',
      protocol_id: 'protocol-id',
      signing_flow_id: 'signing-flow-id',
      archive_hash: 'archive-hash',
      created_at: new Date().toISOString(),
      retention_until: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      legal_status: 'active'
    }),
    getArchivedProtocol: jest.fn().mockResolvedValue({
      protocol_id: 'protocol-id',
      content: 'Arkiverat innehåll',
      signatures: [],
      metadata: {
        title: 'Arkiverat Protokoll',
        meeting_date: '2024-01-15',
        participants: ['user-1'],
        legal_requirements: ['BankID-signering', 'GDPR-efterlevnad']
      }
    }),
    listArchivedProtocols: jest.fn().mockResolvedValue([
      {
        id: 'archive-1',
        protocol_id: 'protocol-1',
        created_at: new Date().toISOString(),
        legal_status: 'active'
      }
    ]),
    scheduleDestruction: jest.fn().mockResolvedValue(undefined),
    destroyArchive: jest.fn().mockResolvedValue(undefined),
    verifyArchiveIntegrity: jest.fn().mockResolvedValue(true),

    // Legacy methods for backward compatibility
    generateProtocol: jest.fn().mockResolvedValue({
      id: 'protocol-id',
      content: 'Genererat protokoll med AI',
      status: 'utkast',
      gdpr_compliant: true,
      anonymized_data: true
    }),
    saveProtocol: jest.fn().mockResolvedValue({
      success: true,
      message: 'Protokoll sparat med GDPR-skydd'
    }),
    validateProtocolData: jest.fn().mockResolvedValue({
      valid: true,
      gdpr_compliant: true,
      issues: []
    })
  };

  // Protocol AI Service Mock
  const mockProtocolAIService: MockProtocolAIService = {
    generateProtocol: jest.fn().mockResolvedValue({
      id: 'ai-protocol-id',
      content: 'AI-genererat protokoll med svenska lokaliseringar',
      status: 'completed',
      cost: { estimatedCost: 0.05, currency: 'SEK' },
      gdpr_compliant: true,
      anonymized_data: true
    }),
    subscribeToStatus: jest.fn().mockImplementation((meetingId, callback) => {
      // Simulera statusuppdateringar
      setTimeout(() => callback({ status: 'processing', progress: 50 }), 100);
      setTimeout(() => callback({ status: 'completed', progress: 100 }), 200);
    }),
    estimateCost: jest.fn().mockReturnValue({
      estimatedCost: 0.05,
      currency: 'SEK'
    })
  };

  // Auth Service Mock
  const mockAuthService: MockAuthService = {
    authenticate: jest.fn().mockResolvedValue({
      success: true,
      user: {
        id: 'user-id',
        name: 'Test Användare',
        role: 'styrelseledamot'
      },
      session: 'session-token',
      gdpr_consent: true
    }),
    validateSession: jest.fn().mockResolvedValue({
      valid: true,
      expires_at: new Date(Date.now() + 3600000).toISOString()
    }),
    logout: jest.fn().mockResolvedValue({
      success: true,
      message: 'Utloggning genomförd säkert'
    }),
    refreshToken: jest.fn().mockResolvedValue({
      success: true,
      new_token: 'refreshed-token'
    }),
    validateBankID: jest.fn().mockResolvedValue({
      valid: true,
      personnummer: 'anonymized-***',
      gdpr_compliant: true
    }),
    checkPermissions: jest.fn().mockResolvedValue({
      hasAccess: true,
      permissions: ['read', 'write']
    })
  };

  // Audit Service Mock
  const mockAuditService: MockAuditService = {
    logAction: jest.fn().mockResolvedValue({
      success: true,
      audit_id: 'audit-entry-id',
      gdpr_compliant: true
    }),
    getAuditTrail: jest.fn().mockResolvedValue([
      {
        id: 'audit-1',
        action: 'möte_skapat',
        timestamp: new Date().toISOString(),
        user_id: 'anonymized-user',
        gdpr_anonymized: true
      }
    ]),
    validateGDPRCompliance: jest.fn().mockResolvedValue({
      compliant: true,
      issues: [],
      anonymization_level: 'full'
    }),
    anonymizeData: jest.fn().mockResolvedValue({
      success: true,
      anonymized_fields: ['personnummer', 'email'],
      gdpr_compliant: true
    }),
    exportAuditLog: jest.fn().mockResolvedValue({
      success: true,
      format: 'CSV',
      gdpr_anonymized: true
    }),
    // Additional methods for E2E security tests
    logBreachEvent: jest.fn().mockResolvedValue({ success: true }),
    logIncidentResponse: jest.fn().mockResolvedValue({ success: true }),
    logRecoveryAction: jest.fn().mockResolvedValue({ success: true }),
    logSystemEvent: jest.fn().mockResolvedValue({ success: true }),
    logUserGuidance: jest.fn().mockResolvedValue({ success: true }),
    logGDPREvent: jest.fn().mockResolvedValue({ success: true }),
    logDataProcessingEvent: jest.fn().mockResolvedValue({ success: true }),
    logEncryptionEvent: jest.fn().mockResolvedValue({ success: true }),
    logKeyManagementEvent: jest.fn().mockResolvedValue({ success: true }),
    logSecurityEvent: jest.fn().mockResolvedValue({ success: true }),
    createBreachAuditTrail: jest.fn().mockResolvedValue({ success: true }),
    logUserAction: jest.fn().mockResolvedValue({ success: true })
  };

  // Rate Limit Service Mock
  const mockRateLimitService: MockRateLimitService = {
    checkRateLimit: jest.fn().mockResolvedValue({
      allowed: true,
      remaining: 95,
      reset_time: new Date(Date.now() + 3600000).toISOString()
    }),
    incrementCounter: jest.fn().mockResolvedValue({
      success: true,
      current_count: 5
    }),
    resetCounter: jest.fn().mockResolvedValue({
      success: true,
      message: 'Räknare återställd'
    }),
    getUsageStats: jest.fn().mockResolvedValue({
      total_requests: 100,
      period: '1h',
      gdpr_anonymized: true
    })
  };

  // Search Service Mock
  const mockSearchService: MockSearchService = {
    searchMeetings: jest.fn().mockResolvedValue([
      {
        id: 'meeting-1',
        title: 'Styrelsemöte Januari',
        relevance: 0.95,
        gdpr_compliant: true
      }
    ]),
    searchProtocols: jest.fn().mockResolvedValue([
      {
        id: 'protocol-1',
        title: 'Protokoll Januari',
        relevance: 0.88,
        gdpr_anonymized: true
      }
    ]),
    indexMeeting: jest.fn().mockResolvedValue({
      success: true,
      indexed_id: 'meeting-index-id'
    }),
    updateIndex: jest.fn().mockResolvedValue({
      success: true,
      message: 'Index uppdaterat'
    })
  };

  // Notification Service Mock
  const mockNotificationService: MockNotificationService = {
    sendNotification: jest.fn().mockResolvedValue({
      success: true,
      notification_id: 'notif-id',
      gdpr_consent_verified: true
    }),
    scheduleNotification: jest.fn().mockResolvedValue({
      success: true,
      scheduled_id: 'scheduled-notif-id',
      send_time: new Date(Date.now() + 3600000).toISOString()
    }),
    cancelNotification: jest.fn().mockResolvedValue({
      success: true,
      message: 'Notifiering avbruten'
    }),
    getNotificationHistory: jest.fn().mockResolvedValue([
      {
        id: 'notif-1',
        type: 'möte_påminnelse',
        sent_at: new Date().toISOString(),
        gdpr_anonymized: true
      }
    ]),
    validateGDPRConsent: jest.fn().mockResolvedValue({
      valid: true,
      consent_date: new Date().toISOString(),
      consent_type: 'explicit'
    })
  };

  return {
    mockMeetingService,
    mockProtocolService,
    mockProtocolAIService,
    mockAuthService,
    mockAuditService,
    mockRateLimitService,
    mockSearchService,
    mockNotificationService
  };
};

/**
 * Reset all service mocks to their initial state
 * Call this in beforeEach to ensure clean test state
 */
export const resetServiceMocks = (mocks: ReturnType<typeof setupServiceMocks>) => {
  Object.values(mocks).forEach(serviceMock => {
    Object.values(serviceMock).forEach(mockFn => {
      if (jest.isMockFunction(mockFn)) {
        mockFn.mockClear();
      }
    });
  });
};

/**
 * Setup error scenarios for testing with Swedish error messages
 */
export const setupErrorScenarios = () => {
  return {
    networkError: new Error('Nätverksfel - kontrollera internetanslutningen'),
    authError: new Error('Autentiseringsfel - sessionen har gått ut'),
    gdprError: new Error('GDPR-fel - användarens samtycke krävs'),
    validationError: new Error('Valideringsfel - ogiltiga data'),
    rateLimitError: new Error('För många förfrågningar - försök igen senare'),
    storageError: new Error('Lagringsfel - kunde inte spara data'),
    permissionError: new Error('Behörighetsfel - åtkomst nekad')
  };
};

/**
 * Verify GDPR compliance in mock responses
 */
export const verifyGDPRCompliance = (response: any): boolean => {
  if (!response) return false;
  
  // Check for GDPR compliance flags
  const hasGDPRFlag = response.gdpr_compliant === true || 
                      response.gdpr_anonymized === true ||
                      response.gdpr_consent_verified === true;
  
  // Check for anonymized sensitive data
  const hasAnonymizedData = !response.personnummer || 
                           response.personnummer?.includes('***') ||
                           response.user_id?.includes('anonymized');
  
  return hasGDPRFlag && hasAnonymizedData;
};
