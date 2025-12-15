import { NextRequest } from "next/server";
import { Zalo } from "zca-js";
import os from "os";
import path from "path";

// Cấu hình không cache cho SSE
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        const randomId = Math.random().toString(36).substring(7);
        const tmpDir = os.tmpdir();
        const qrPath = path.join(tmpDir, `zalo-qr-${randomId}.png`);

        console.log(`[SSE] Starting QR Login session: ${randomId}`);

        // 1. Khởi tạo Zalo (Bỏ ZaloConfig, ép kiểu any cho config để tránh lỗi TS)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zalo = new Zalo({
          selfListen: false,
          checkUpdate: false,
          logging: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        // 2. Gọi loginQR
        // Sử dụng 'any' cho callback event để tránh lỗi type mismatch do thư viện không export type
        const api = await zalo.loginQR(
          {
            qrPath: qrPath,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async (event: any) => {
            // Log type để debug
            console.log(`[SSE] QR Event received: ${event.type}`);

            try {
              // Logic xử lý base64 image từ code mẫu bạn cung cấp
              // Check nếu data là string (base64 raw) hoặc object chứa image
              let base64 =
                typeof event === "string" ? event : event.data?.image;

              // Nếu không có image trong data, fallback sang pathResult (nếu thư viện trả về string)
              if (!base64 && typeof event === "string") {
                base64 = event; // Legacy callback support
              }

              if (base64) {
                // Chuẩn hóa base64 prefix
                if (
                  typeof base64 === "string" &&
                  !base64.startsWith("data:image")
                ) {
                  base64 = `data:image/png;base64,${base64}`;
                }
                // Gửi về client
                sendEvent("qr", { image: base64 });
              } else if (event.actions && event.actions.saveToFile) {
                // Fallback: Nếu thư viện yêu cầu saveToFile
                await event.actions.saveToFile(qrPath);
                // Client sẽ tự hiển thị loading hoặc ta cần đọc file này (nhưng ưu tiên base64 ở trên)
                console.log("QR saved to disk (fallback flow)");
              }
            } catch (err) {
              console.error("Error processing QR event:", err);
              sendEvent("error", { message: "Failed to process QR code" });
            }
          },
        );

        // === 3. ĐĂNG NHẬP THÀNH CÔNG ===
        console.log(`[SSE] Login successful for session: ${randomId}`);

        const context = api.getContext();
        const cookieJar = api.getCookie();

        // Trích xuất credentials chuẩn để copy
        const credentials = {
          cookie: cookieJar,
          imei: context.imei,
          userAgent: context.userAgent,
        };

        // Gửi event 'success' kèm credentials về client
        sendEvent("success", credentials);
      } catch (error: unknown) {
        console.error("[SSE] Error in QR flow:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        sendEvent("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
