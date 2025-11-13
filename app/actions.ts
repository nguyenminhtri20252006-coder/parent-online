/**
 * app/actions.ts
 *
 * Lớp Logic (Server Actions - Lớp 2).
 * Cầu nối giữa UI (Client) và Service (Server Stateful).
 */
"use server";

// (Quan trọng) Import này sẽ KHÔNG khởi tạo lại service
// vì `runtime-service.ts` đã được chạy và cache trong tiến trình Node.js
import { ZaloSingletonService } from "@/lib/runtime-service";

/**
 * Kích hoạt quá trình đăng nhập QR
 */
export async function startLoginAction() {
  console.log("[Action] Yêu cầu startLoginAction...");
  // Đây là một lệnh 'void', nó chỉ kích hoạt quá trình
  // Phản hồi sẽ được gửi qua SSE
  ZaloSingletonService.getInstance().startLoginQR();
}

/**
 * Lấy trạng thái đăng nhập hiện tại (dùng khi tải trang)
 */
export async function getLoginStatusAction() {
  return ZaloSingletonService.getInstance().getStatus();
}

/**
 * Gửi một tin nhắn
 */
// SỬA LỖI: Thay đổi tham số từ (formData: FormData) thành (content: string, threadId: string)
// để khớp với cách gọi từ app/page.tsx
export async function sendMessageAction(content: string, threadId: string) {
  // Bỏ các dòng .get() vì đã có tham số trực tiếp
  // const content = formData.get('content') as string;
  // const threadId = formData.get('threadId') as string;

  if (!content || !threadId) {
    return { success: false, error: "Thiếu content hoặc threadId" };
  }

  return ZaloSingletonService.getInstance().sendMessage(content, threadId);
}
