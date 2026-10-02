import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { PLANS, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user || !userData.user.email) {
    return NextResponse.json({ error: "Your session expired. Please log in again." }, { status: 401 });
  }
  const user = userData.user;

  const { plan: planId } = await request.json();
  if (typeof planId !== "string" || !Object.keys(PLANS).includes(planId)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const plan = PLANS[planId as PlanId];

  const origin = new URL(request.url).origin;

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: plan.pesewas,
      currency: "GHS",
      reference: `sa_${randomUUID()}`,
      callback_url: `${origin}/`,
      channels: ["mobile_money", "card"],
      metadata: { user_id: user.id, plan: planId },
    }),
  });
  const json = await res.json();

  if (!res.ok || !json?.status) {
    console.error("Paystack initialize error:", json);
    return NextResponse.json({ error: "Could not start the payment. Try again." }, { status: 500 });
  }

  return NextResponse.json({ url: json.data.authorization_url });
}