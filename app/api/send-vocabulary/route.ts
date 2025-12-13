import { NextRequest, NextResponse } from "next/server";
import { ZaloStateless } from "@/lib/zalo-stateless";
import { VocabularyItem, ZaloSessionToken } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, targetId, vocabulary } = body as {
      token: ZaloSessionToken;
      targetId: string;
      vocabulary: VocabularyItem;
    };

    if (!token || !targetId || !vocabulary) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Khởi tạo bot (Stateless)
    const bot = new ZaloStateless();

    // Login
    await bot.login(token);

    // Gửi tin
    const logs = await bot.sendVocabulary(targetId, vocabulary);

    return NextResponse.json({
      success: true,
      logs: logs,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
