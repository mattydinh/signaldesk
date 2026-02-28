import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/contact — submit contact / request demo form
 * Body: { name, email, message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message } = body as { name?: string; email?: string; message?: string };

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    await prisma.contactSubmission.create({
      data: {
        name: name.trim().slice(0, 200),
        email: email.trim().slice(0, 320),
        message: message.trim().slice(0, 5000),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Submission failed." },
      { status: 500 }
    );
  }
}
