import {
  UserRole,
  PermissionAction,
  ResourceType,
  PermissionCheckResult
} from './types';
type PermissionMap = Record<UserRole, Record<ResourceType, PermissionAction[]>>;
const PERMISSIONS: PermissionMap = {
  admin: {
    ai_assistant: ['read', 'write', 'execute', 'delete'],
    file_upload: ['read', 'write', 'delete'],
    code_execution: ['execute'],
    database_query: ['read', 'write', 'delete'],
    api_endpoint: ['read', 'write', 'execute'],
    user_data: ['read', 'write', 'delete'],
    system_config: ['read', 'write', 'delete']
  },
  developer: {
    ai_assistant: ['read', 'write', 'execute'],
    file_upload: ['read', 'write'],
    code_execution: ['execute'],
    database_query: ['read', 'write'],
    api_endpoint: ['read', 'write'],
    user_data: ['read'],
    system_config: []
  },
  analyst: {
    ai_assistant: ['read', 'execute'],
    file_upload: ['read'],
    code_execution: [],
    database_query: ['read'],
    api_endpoint: ['read'],
    user_data: ['read'],
    system_config: []
  },
  viewer: {
    ai_assistant: ['read'],
    file_upload: [],
    code_execution: [],
    database_query: [],
    api_endpoint: [],
    user_data: [],
    system_config: []
  }
};
export function hasPermission(
  role: UserRole,
  resource: ResourceType,
  action: PermissionAction
): PermissionCheckResult {
  const allowedActions = PERMISSIONS[role]?.[resource] ?? [];
  const granted = allowedActions.includes(action);
  return {
    granted,
    reason: granted ? undefined : 'Permission denied',
    requiredRole: granted ? undefined : role
  };
}
export function getUserPermissions(role: UserRole): PermissionMap[UserRole] {
  return PERMISSIONS[role];
}
