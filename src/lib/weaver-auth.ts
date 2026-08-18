import { createMiddleware } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { getSessionConfig, getOwnerId } from "./auth.server";
import { WEAVER_OWNER_EMAIL } from "./env.server";

export const requireWeaverAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  let owner: { id: string; email: string } | undefined;

  try {
    const session = await useSession<{
      owner?: { id: string; email: string };
    }>(getSessionConfig());
    owner = session.data?.owner;
  } catch {
    // No session available or error reading cookie — proceed to fallback
  }

  // في البيئة المستقلة أحادية المالك (Standalone Weaver):
  // ينشئ الهوية الافتراضية إذا لم يسجّل المستخدم الدخول بعد، لتمكينه من التفاعل وإنشاء المهام فوراً.
  if (!owner) {
    const email = WEAVER_OWNER_EMAIL || "ammouryaly@gmail.com";
    owner = { id: getOwnerId(email), email };
  }

  const userId = owner.id;

  // Local Postgres-backed drop-in for the previous Supabase client so
  // existing `context.supabase` call-sites keep working after independence.
  const { getSql } = await import("./db");
  const { makeLocalSupabase } = await import("./local-supabase");
  const supabase = makeLocalSupabase(getSql(), userId);

  return next({
    context: {
      userId,
      owner,
      supabase,
      claims: { sub: userId, email: owner.email },
    },
  });
});

/** Backwards-compatible alias used by modules migrated off Supabase Auth. */
export const requireSupabaseAuth = requireWeaverAuth;
