/**
 * RBAC — Role-Based Access Control — src/lib/rbac.server.ts
 *
 * نظام صلاحيات متدرّج لـ Weaver:
 *
 *   OWNER  → صلاحيات كاملة (مالك المنصة)
 *   ADMIN  → إدارة المستخدمين والمشاريع
 *   EDITOR → إنشاء وتعديل المشاريع
 *   VIEWER → قراءة فقط
 *
 * الاستخدام:
 *   await requirePermission(userId, "project:delete", projectId);
 */

import { getSql } from "@/lib/db";
import { logger } from "@/lib/logger.server";

// ─── الأدوار ───────────────────────────────────────────────────────────────

export type Role = "owner" | "admin" | "editor" | "viewer";

// ─── الصلاحيات ────────────────────────────────────────────────────────────

export type Permission =
  | "project:create"
  | "project:read"
  | "project:update"
  | "project:delete"
  | "project:publish"
  | "project:deploy"
  | "project:secrets:read"
  | "project:secrets:write"
  | "file:read"
  | "file:write"
  | "file:delete"
  | "agent:run"
  | "agent:stop"
  | "user:read"
  | "user:invite"
  | "user:remove"
  | "user:role:change"
  | "billing:read"
  | "billing:manage"
  | "settings:read"
  | "settings:write"
  | "audit:read"
  | "platform:admin";

// ─── خريطة الصلاحيات ──────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: new Set<Permission>([
    "project:create", "project:read", "project:update", "project:delete",
    "project:publish", "project:deploy", "project:secrets:read", "project:secrets:write",
    "file:read", "file:write", "file:delete",
    "agent:run", "agent:stop",
    "user:read", "user:invite", "user:remove", "user:role:change",
    "billing:read", "billing:manage",
    "settings:read", "settings:write",
    "audit:read", "platform:admin",
  ]),
  admin: new Set<Permission>([
    "project:create", "project:read", "project:update", "project:delete",
    "project:publish", "project:deploy", "project:secrets:read", "project:secrets:write",
    "file:read", "file:write", "file:delete",
    "agent:run", "agent:stop",
    "user:read", "user:invite", "user:remove",
    "billing:read",
    "settings:read",
    "audit:read",
  ]),
  editor: new Set<Permission>([
    "project:create", "project:read", "project:update",
    "project:publish", "project:deploy",
    "project:secrets:read",
    "file:read", "file:write",
    "agent:run",
    "user:read",
    "settings:read",
  ]),
  viewer: new Set<Permission>([
    "project:read",
    "file:read",
    "user:read",
    "settings:read",
  ]),
};

// ─── Cache بسيطة في الذاكرة ───────────────────────────────────────────────

const roleCache = new Map<string, { role: Role; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

// ─── الدوال الرئيسية ──────────────────────────────────────────────────────

/**
 * يُرجع دور المستخدم في المشروع (أو الدور العام إن لم يُحدَّد مشروع)
 */
export async function getUserRole(
  userId: string,
  projectId?: string,
): Promise<Role | null> {
  const cacheKey = `${userId}:${projectId ?? "global"}`;
  const cached = roleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.role;
  }

  const sql = getSql();

  // أولاً: تحقّق من الدور على مستوى المشروع
  if (projectId) {
    const rows = await sql<{ role: Role }[]>`
      SELECT role FROM project_members
      WHERE user_id = ${userId} AND project_id = ${projectId}
      LIMIT 1
    `;
    if (rows[0]) {
      const role = rows[0].role;
      roleCache.set(cacheKey, { role, expiresAt: Date.now() + CACHE_TTL });
      return role;
    }
  }

  // ثانياً: الدور العام للمستخدم
  const globalRows = await sql<{ role: Role }[]>`
    SELECT role FROM user_roles
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const role = globalRows[0]?.role ?? null;
  if (role) {
    roleCache.set(cacheKey, { role, expiresAt: Date.now() + CACHE_TTL });
  }
  return role;
}

/**
 * يتحقق من أن المستخدم يملك الصلاحية — يُلقي خطأ إن لم يملكها
 */
export async function requirePermission(
  userId: string,
  permission: Permission,
  projectId?: string,
): Promise<void> {
  const role = await getUserRole(userId, projectId);
  if (!role) {
    logger.warn("RBAC: لا يوجد دور للمستخدم", { userId, permission, projectId });
    throw new PermissionDeniedError(permission);
  }

  const perms = ROLE_PERMISSIONS[role];
  if (!perms.has(permission)) {
    logger.warn("RBAC: صلاحية مرفوضة", { userId, role, permission, projectId });
    throw new PermissionDeniedError(permission, role);
  }
}

/**
 * يتحقق دون إلقاء خطأ — يُرجع boolean
 */
export async function hasPermission(
  userId: string,
  permission: Permission,
  projectId?: string,
): Promise<boolean> {
  try {
    await requirePermission(userId, permission, projectId);
    return true;
  } catch {
    return false;
  }
}

/**
 * يُفرغ cache الصلاحيات عند تغيير الدور
 */
export function invalidateRoleCache(userId: string, projectId?: string): void {
  const key = `${userId}:${projectId ?? "global"}`;
  roleCache.delete(key);
}

/** يُرجع كل صلاحيات دور معيّن */
export function getPermissionsForRole(role: Role): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}

// ─── الأخطاء ──────────────────────────────────────────────────────────────

export class PermissionDeniedError extends Error {
  readonly statusCode = 403;
  constructor(permission: Permission, role?: Role) {
    super(
      role
        ? `الدور "${role}" لا يملك صلاحية "${permission}"`
        : `غير مصرح بصلاحية "${permission}"`,
    );
    this.name = "PermissionDeniedError";
  }
}
