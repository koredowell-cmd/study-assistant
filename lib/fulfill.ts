import { createClient } from "@supabase/supabase-js";
import { PLANS, type PlanId } from "./plans";

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function fulfillReference(reference: string, expectedUserId?: string) {
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: "no-store",
    }
  );
  const json = await res.json();
  const tx = json?.data;

  if (!res.ok || !json?.status || tx?.status !== "success") {
    return { ok: false, error: "Payment not completed yet." };
  }

  const planId = tx.metadata?.plan as string | undefined;
  const userId = tx.metadata?.user_id as string | undefined;

  if (!planId || !userId || !Object.keys(PLANS).includes(planId)) {
    return { ok: false, error: "Payment details did not match." };
  }
  const plan = PLANS[planId as PlanId];

  if (expectedUserId && expectedUserId !== userId) {
    return { ok: false, error: "This payment belongs to a different account." };
  }
  if (tx.currency !== "GHS" || tx.amount !== plan.pesewas) {
    return { ok: false, error: "Payment amount did not match." };
  }

  const expiresAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient().from("passes").insert({
    user_id: userId,
    plan: planId,
    uploads_total: plan.uploads,
    expires_at: expiresAt,
    reference,
  });

  // 23505 means this payment was already activated, which is fine
  if (error && error.code !== "23505") {
    console.error("Pass insert error:", error);
    return { ok: false, error: "Could not activate your pass. Contact support." };
  }

  return { ok: true, plan: planId };
}