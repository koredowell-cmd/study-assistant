import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const DAILY_LIMIT = 2;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are an expert university tutor helping a student prepare for an exam using their lecture notes. You will receive text extracted from lecture slides or notes. Produce thorough exam-preparation material in plain text, using exactly these sections. Do not use markdown symbols like ** or #.

OVERVIEW
4 to 6 sentences on what the material covers and how the topics connect.

DETAILED STUDY NOTES
Go through every major topic in the material, in order. For each topic, write the topic name in capitals, then explain it clearly: definitions, how it works, key points, examples, strengths and weaknesses, and any important names or terms. Do not skip topics. Be detailed, not brief.

KEY TERMS
Every important term with a clear definition.

COMPARISONS
Where the material has similar concepts or theories, explain how they differ.

PRACTICE QUESTIONS
Part A: 15 multiple-choice questions, each with options A to D, then the correct answer with a one-line reason.
Part B: 10 short-answer questions, each with a model answer of 2 to 4 sentences.
Part C: 5 essay questions, each with a list of the points a strong answer would include.

Use simple language. Base everything only on the provided material, and do not invent content that is not in it.`;

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json(
      { error: "Please log in to continue." },
      { status: 401 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your session expired. Please log in again." },
      { status: 401 }
    );
  }

  const { text } = await request.json();
  if (typeof text !== "string" || text.trim().length < 50) {
    return NextResponse.json(
      { error: "Not enough text to work with." },
      { status: 400 }
    );
  }

  const { data: count, error: usageError } = await supabase.rpc("use_upload", {
    daily_limit: DAILY_LIMIT,
  });
  if (usageError) {
    console.error("Usage error:", usageError);
    return NextResponse.json(
      { error: "Could not check your usage. Please try again." },
      { status: 500 }
    );
  }
  if (count === -1) {
    return NextResponse.json(
      { error: `You have used all ${DAILY_LIMIT} free uploads for today. Come back tomorrow, or buy a pass below for more uploads.` },
      { status: 429 }
    );
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: text.slice(0, 60000),
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 8000 },
    });

    return NextResponse.json({ output: response.text ?? "" });
  } catch (err) {
    console.error("Gemini error:", err);
    return NextResponse.json(
      { error: "The AI is busy or could not process this. Please try again in a minute." },
      { status: 500 }
    );
  }
}