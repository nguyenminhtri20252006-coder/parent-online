import { NextRequest, NextResponse } from "next/server";
import { ZaloStateless } from "@/lib/zalo-stateless";
import { VocabularyItem, ZaloSessionToken } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Destructuring và Type Assertion an toàn
    const { token, targetId, vocabulary } = body as {
      token: ZaloSessionToken;
      targetId: string;
      vocabulary: VocabularyItem;
    };

    // Validation đầu vào chặt chẽ
    if (!token || !targetId || !vocabulary) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: token, targetId, or vocabulary",
        },
        { status: 400 },
      );
    }

    // 1. Khởi tạo Bot Service
    const bot = new ZaloStateless();

    // 2. Thực hiện Login (Stateless)
    // Lưu ý: Việc này sẽ khởi tạo session mới mỗi lần gọi API
    await bot.login(token);

    // 3. Gửi Vocabulary
    // Toàn bộ logic định dạng (Bold, H1, Italic...) đã được đóng gói trong hàm này
    const logs = await bot.sendVocabulary(targetId, vocabulary);

    // 4. Trả về kết quả thành công
    return NextResponse.json({
      success: true,
      logs: logs,
    });
  } catch (error: unknown) {
    console.error("[API send-vocabulary] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown internal server error";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
