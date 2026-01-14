import { describe, it, expect } from 'vitest';
import { hasPermission } from '../security/permissionMatrix';
import { UserRole, ResourceType, PermissionAction } from '../security/types';
describe('Phase Ω-VI — Permission & RBAC Tests (6)', () => {
  it('admin can write system config', () => {
    const res = hasPermission(
      UserRole.ADMIN,
      ResourceType.SYSTEM_CONFIG,
      PermissionAction.WRITE
    );
    expect(res.granted).toBe(true);
  });
  it('developer cannot delete system config', () => {
    const res = hasPermission(
      UserRole.DEVELOPER,
      ResourceType.SYSTEM_CONFIG,
      PermissionAction.DELETE
    );
    expect(res.granted).toBe(false);
  });
  it('analyst can read user data', () => {
    const res = hasPermission(
      UserRole.ANALYST,
      ResourceType.USER_DATA,
      PermissionAction.READ
    );
    expect(res.granted).toBe(true);
  });
  it('viewer cannot execute code', () => {
    const res = hasPermission(
      UserRole.VIEWER,
      ResourceType.CODE_EXECUTION,
      PermissionAction.EXECUTE
    );
    expect(res.granted).toBe(false);
  });
  it('developer can execute code', () => {
    const res = hasPermission(
      UserRole.DEVELOPER,
      ResourceType.CODE_EXECUTION,
      PermissionAction.EXECUTE
    );
    expect(res.granted).toBe(true);
  });
  it('viewer has no permissions on api endpoint', () => {
    const res = hasPermission(
      UserRole.VIEWER,
      ResourceType.API_ENDPOINT,
      PermissionAction.READ
    );
    expect(res.granted).toBe(false);
  });
});
