/**
 * Shared types and interfaces för Protocol Services Integration
 * 
 * Denna fil innehåller gemensamma typer som används av både
 * ProtocolService och ProtocolAIService för att säkerställa
 * konsistent integration och typesäkerhet.
 */

// Re-export från protocolService för bakåtkompatibilitet
export type { 
  Protocol, 
  ProtocolSection, 
  ProtocolTemplate,
  ProtocolVersion,
  SigningFlow,
  SignatureRequirement,
  CompletedSignature,
  ArchiveEntry
} from './protocolService';

// Re-export från protocolAIService för bakåtkompatibilitet  
export type {
  ProtocolGenerationRequest,
  ProtocolGenerationResponse,
  ProtocolGenerationStatus,
  ProtocolGenerationWorkflow
} from './protocolAIService';

/**
 * Unified Protocol Generation Workflow
 * Koordinerar hela processen från transkribering till färdigt protokoll
 */
export interface UnifiedProtocolWorkflow {
  // Workflow-identifiering
  workflowId: string;
  meetingId: string;
  userId: string;
  
  // Input-data
  transcription: string;
  templateId?: string;
  
  // AI-konfiguration
  aiOptions?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  
  // Workflow-status
  status: WorkflowStatus;
  currentPhase: WorkflowPhase;
  progress: number;
  
  // Resultat
  generatedProtocol?: string;
  protocolId?: string;
  
  // Metadata
  startedAt: string;
  completedAt?: string;
  error?: WorkflowError;
  
  // Kostnad och prestanda
  estimatedCost?: number;
  actualCost?: number;
  tokensUsed?: number;
  processingTime?: number;
}

export type WorkflowStatus = 
  | 'pending'           // Väntar på att starta
  | 'in_progress'       // Pågående
  | 'completed'         // Slutförd framgångsrikt
  | 'failed'            // Misslyckades
  | 'cancelled';        // Avbruten

export type WorkflowPhase = 
  | 'validation'        // Validerar input
  | 'ai_processing'     // AI genererar protokoll
  | 'protocol_creation' // Skapar protokoll i databasen
  | 'finalization';     // Slutför och sparar metadata

/**
 * Unified Error Handling för Protocol Services
 */
export interface WorkflowError {
  code: WorkflowErrorCode;
  message: string;
  phase: WorkflowPhase;
  recoverable: boolean;
  retryOptions?: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
  details?: Record<string, any>;
}

export type WorkflowErrorCode =
  | 'VALIDATION_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'PROTOCOL_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'COST_LIMIT_ERROR'
  | 'GDPR_COMPLIANCE_ERROR'
  | 'TEMPLATE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Status Tracking för Real-time Updates
 */
export interface ProtocolWorkflowStatus {
  workflowId: string;
  status: WorkflowStatus;
  phase: WorkflowPhase;
  progress: number;
  message?: string;
  error?: WorkflowError;
  
  // Phase-specifik information
  phaseDetails?: {
    validation?: {
      transcriptionLength: number;
      estimatedTokens: number;
      estimatedCost: number;
    };
    ai_processing?: {
      model: string;
      tokensUsed: number;
      actualCost: number;
    };
    protocol_creation?: {
      protocolId: string;
      sectionsCreated: number;
    };
    finalization?: {
      protocolId: string;
      totalProcessingTime: number;
    };
  };
}

/**
 * Integration Configuration
 */
export interface ProtocolServiceIntegrationConfig {
  // AI Service Configuration
  aiService: {
    defaultModel: string;
    defaultTemperature: number;
    maxTokens: number;
    costLimitPerRequest: number;
    rateLimitPerMinute: number;
  };
  
  // Protocol Service Configuration
  protocolService: {
    defaultTemplate: string;
    autoSave: boolean;
    versioningEnabled: boolean;
    gdprComplianceRequired: boolean;
  };
  
  // Workflow Configuration
  workflow: {
    timeoutMinutes: number;
    retryAttempts: number;
    statusUpdateInterval: number;
    cleanupAfterDays: number;
  };
}

/**
 * Service Integration Events
 */
export interface ProtocolServiceEvent {
  eventId: string;
  workflowId: string;
  eventType: ProtocolServiceEventType;
  timestamp: string;
  source: 'protocol_service' | 'protocol_ai_service' | 'workflow_coordinator';
  data: Record<string, any>;
}

export type ProtocolServiceEventType =
  | 'workflow_started'
  | 'workflow_phase_changed'
  | 'workflow_progress_updated'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'ai_generation_started'
  | 'ai_generation_completed'
  | 'protocol_created'
  | 'protocol_updated'
  | 'error_occurred';

/**
 * Callback Types för Service Integration
 */
export type WorkflowStatusCallback = (status: ProtocolWorkflowStatus) => void;
export type WorkflowEventCallback = (event: ProtocolServiceEvent) => void;
export type WorkflowErrorCallback = (error: WorkflowError) => void;

/**
 * Service Integration Interface
 * Definierar hur ProtocolService och ProtocolAIService integrerar
 */
export interface ProtocolServiceIntegration {
  // Workflow Management
  startWorkflow(request: UnifiedProtocolWorkflow): Promise<string>;
  getWorkflowStatus(workflowId: string): Promise<ProtocolWorkflowStatus>;
  cancelWorkflow(workflowId: string): Promise<boolean>;
  
  // Event Handling
  subscribeToWorkflow(workflowId: string, callback: WorkflowStatusCallback): () => void;
  subscribeToEvents(callback: WorkflowEventCallback): () => void;
  
  // Cost and Performance
  estimateWorkflowCost(transcriptionLength: number): Promise<number>;
  getWorkflowMetrics(workflowId: string): Promise<WorkflowMetrics>;
}

export interface WorkflowMetrics {
  workflowId: string;
  totalProcessingTime: number;
  phaseTimings: Record<WorkflowPhase, number>;
  tokensUsed: number;
  actualCost: number;
  estimatedCost: number;
  costAccuracy: number;
  success: boolean;
}

/**
 * Template Integration Types
 */
export interface TemplateIntegrationOptions {
  templateId?: string;
  customSections?: Array<{
    title: string;
    order: number;
    required: boolean;
    aiPromptHint?: string;
  }>;
  sectionMapping?: Record<string, string>;
  formatOptions?: {
    includeHeader: boolean;
    includeFooter: boolean;
    includeSignatures: boolean;
    dateFormat: string;
  };
}

/**
 * GDPR Compliance Integration
 */
export interface GDPRComplianceResult {
  compliant: boolean;
  sanitizationApplied: boolean;
  removedElements: string[];
  warnings: string[];
  auditTrail: {
    timestamp: string;
    action: string;
    details: string;
  }[];
}
