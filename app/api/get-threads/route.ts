import { NextRequest, NextResponse } from "next/server";
import { ZaloStateless } from "@/lib/zalo-stateless";
import { ZaloSessionToken } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body as { token: ZaloSessionToken };

    if (!token)
      return NextResponse.json({ error: "No token" }, { status: 400 });

    const bot = new ZaloStateless();
    await bot.login(token);
    const threads = await bot.getThreads();

    return NextResponse.json({ threads });
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
