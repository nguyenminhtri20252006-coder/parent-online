"use server";

/**
 * lib/actions/chat.actions.ts
 *
 * Lớp Logic (Server Actions - Lớp 2) - Nghiệp vụ Chat & Lấy Dữ liệu.
 * Cầu nối giữa UI (Client) và Service (Server Stateful) cho các tác vụ nghiệp vụ chính.
 */

import { ZaloSingletonService } from "@/lib/runtime-service";
// SỬA ĐỔI: Import các type mới từ SSOT
import {
  AccountInfo,
  ThreadInfo,
  MessageContent,
  ThreadType,
  SendVoiceOptions,
  SendVideoOptions,
  SendLinkOptions,
} from "@/lib/types/zalo.types";

/**
 * Gửi một tin nhắn
 * THAY ĐỔI: Thêm tham số 'type' (0 hoặc 1)
 */
export async function sendMessageAction(
  message: string | MessageContent,
  threadId: string,
  type: ThreadType, // SỬA ĐỔI: Dùng enum ThreadType
) {
  if (!message || !threadId) {
    return { success: false, error: "Thiếu message hoặc threadId" };
  }
  // Cập nhật lệnh gọi để truyền 'type'
  return ZaloSingletonService.getInstance().sendMessage(
    message,
    threadId,
    type,
  );
}

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
 * Action: Cập nhật trạng thái Bật/Tắt của Bot Nhại
 */
export async function setEchoBotStateAction(isEnabled: boolean) {
  console.log(`[Action] Yêu cầu setEchoBotStateAction: ${isEnabled}`);
  // Đây là lệnh 'void', không cần try/catch trừ khi muốn báo lỗi về UI
  ZaloSingletonService.getInstance().setEchoBotState(isEnabled);
}

// --- THÊM MỚI (GĐ 5): ACTIONS ĐA PHƯƠNG TIỆN ---

/**
 * [API] Gửi tin nhắn Voice (từ URL)
 */
export async function sendVoiceAction(
  options: SendVoiceOptions,
  threadId: string,
  type: ThreadType,
) {
  console.log(`[Action] Yêu cầu sendVoiceAction đến: ${threadId}`);
  try {
    return await ZaloSingletonService.getInstance().sendVoice(
      options,
      threadId,
      type,
    );
  } catch (error: unknown) {
    console.error("[Action Error] sendVoiceAction:", error);
    throw new Error(error instanceof Error ? error.message : "Lỗi gửi Voice");
  }
}

/**
 * [API] Gửi tin nhắn Video (từ URL)
 */
export async function sendVideoAction(
  options: SendVideoOptions,
  threadId: string,
  type: ThreadType,
) {
  console.log(`[Action] Yêu cầu sendVideoAction đến: ${threadId}`);
  try {
    return await ZaloSingletonService.getInstance().sendVideo(
      options,
      threadId,
      type,
    );
  } catch (error: unknown) {
    console.error("[Action Error] sendVideoAction:", error);
    throw new Error(error instanceof Error ? error.message : "Lỗi gửi Video");
  }
}

/**
 * [API] Gửi tin nhắn Link (Preview)
 */
export async function sendLinkAction(
  options: SendLinkOptions,
  threadId: string,
  type: ThreadType,
) {
  console.log(`[Action] Yêu cầu sendLinkAction đến: ${threadId}`);
  try {
    return await ZaloSingletonService.getInstance().sendLink(
      options,
      threadId,
      type,
    );
  } catch (error: unknown) {
    console.error("[Action Error] sendLinkAction:", error);
    throw new Error(error instanceof Error ? error.message : "Lỗi gửi Link");
  }
}
