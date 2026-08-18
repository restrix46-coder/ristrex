/**
 * اختبارات RBAC
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPermissionsForRole,
  PermissionDeniedError,
  hasPermission,
} from "@/lib/rbac.server";

// محاكاة قاعدة البيانات
vi.mock("@/lib/db", () => ({
  getSql: () => vi.fn().mockResolvedValue([]),
}));

describe("RBAC — الصلاحيات بالدور", () => {
  it("owner لديه جميع الصلاحيات", () => {
    const perms = getPermissionsForRole("owner");
    expect(perms).toContain("project:create");
    expect(perms).toContain("project:delete");
    expect(perms).toContain("platform:admin");
    expect(perms).toContain("billing:manage");
    expect(perms.length).toBeGreaterThan(20);
  });

  it("viewer لديه صلاحيات محدودة فقط", () => {
    const perms = getPermissionsForRole("viewer");
    expect(perms).toContain("project:read");
    expect(perms).not.toContain("project:delete");
    expect(perms).not.toContain("platform:admin");
    expect(perms).not.toContain("billing:manage");
  });

  it("editor لا يملك صلاحية حذف المستخدمين", () => {
    const perms = getPermissionsForRole("editor");
    expect(perms).not.toContain("user:remove");
    expect(perms).not.toContain("platform:admin");
  });

  it("admin لا يملك platform:admin", () => {
    const perms = getPermissionsForRole("admin");
    expect(perms).not.toContain("platform:admin");
    expect(perms).toContain("user:invite");
  });
});

describe("RBAC — PermissionDeniedError", () => {
  it("يحتوي على statusCode 403", () => {
    const err = new PermissionDeniedError("project:delete");
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe("PermissionDeniedError");
    expect(err.message).toBeTruthy();
  });

  it("يذكر الدور في الرسالة إن وُجد", () => {
    const err = new PermissionDeniedError("project:delete", "viewer");
    expect(err.message).toContain("viewer");
    expect(err.message).toContain("project:delete");
  });
});
