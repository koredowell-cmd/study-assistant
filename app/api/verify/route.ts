import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { fulfillReference } from "@/lib/fulfill";

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
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session expired. Please log in again." }, { status: 401 });
  }

  const { reference } = await request.json();
  if (typeof reference !== "string" || reference.length < 5) {
    return NextResponse.json({ error: "Missing payment reference." }, { status: 400 });
  }

  const result = await fulfillReference(reference, userData.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, plan: result.plan });
}