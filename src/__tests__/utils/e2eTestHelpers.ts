/**
 * E2E Test Helpers
 * Provides utilities for comprehensive E2E testing with automatic audit logging
 */

import { setupServiceMocks } from './mockSetup';

// Enhanced audit service that automatically logs actions
export const createEnhancedAuditService = () => {
  const { mockAuditService } = setupServiceMocks();
  
  return {
    ...mockAuditService,
    
    // Auto-logging wrapper for breach events
    autoLogBreachEvent: async (eventData: any) => {
      await mockAuditService.logBreachEvent(eventData);
      return { success: true };
    },
    
    // Auto-logging wrapper for incident responses
    autoLogIncidentResponse: async (eventData: any) => {
      await mockAuditService.logIncidentResponse(eventData);
      return { success: true };
    },
    
    // Auto-logging wrapper for recovery actions
    autoLogRecoveryAction: async (eventData: any) => {
      await mockAuditService.logRecoveryAction(eventData);
      return { success: true };
    },
    
    // Auto-logging wrapper for system events
    autoLogSystemEvent: async (eventData: any) => {
      await mockAuditService.logSystemEvent(eventData);
      return { success: true };
    },
    
    // Auto-logging wrapper for GDPR events
    autoLogGDPREvent: async (eventData: any) => {
      await mockAuditService.logGDPREvent(eventData);
      return { success: true };
    },
    
    // Auto-logging wrapper for encryption events
    autoLogEncryptionEvent: async (eventData: any) => {
      await mockAuditService.logEncryptionEvent(eventData);
      return { success: true };
    },
    
    // Auto-logging wrapper for key management events
    autoLogKeyManagementEvent: async (eventData: any) => {
      await mockAuditService.logKeyManagementEvent(eventData);
      return { success: true };
    },
    
    // Auto-logging wrapper for security events
    autoLogSecurityEvent: async (eventData: any) => {
      await mockAuditService.logSecurityEvent(eventData);
      return { success: true };
    }
  };
};

// Enhanced service setup for E2E tests
export const setupE2ETestEnvironment = () => {
  const serviceMocks = setupServiceMocks();
  const enhancedAuditService = createEnhancedAuditService();
  
  // Enhanced notification service with auto-logging
  const enhancedNotificationService = {
    ...serviceMocks.mockNotificationService,
    sendEmergencyAlert: jest.fn().mockImplementation(async (alertData: any) => {
      // Auto-log the emergency alert
      await enhancedAuditService.autoLogSystemEvent({
        action: 'emergency_alert_sent',
        alertType: alertData.type,
        severity: alertData.severity,
        recipients: alertData.recipients
      });
      return { success: true, alertId: 'alert-123' };
    }),
    sendDataRetentionNotice: jest.fn().mockResolvedValue({ success: true })
  };
  
  // Enhanced breach detection service with auto-logging
  const enhancedBreachDetectionService = {
    detectDataBreach: jest.fn().mockImplementation(async (data: any) => {
      const result = {
        detected: true,
        breachId: data.id || 'breach-123',
        confidence: 0.95,
        detectionMethod: 'anomaly_detection'
      };
      
      // Auto-log breach detection
      await enhancedAuditService.autoLogBreachEvent({
        action: 'breach_detected',
        breachId: result.breachId,
        severity: 'high',
        detectionMethod: result.detectionMethod,
        confidence: result.confidence
      });
      
      return result;
    }),
    classifyBreachSeverity: jest.fn().mockResolvedValue({
      severity: 'high',
      gdprNotificationRequired: true,
      timelineRequirement: '72_hours'
    })
  };
  
  // Enhanced incident response service with auto-logging
  const enhancedIncidentResponseService = {
    activateIncidentResponse: jest.fn().mockImplementation(async (incidentData: any) => {
      const result = {
        success: true,
        incidentId: incidentData.id || 'incident-456',
        responseTeam: ['security_officer', 'data_protection_officer', 'it_manager']
      };
      
      // Auto-log incident response activation
      await enhancedAuditService.autoLogIncidentResponse({
        action: 'incident_response_activated',
        incidentId: result.incidentId,
        breachId: incidentData.breachId,
        responseTeam: result.responseTeam
      });
      
      return result;
    }),
    executeContainmentPlan: jest.fn().mockImplementation(async (containmentData: any) => {
      const result = {
        success: true,
        containmentActions: [
          'compromised_accounts_disabled',
          'affected_systems_isolated',
          'access_logs_preserved',
          'backup_systems_secured'
        ],
        containmentTime: new Date().toISOString(),
        furtherSpreadPrevented: true
      };
      
      // Auto-log containment execution
      await enhancedAuditService.autoLogIncidentResponse({
        action: 'containment_executed',
        incidentId: containmentData.incidentId,
        containmentActions: result.containmentActions,
        containmentTime: result.containmentTime
      });
      
      return result;
    })
  };
  
  return {
    ...serviceMocks,
    auditService: enhancedAuditService,
    notificationService: enhancedNotificationService,
    breachDetectionService: enhancedBreachDetectionService,
    incidentResponseService: enhancedIncidentResponseService
  };
};

// Helper function to verify Swedish localization in E2E tests
export const verifySwedishE2ELocalization = (text: string): boolean => {
  const swedishWords = [
    'möte', 'protokoll', 'styrelse', 'användare', 'fel', 'framgång',
    'laddar', 'sparar', 'raderar', 'uppdaterar', 'skapar', 'hämtar',
    'dataintrång', 'säkerhet', 'kryptering', 'autentisering', 'behörighet',
    'integritet', 'konfidentialitet', 'tillgänglighet', 'spårbarhet'
  ];
  
  return swedishWords.some(word => 
    text.toLowerCase().includes(word.toLowerCase())
  );
};

// Helper function to verify GDPR compliance in E2E tests
export const verifyGDPRE2ECompliance = (data: any): boolean => {
  const requiredFields = ['gdpr_compliant', 'gdprCompliant'];
  const hasGDPRField = requiredFields.some(field => 
    data.hasOwnProperty(field) && data[field] === true
  );
  
  // Check for anonymization indicators
  const hasAnonymization = data.hasOwnProperty('anonymized') || 
                          data.hasOwnProperty('gdpr_anonymized') ||
                          data.hasOwnProperty('personalDataProtected');
  
  return hasGDPRField || hasAnonymization;
};

export default {
  setupE2ETestEnvironment,
  createEnhancedAuditService,
  verifySwedishE2ELocalization,
  verifyGDPRE2ECompliance
};
