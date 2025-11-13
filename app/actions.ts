/**
 * app/actions.ts
 *
 * Lớp Logic (Server Actions - Lớp 2).
 * Cầu nối giữa UI (Client) và Service (Server Stateful).
 */
"use server";

// (Quan trọng) Import này sẽ KHÔNG khởi tạo lại service
// vì `runtime-service.ts` đã được chạy và cache trong tiến trình Node.js
import {
  ZaloSingletonService,
  // THÊM: Import các kiểu dữ liệu (types) để trả về
  type AccountInfo,
  type ThreadInfo,
} from "@/lib/runtime-service";

/**
 * Kích hoạt quá trình đăng nhập QR
 */
export async function startLoginQRAction() {
  console.log("[Action] Yêu cầu startLoginQRAction...");
  // Đây là một lệnh 'void', nó chỉ kích hoạt quá trình
  // Phản hồi sẽ được gửi qua SSE
  ZaloSingletonService.getInstance().startLoginQR();
}

/**
 * THÊM MỚI: Kích hoạt quá trình đăng nhập bằng Token (Session JSON)
 */
export async function startLoginWithTokenAction(tokenString: string) {
  console.log("[Action] Yêu cầu startLoginWithTokenAction...");
  if (!tokenString) {
    throw new Error("Session Token không được để trống.");
  }
  try {
    // Chỉ gọi, không trả về gì. SSE sẽ xử lý phản hồi thành công/thất bại.
    // Lỗi (vd: parse JSON, token hết hạn) sẽ được ném (throw) từ Service.
    await ZaloSingletonService.getInstance().startLoginWithToken(tokenString);
  } catch (error: unknown) {
    // Chuyển lỗi từ Service thành lỗi mà UI có thể hiển thị.
    const message =
      error instanceof Error
        ? error.message
        : "Lỗi đăng nhập token không xác định";
    console.error("[Action Error] startLoginWithTokenAction:", message);
    // Ném lỗi về cho client component (UI)
    throw new Error(message);
  }
}

/**
 * Lấy trạng thái đăng nhập hiện tại (dùng khi tải trang)
 */
export async function getLoginStatusAction() {
  return ZaloSingletonService.getInstance().getStatus();
}

/**
 * Gửi một tin nhắn
 * THAY ĐỔI: Thêm tham số 'type' (0 hoặc 1)
 */
export async function sendMessageAction(
  content: string,
  threadId: string,
  type: 0 | 1, // Thêm tham số này
) {
  // ... (Xóa các dòng formData.get) ...

  if (!content || !threadId) {
    return { success: false, error: "Thiếu content hoặc threadId" };
  }
  // Cập nhật lệnh gọi để truyền 'type'
  return ZaloSingletonService.getInstance().sendMessage(
    content,
    threadId,
    type,
  );
}

// --- THÊM MỚI: Các Actions cho luồng nghiệp vụ ---

/**
 * [Step 1] Lấy thông tin tài khoản (Bot) đang đăng nhập
 */
export async function getAccountInfoAction(): Promise<AccountInfo | null> {
  console.log("[Action] Yêu cầu getAccountInfoAction...");
  try {
    return await ZaloSingletonService.getInstance().getAccountInfo();
  } catch (error) {
    console.error("[Action Error] getAccountInfoAction:", error);
    // Ném lỗi về cho client component xử lý (trong try/catch)
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định ở Action",
    );
  }
}

/**
 * [Steps 2 & 3] Lấy danh sách hội thoại (Bạn bè & Nhóm)
 */
export async function getThreadsAction(): Promise<ThreadInfo[]> {
  console.log("[Action] Yêu cầu getThreadsAction...");
  try {
    return await ZaloSingletonService.getInstance().getThreads();
  } catch (error) {
    console.error("[Action Error] getThreadsAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định ở Action",
    );
  }
}

/**
 * THÊM MỚI: Action lấy Session Token (dùng cho copy)
 */
export async function getSessionTokenAction(): Promise<string> {
  console.log("[Action] Yêu cầu getSessionTokenAction...");
  try {
    return await ZaloSingletonService.getInstance().getSessionToken();
  } catch (error) {
    console.error("[Action Error] getSessionTokenAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định ở Action",
    );
  }
}

// --- Action Bật/Tắt Bot Nhại (Không đổi) ---
/**
 * Action: Cập nhật trạng thái Bật/Tắt của Bot Nhại
 */
export async function setEchoBotStateAction(isEnabled: boolean) {
  console.log(`[Action] Yêu cầu setEchoBotStateAction: ${isEnabled}`);
  // Đây là lệnh 'void', không cần try/catch trừ khi muốn báo lỗi về UI
  ZaloSingletonService.getInstance().setEchoBotState(isEnabled);
}
