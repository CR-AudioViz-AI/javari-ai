/**
 * Phase Ω-VI: Security Hardening Engine - Core Type Definitions
 * 
 * @module orchestrator/security/types
 * @description Type system for security threat detection per Phase Ω-VI specification
 * @version 1.0.0
 * @status PRODUCTION
 */

export enum ThreatSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ThreatCategory {
  INJECTION = 'injection',
  XSS = 'xss',
  PATH_TRAVERSAL = 'path_traversal',
  PROMPT_INJECTION = 'prompt_injection',
  DATA_EXFILTRATION = 'data_exfiltration',
  MALICIOUS_UPLOAD = 'malicious_upload',
}

export enum ThreatAction {
  LOG = 'log',
  ALERT = 'alert',
  BLOCK = 'block',
  QUARANTINE = 'quarantine',
}

export interface ThreatSignature {
  id: string;
  name: string;
  category: ThreatCategory;
  severity: ThreatSeverity;
  pattern: string;
  regex?: RegExp;
  action: ThreatAction;
  description: string;
  enabled: boolean;
  lastUpdated: string;
}

export interface ThreatSignatureDatabase {
  version: string;
  lastUpdated: string;
  signatures: Record<ThreatCategory, ThreatSignature[]>;
}

export interface ThreatDetection {
  signatureId: string;
  category: ThreatCategory;
  severity: ThreatSeverity;
  action: ThreatAction;
  matchedContent: string;
  confidence: number;
  detectedAt: Date;
}

export interface SecurityScanResult {
  scanId: string;
  timestamp: Date;
  threatDetected: boolean;
  maxSeverity: ThreatSeverity;
  recommendedAction: ThreatAction;
  detections: ThreatDetection[];
  metadata: {
    scanDuration: number;
    signaturesChecked: number;
    contentType: string;
    contentLength: number;
  };
}

export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  ANALYST = 'analyst',
  VIEWER = 'viewer',
}

export enum ResourceType {
  AI_ASSISTANT = 'ai_assistant',
  FILE_UPLOAD = 'file_upload',
  CODE_EXECUTION = 'code_execution',
  DATABASE_QUERY = 'database_query',
  API_ENDPOINT = 'api_endpoint',
  USER_DATA = 'user_data',
  SYSTEM_CONFIG = 'system_config',
}

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXECUTE = 'execute',
}

export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  requiredRole?: UserRole;
}

export enum SecretType {
  API_KEY = 'api_key',
  JWT_TOKEN = 'jwt_token',
  DATABASE_URL = 'database_url',
  PRIVATE_KEY = 'private_key',
  OAUTH_SECRET = 'oauth_secret',
  PASSWORD = 'password',
}

export interface DetectedSecret {
  type: SecretType;
  pattern: string;
  matchedContent: string;
  position: {
    start: number;
    end: number;
  };
  severity: ThreatSeverity;
}

export interface SecretValidationResult {
  hasSecrets: boolean;
  secrets: DetectedSecret[];
  sanitizedContent: string;
}

export interface FileValidationResult {
  isSafe: boolean;
  detectedMimeType: string;
  claimedMimeType?: string;
  mimeTypeMismatch: boolean;
  fileSize: number;
  threats: string[];
  errors: string[];
  fileHash: string;
  validatedAt: Date;
}

export interface SecurityIncident {
  id: string;
  timestamp: Date;
  severity: ThreatSeverity;
  category: ThreatCategory;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  threats: ThreatDetection[];
  actionTaken: ThreatAction;
  description: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface RequestData {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RequestValidationResult {
  allowed: boolean;
  scanResult: SecurityScanResult;
  actionTaken: ThreatAction;
}

export interface PromptValidationResult {
  isSafe: boolean;
  scanResult: SecurityScanResult;
  sanitizedPrompt?: string;
}

export type {
  ThreatSignature,
  ThreatSignatureDatabase,
  ThreatDetection,
  SecurityScanResult,
  PermissionCheckResult,
  DetectedSecret,
  SecretValidationResult,
  FileValidationResult,
  SecurityIncident,
  RequestData,
  RequestValidationResult,
  PromptValidationResult,
};
