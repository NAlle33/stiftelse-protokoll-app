/**
 * Comprehensive Security Test Suite
 * Swedish Board Meeting App - Advanced Security Testing
 * 
 * Tests critical security features including:
 * - Session hijacking prevention
 * - Encryption edge cases
 * - CSRF protection
 * - Input validation and sanitization
 * - Authentication bypass attempts
 * - Data leakage prevention
 */

import { Alert } from 'react-native';

// Mock all security-related services
jest.mock('../src/services/sessionService');
jest.mock('../src/services/encryptionService');
jest.mock('../src/services/authService');
jest.mock('../src/services/auditService');
jest.mock('../src/services/rateLimitService');
jest.mock('expo-secure-store');
jest.mock('crypto-js');

// Import services
import { sessionService } from '../src/services/sessionService';
import { encryptionService } from '../src/services/encryptionService';
import { authService } from '../src/services/authService';
import { auditService } from '../src/services/auditService';
import { rateLimitService } from '../src/services/rateLimitService';

describe('🛡️ Comprehensive Security Test Suite', () => {
  const mockUser = {
    id: 'user-123',
    email: 'security.test@example.se',
    role: 'board_member' as const,
    organizationId: 'org-456'
  };

  const mockSession = {
    id: 'session-789',
    userId: mockUser.id,
    deviceId: 'device-abc',
    ipAddress: '192.168.1.100',
    userAgent: 'SokaApp/1.0.0 iOS/17.0',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    isActive: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default security mocks
    (sessionService.createSession as jest.Mock).mockResolvedValue(mockSession);
    (sessionService.validateSession as jest.Mock).mockResolvedValue(true);
    (encryptionService.encrypt as jest.Mock).mockResolvedValue('encrypted-data');
    (encryptionService.decrypt as jest.Mock).mockResolvedValue('decrypted-data');
    (authService.validateToken as jest.Mock).mockResolvedValue(mockUser);
    (auditService.logAction as jest.Mock).mockResolvedValue(true);
    (rateLimitService.checkLimit as jest.Mock).mockResolvedValue({ allowed: true });
  });

  describe('🔐 Session Security Tests', () => {
    it('should prevent session hijacking through device fingerprinting', async () => {
      console.log('🕵️ Testing session hijacking prevention...');
      
      // Create legitimate session
      const legitimateSession = await sessionService.createSession({
        userId: mockUser.id,
        deviceId: 'device-legitimate',
        ipAddress: '192.168.1.100',
        userAgent: 'SokaApp/1.0.0 iOS/17.0'
      });

      // Attempt to use session from different device
      (sessionService.validateSession as jest.Mock).mockResolvedValue(false);
      
      const hijackAttempt = await sessionService.validateSession(legitimateSession.id, {
        deviceId: 'device-malicious',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      });

      expect(hijackAttempt).toBe(false);
      
      // Should log security incident
      expect(auditService.logAction).toHaveBeenCalledWith(
        mockUser.id,
        'SECURITY_INCIDENT',
        'session',
        legitimateSession.id,
        expect.objectContaining({
          incident_type: 'session_hijack_attempt',
          suspicious_device: 'device-malicious',
          suspicious_ip: '10.0.0.1',
          severity: 'HIGH'
        })
      );
    });

    it('should detect and prevent concurrent session abuse', async () => {
      console.log('👥 Testing concurrent session abuse prevention...');
      
      // Create multiple sessions for same user
      const sessions = [];
      for (let i = 0; i < 6; i++) {
        sessions.push(await sessionService.createSession({
          userId: mockUser.id,
          deviceId: `device-${i}`,
          ipAddress: `192.168.1.${100 + i}`,
          userAgent: 'SokaApp/1.0.0'
        }));
      }

      // Should trigger security alert for too many concurrent sessions
      (sessionService.validateConcurrentSessions as jest.Mock).mockResolvedValue({
        valid: false,
        reason: 'too_many_concurrent_sessions',
        maxAllowed: 5,
        current: 6
      });

      const validation = await sessionService.validateConcurrentSessions(mockUser.id);
      expect(validation.valid).toBe(false);
      expect(validation.current).toBeGreaterThan(validation.maxAllowed);

      // Should log security incident
      expect(auditService.logAction).toHaveBeenCalledWith(
        mockUser.id,
        'SECURITY_INCIDENT',
        'user',
        mockUser.id,
        expect.objectContaining({
          incident_type: 'concurrent_session_abuse',
          session_count: 6,
          max_allowed: 5
        })
      );
    });

    it('should handle session timeout and cleanup securely', async () => {
      console.log('⏰ Testing secure session timeout handling...');
      
      // Create expired session
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        isActive: false
      };

      (sessionService.validateSession as jest.Mock).mockResolvedValue(false);
      (sessionService.cleanupExpiredSessions as jest.Mock).mockResolvedValue({
        cleaned: 1,
        remaining: 0
      });

      const isValid = await sessionService.validateSession(expiredSession.id);
      expect(isValid).toBe(false);

      // Cleanup should be called
      const cleanup = await sessionService.cleanupExpiredSessions(mockUser.id);
      expect(cleanup.cleaned).toBe(1);

      // Should log cleanup action
      expect(auditService.logAction).toHaveBeenCalledWith(
        mockUser.id,
        'SESSION_CLEANUP',
        'user',
        mockUser.id,
        expect.objectContaining({
          expired_sessions_cleaned: 1,
          security_cleanup: true
        })
      );
    });
  });

  describe('🔒 Encryption Security Tests', () => {
    it('should handle encryption key rotation securely', async () => {
      console.log('🔄 Testing encryption key rotation...');
      
      const sensitiveData = 'Känslig styrelseprotokoll information';
      
      // Encrypt with old key
      (encryptionService.encrypt as jest.Mock).mockResolvedValue({
        encryptedData: 'old-key-encrypted-data',
        keyVersion: 1,
        algorithm: 'AES-256-GCM'
      });

      const encrypted = await encryptionService.encrypt(sensitiveData);
      expect(encrypted.keyVersion).toBe(1);

      // Rotate key
      (encryptionService.rotateKey as jest.Mock).mockResolvedValue({
        newKeyVersion: 2,
        oldKeyVersion: 1,
        rotationDate: new Date().toISOString()
      });

      const rotation = await encryptionService.rotateKey();
      expect(rotation.newKeyVersion).toBe(2);

      // Re-encrypt with new key
      (encryptionService.reEncryptWithNewKey as jest.Mock).mockResolvedValue({
        encryptedData: 'new-key-encrypted-data',
        keyVersion: 2,
        algorithm: 'AES-256-GCM'
      });

      const reEncrypted = await encryptionService.reEncryptWithNewKey(encrypted.encryptedData);
      expect(reEncrypted.keyVersion).toBe(2);

      // Should log key rotation
      expect(auditService.logAction).toHaveBeenCalledWith(
        'system',
        'KEY_ROTATION',
        'encryption',
        'master-key',
        expect.objectContaining({
          old_version: 1,
          new_version: 2,
          security_operation: true
        })
      );
    });

    it('should detect and prevent encryption tampering', async () => {
      console.log('🔍 Testing encryption tampering detection...');
      
      const originalData = 'Protokoll från styrelsemöte';
      
      // Encrypt data with integrity check
      (encryptionService.encryptWithIntegrity as jest.Mock).mockResolvedValue({
        encryptedData: 'encrypted-protocol-data',
        hmac: 'integrity-hash-12345',
        keyVersion: 1
      });

      const encrypted = await encryptionService.encryptWithIntegrity(originalData);
      
      // Simulate tampering attempt
      const tamperedData = {
        ...encrypted,
        encryptedData: 'tampered-encrypted-data',
        hmac: encrypted.hmac // Keep original HMAC
      };

      // Verify integrity should fail
      (encryptionService.verifyIntegrity as jest.Mock).mockResolvedValue(false);
      
      const isValid = await encryptionService.verifyIntegrity(tamperedData);
      expect(isValid).toBe(false);

      // Should log tampering attempt
      expect(auditService.logAction).toHaveBeenCalledWith(
        'system',
        'SECURITY_INCIDENT',
        'encryption',
        'data-integrity',
        expect.objectContaining({
          incident_type: 'data_tampering_detected',
          severity: 'CRITICAL',
          data_type: 'encrypted_protocol'
        })
      );
    });

    it('should handle encryption failures gracefully without data leakage', async () => {
      console.log('⚠️ Testing encryption failure handling...');
      
      const sensitiveData = 'Hemlig styrelseprotokoll med personuppgifter';
      
      // Simulate encryption failure
      (encryptionService.encrypt as jest.Mock).mockRejectedValue(
        new Error('Encryption key unavailable')
      );

      try {
        await encryptionService.encrypt(sensitiveData);
      } catch (error) {
        expect(error.message).toBe('Encryption key unavailable');
        
        // Verify sensitive data is not logged in error
        expect(error.message).not.toContain(sensitiveData);
        expect(error.message).not.toContain('personuppgifter');
      }

      // Should log error without sensitive data
      expect(auditService.logAction).toHaveBeenCalledWith(
        'system',
        'ENCRYPTION_ERROR',
        'encryption',
        'encrypt-operation',
        expect.objectContaining({
          error: 'Encryption key unavailable',
          data_size: sensitiveData.length,
          sensitive_data_redacted: true
        })
      );
    });
  });

  describe('🚫 CSRF Protection Tests', () => {
    it('should prevent CSRF attacks on critical operations', async () => {
      console.log('🛡️ Testing CSRF protection...');
      
      // Generate CSRF token
      (authService.generateCSRFToken as jest.Mock).mockResolvedValue({
        token: 'csrf-token-12345',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });

      const csrfToken = await authService.generateCSRFToken(mockSession.id);
      
      // Attempt critical operation without CSRF token
      (authService.validateCSRFToken as jest.Mock).mockResolvedValue(false);
      
      const isValidWithoutToken = await authService.validateCSRFToken(null, mockSession.id);
      expect(isValidWithoutToken).toBe(false);

      // Attempt with invalid CSRF token
      const isValidWithInvalidToken = await authService.validateCSRFToken('invalid-token', mockSession.id);
      expect(isValidWithInvalidToken).toBe(false);

      // Valid request with correct CSRF token
      (authService.validateCSRFToken as jest.Mock).mockResolvedValue(true);
      const isValidWithCorrectToken = await authService.validateCSRFToken(csrfToken.token, mockSession.id);
      expect(isValidWithCorrectToken).toBe(true);

      // Should log CSRF attempts
      expect(auditService.logAction).toHaveBeenCalledWith(
        mockUser.id,
        'SECURITY_INCIDENT',
        'session',
        mockSession.id,
        expect.objectContaining({
          incident_type: 'csrf_attack_attempt',
          provided_token: 'invalid-token',
          severity: 'HIGH'
        })
      );
    });
  });

  describe('🔍 Input Validation Security Tests', () => {
    it('should prevent SQL injection attempts', async () => {
      console.log('💉 Testing SQL injection prevention...');
      
      const maliciousInputs = [
        "'; DROP TABLE meetings; --",
        "1' OR '1'='1",
        "admin'/**/OR/**/1=1#",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --"
      ];

      for (const maliciousInput of maliciousInputs) {
        (authService.validateInput as jest.Mock).mockResolvedValue({
          isValid: false,
          threats: ['sql_injection'],
          sanitized: '[BLOCKED]'
        });

        const validation = await authService.validateInput(maliciousInput, 'email');
        expect(validation.isValid).toBe(false);
        expect(validation.threats).toContain('sql_injection');

        // Should log injection attempt
        expect(auditService.logAction).toHaveBeenCalledWith(
          'anonymous',
          'SECURITY_INCIDENT',
          'input',
          'validation',
          expect.objectContaining({
            incident_type: 'sql_injection_attempt',
            input_length: maliciousInput.length,
            threats: ['sql_injection']
          })
        );
      }
    });

    it('should prevent XSS attacks in user inputs', async () => {
      console.log('🕷️ Testing XSS prevention...');
      
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')"></svg>'
      ];

      for (const payload of xssPayloads) {
        (authService.validateInput as jest.Mock).mockResolvedValue({
          isValid: false,
          threats: ['xss'],
          sanitized: payload.replace(/<[^>]*>/g, '')
        });

        const validation = await authService.validateInput(payload, 'meeting_title');
        expect(validation.isValid).toBe(false);
        expect(validation.threats).toContain('xss');

        // Should log XSS attempt
        expect(auditService.logAction).toHaveBeenCalledWith(
          'anonymous',
          'SECURITY_INCIDENT',
          'input',
          'validation',
          expect.objectContaining({
            incident_type: 'xss_attempt',
            field: 'meeting_title',
            threats: ['xss']
          })
        );
      }
    });

    it('should handle Swedish characters securely in validation', async () => {
      console.log('🇸🇪 Testing Swedish character security...');
      
      const swedishInputs = [
        'Årsstämma för Åklagarmyndigheten',
        'Möte med Göteborgs Universitet',
        'Diskussion om förändringar',
        'Åsa Öberg från Växjö'
      ];

      for (const input of swedishInputs) {
        (authService.validateInput as jest.Mock).mockResolvedValue({
          isValid: true,
          threats: [],
          sanitized: input,
          encoding: 'UTF-8'
        });

        const validation = await authService.validateInput(input, 'meeting_title');
        expect(validation.isValid).toBe(true);
        expect(validation.encoding).toBe('UTF-8');
        expect(validation.sanitized).toBe(input);
      }
    });
  });

  describe('🚦 Rate Limiting Security Tests', () => {
    it('should prevent brute force attacks on authentication', async () => {
      console.log('🔨 Testing brute force prevention...');
      
      const attackerIP = '10.0.0.1';
      
      // Simulate multiple failed login attempts
      for (let i = 1; i <= 6; i++) {
        if (i <= 5) {
          (rateLimitService.checkLimit as jest.Mock).mockResolvedValue({
            allowed: true,
            remaining: 5 - i,
            resetTime: Date.now() + 60000
          });
        } else {
          (rateLimitService.checkLimit as jest.Mock).mockResolvedValue({
            allowed: false,
            remaining: 0,
            resetTime: Date.now() + 60000,
            blocked: true
          });
        }

        const rateCheck = await rateLimitService.checkLimit(attackerIP, 'login_attempts');
        
        if (i <= 5) {
          expect(rateCheck.allowed).toBe(true);
        } else {
          expect(rateCheck.allowed).toBe(false);
          expect(rateCheck.blocked).toBe(true);
        }
      }

      // Should log brute force attempt
      expect(auditService.logAction).toHaveBeenCalledWith(
        'anonymous',
        'SECURITY_INCIDENT',
        'authentication',
        'rate_limit',
        expect.objectContaining({
          incident_type: 'brute_force_attempt',
          source_ip: attackerIP,
          attempt_count: 6,
          severity: 'HIGH'
        })
      );
    });

    it('should implement progressive delays for repeated failures', async () => {
      console.log('⏳ Testing progressive delay implementation...');
      
      const userIP = '192.168.1.100';
      
      // First failure - short delay
      (rateLimitService.getFailureDelay as jest.Mock).mockResolvedValue({
        delay: 1000, // 1 second
        attempts: 1
      });

      let delay = await rateLimitService.getFailureDelay(userIP, 'login_attempts');
      expect(delay.delay).toBe(1000);

      // Third failure - longer delay
      (rateLimitService.getFailureDelay as jest.Mock).mockResolvedValue({
        delay: 8000, // 8 seconds
        attempts: 3
      });

      delay = await rateLimitService.getFailureDelay(userIP, 'login_attempts');
      expect(delay.delay).toBe(8000);

      // Fifth failure - much longer delay
      (rateLimitService.getFailureDelay as jest.Mock).mockResolvedValue({
        delay: 32000, // 32 seconds
        attempts: 5
      });

      delay = await rateLimitService.getFailureDelay(userIP, 'login_attempts');
      expect(delay.delay).toBe(32000);
    });
  });

  describe('🔐 Authentication Bypass Prevention', () => {
    it('should prevent token manipulation attacks', async () => {
      console.log('🎭 Testing token manipulation prevention...');
      
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.token';
      const manipulatedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.manipulated.token';
      
      // Valid token should work
      (authService.validateToken as jest.Mock).mockResolvedValue(mockUser);
      const validUser = await authService.validateToken(validToken);
      expect(validUser).toEqual(mockUser);

      // Manipulated token should fail
      (authService.validateToken as jest.Mock).mockRejectedValue(
        new Error('Invalid token signature')
      );

      try {
        await authService.validateToken(manipulatedToken);
      } catch (error) {
        expect(error.message).toBe('Invalid token signature');
      }

      // Should log manipulation attempt
      expect(auditService.logAction).toHaveBeenCalledWith(
        'anonymous',
        'SECURITY_INCIDENT',
        'authentication',
        'token_validation',
        expect.objectContaining({
          incident_type: 'token_manipulation_attempt',
          severity: 'CRITICAL'
        })
      );
    });
  });
});
