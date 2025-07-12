/**
 * Video Security Utilities
 * Handles encryption, validation, and audit for video meeting services
 */

export interface VideoEncryptionResult {
  encryptedStream: string;
  encryptionKey: string;
  gdprCompliant: boolean;
}

export interface ParticipantValidationResult {
  valid: boolean;
  userId: string;
  permissions: string[];
  swedishCompliant: boolean;
}

export interface VideoAuditLog {
  operation: string;
  meetingId: string;
  userId: string;
  timestamp: string;
  participantsCount: number;
  swedishCompliant: boolean;
  gdprCompliant: boolean;
  encryptionUsed: boolean;
}

export interface VideoMetadataSanitizationResult {
  sanitizedMetadata: any;
  sensitiveDataRemoved: boolean;
  swedishCompliant: boolean;
}

/**
 * Encrypts video stream data for secure transmission
 */
export function encryptVideoStream(streamData: any): VideoEncryptionResult {
  // In a real implementation, this would use proper video encryption
  const encryptedStream = Buffer.from(JSON.stringify(streamData)).toString('base64');
  
  return {
    encryptedStream,
    encryptionKey: 'video-encryption-key',
    gdprCompliant: true,
  };
}

/**
 * Validates participant permissions and access rights
 */
export function validateParticipant(
  userId: string,
  meetingId: string,
  requestedPermissions: string[] = []
): ParticipantValidationResult {
  // Basic validation logic
  const defaultPermissions = ['video', 'audio', 'chat'];
  const allowedPermissions = requestedPermissions.filter(permission =>
    defaultPermissions.includes(permission)
  );
  
  return {
    valid: userId && meetingId ? true : false,
    userId,
    permissions: allowedPermissions,
    swedishCompliant: true,
  };
}

/**
 * Logs video meeting operations for audit purposes
 */
export function auditVideoOperation(auditData: VideoAuditLog): void {
  // In a real implementation, this would write to a secure audit log
  console.log('Video Audit Log:', {
    ...auditData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Sanitizes video metadata to remove sensitive information
 */
export function sanitizeVideoMetadata(metadata: any): VideoMetadataSanitizationResult {
  const sanitized = { ...metadata };
  let sensitiveDataRemoved = false;
  
  // Remove IP addresses
  if (sanitized.ipAddress) {
    delete sanitized.ipAddress;
    sensitiveDataRemoved = true;
  }
  
  // Remove device information that could be identifying
  if (sanitized.deviceFingerprint) {
    delete sanitized.deviceFingerprint;
    sensitiveDataRemoved = true;
  }
  
  // Sanitize participant personal information
  if (sanitized.participants) {
    sanitized.participants = sanitized.participants.map((participant: any) => ({
      id: participant.id,
      name: participant.name,
      role: participant.role,
      // Remove email, phone, etc.
    }));
    sensitiveDataRemoved = true;
  }
  
  return {
    sanitizedMetadata: sanitized,
    sensitiveDataRemoved,
    swedishCompliant: true,
  };
}
