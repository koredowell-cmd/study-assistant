import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/fulfill";

export const maxDuration = 60;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
  const token = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json(
      { error: "Please log in to continue." },
      { status: 401 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your session expired. Please log in again." },
      { status: 401 }
    );
  }

  const userId = userData.user.id;

  const body = await request.json();
  const text = body?.text;
  const fileName =
    typeof body?.fileName === "string"
      ? body.fileName.trim().slice(0, 200)
      : "Study material";

  if (typeof text !== "string" || text.trim().length < 50) {
    return NextResponse.json(
      { error: "Not enough text to work with." },
      { status: 400 }
    );
  }

  const { data: usage, error: usageError } =
    await supabase.rpc("use_upload");

  if (usageError) {
    console.error("Usage error:", usageError);

    return NextResponse.json(
      { error: "Could not check your usage. Please try again." },
      { status: 500 }
    );
  }

  if (!usage?.ok) {
    return NextResponse.json(
      {
        error:
          "You have used your 2 free uploads. Buy a pass below to continue studying.",
      },
      { status: 429 }
    );
  }

  async function refund() {
    const { error: refundError } = await adminClient().rpc(
      "refund_upload",
      {
        p_user_id: userId,
        p_source: usage.source,
        p_pass_id: usage.pass_id ?? null,
      }
    );

    if (refundError) {
      console.error("Refund error:", refundError);
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: text.slice(0, 60000),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 8000,
      },
    });

    const output = response.text ?? "";

    if (output.trim().length < 100) {
      throw new Error("Empty AI response");
    }

    // Create a readable title from the PDF filename.
    const title =
      fileName.replace(/\.pdf$/i, "").trim() || "Study material";

    // Save the successful study material to Supabase.
    const { error: libraryError } = await adminClient()
      .from("study_materials")
      .insert({
        user_id: userId,
        title,
        original_filename: fileName,
        output,
      });

    if (libraryError) {
      // The student still gets their generated notes even if
      // the library save fails.
      console.error("Study library save error:", libraryError);

      return NextResponse.json({
        output,
        librarySaved: false,
      });
    }

    return NextResponse.json({
      output,
      librarySaved: true,
    });
  } catch (err) {
    console.error("Gemini error:", err);

    await refund();

    const status = (err as { status?: number }).status;

    if (status === 429 || status === 503) {
      return NextResponse.json(
        {
          error:
            "The AI service is very busy right now. Please try again in a minute. Your upload was not used.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Something went wrong while processing your PDF. Please try again. Your upload was not used.",
      },
      { status: 500 }
    );
  }
}