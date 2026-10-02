import crypto from "crypto";
import { NextResponse } from "next/server";
import { fulfillReference } from "@/lib/fulfill";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  if (event.event === "charge.success" && event.data?.reference) {
    await fulfillReference(event.data.reference);
  }

  return NextResponse.json({ received: true });
}