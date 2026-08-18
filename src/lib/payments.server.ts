/**
 * Payments Integration — src/lib/payments.server.ts
 *
 * تكامل Stripe كامل لـ Weaver:
 * - إنشاء جلسات دفع (Checkout Sessions)
 * - إدارة الاشتراكات (Subscriptions)
 * - معالجة Webhooks
 * - استرداد المدفوعات (Refunds)
 *
 * المتغيّرات المطلوبة:
 *   STRIPE_SECRET_KEY=sk_live_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   STRIPE_PUBLISHABLE_KEY=pk_live_...
 */

import { logger } from "@/lib/logger.server";

// ─── أسعار الخطط ──────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id: "free",
    name: "المجاني",
    priceMonthly: 0,
    priceAnnual: 0,
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    limits: {
      projects: 3,
      tokensPerMonth: 100_000,
      storageGb: 1,
    },
  },
  pro: {
    id: "pro",
    name: "الاحترافي",
    priceMonthly: 29,
    priceAnnual: 290,
    stripePriceIdMonthly: process.env["STRIPE_PRICE_PRO_MONTHLY"],
    stripePriceIdAnnual: process.env["STRIPE_PRICE_PRO_ANNUAL"],
    limits: {
      projects: 50,
      tokensPerMonth: 5_000_000,
      storageGb: 50,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "المؤسسي",
    priceMonthly: 199,
    priceAnnual: 1990,
    stripePriceIdMonthly: process.env["STRIPE_PRICE_ENTERPRISE_MONTHLY"],
    stripePriceIdAnnual: process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"],
    limits: {
      projects: -1, // غير محدود
      tokensPerMonth: -1,
      storageGb: 500,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;

// ─── خيارات Stripe ────────────────────────────────────────────────────────

function getStripeKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY غير مضبوط");
  return key;
}

// ─── إنشاء جلسة الدفع ─────────────────────────────────────────────────────

export interface CreateCheckoutOptions {
  userId: string;
  userEmail: string;
  planId: Exclude<PlanId, "free">;
  billing: "monthly" | "annual";
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  opts: CreateCheckoutOptions,
): Promise<{ url: string; sessionId: string }> {
  const plan = PLANS[opts.planId];
  const priceId =
    opts.billing === "monthly"
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdAnnual;

  if (!priceId) {
    throw new Error(`معرّف السعر غير مضبوط للخطة ${opts.planId}`);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "customer_email": opts.userEmail,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      "metadata[user_id]": opts.userId,
      "metadata[plan_id]": opts.planId,
      "metadata[billing]": opts.billing,
      "subscription_data[metadata][user_id]": opts.userId,
      allow_promotion_codes: "true",
      "automatic_tax[enabled]": "true",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error("Stripe checkout session error", { error: err });
    throw new Error("فشل إنشاء جلسة الدفع");
  }

  const session = (await response.json()) as { id: string; url: string };
  logger.info("Stripe checkout session created", {
    sessionId: session.id,
    userId: opts.userId,
    planId: opts.planId,
  });

  return { url: session.url, sessionId: session.id };
}

// ─── معالجة Webhook ───────────────────────────────────────────────────────

export type StripeWebhookEvent =
  | "checkout.session.completed"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_failed";

export interface ParsedWebhookEvent {
  type: StripeWebhookEvent;
  userId: string | null;
  planId: PlanId | null;
  subscriptionId: string | null;
  status: string;
}

/**
 * يتحقق من توقيع Stripe Webhook ويُرجع الحدث
 */
export async function verifyAndParseWebhook(
  body: string,
  signature: string,
): Promise<ParsedWebhookEvent | null> {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) {
    logger.error("STRIPE_WEBHOOK_SECRET غير مضبوط");
    return null;
  }

  // التحقق من التوقيع
  const isValid = await verifyStripeSignature(body, signature, secret);
  if (!isValid) {
    logger.warn("توقيع Stripe Webhook غير صالح");
    return null;
  }

  const event = JSON.parse(body) as {
    type: string;
    data: {
      object: {
        metadata?: { user_id?: string; plan_id?: string };
        id?: string;
        status?: string;
      };
    };
  };

  const obj = event.data.object;
  return {
    type: event.type as StripeWebhookEvent,
    userId: obj.metadata?.user_id ?? null,
    planId: (obj.metadata?.plan_id as PlanId) ?? null,
    subscriptionId: obj.id ?? null,
    status: obj.status ?? "unknown",
  };
}

// ─── استرداد المدفوعات ────────────────────────────────────────────────────

export async function createRefund(
  paymentIntentId: string,
  reason?: "duplicate" | "fraudulent" | "requested_by_customer",
): Promise<{ id: string; status: string }> {
  const body: Record<string, string> = { payment_intent: paymentIntentId };
  if (reason) body["reason"] = reason;

  const response = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    throw new Error("فشل إنشاء الاسترداد");
  }

  return response.json() as Promise<{ id: string; status: string }>;
}

// ─── التحقق من التوقيع ────────────────────────────────────────────────────

async function verifyStripeSignature(
  payload: string,
  sig: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = sig.split(",");
    const tPart = parts.find((p) => p.startsWith("t="));
    const v1Part = parts.find((p) => p.startsWith("v1="));
    if (!tPart || !v1Part) return false;

    const timestamp = tPart.slice(2);
    const expectedSig = v1Part.slice(3);
    const signedPayload = `${timestamp}.${payload}`;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload),
    );

    const computed = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computed === expectedSig;
  } catch {
    return false;
  }
}
