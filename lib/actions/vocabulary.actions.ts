"use server";

/**
 * lib/actions/vocabulary.actions.ts
 *
 * (TỆP MỚI)
 * Lớp Logic (Server Actions - Lớp 2) - Nghiệp vụ Gửi Từ vựng.
 * Xử lý việc gọi API bên ngoài (n8n-lhu) và định dạng tin nhắn.
 */

import { sendMessageAction } from "@/lib/actions/chat.actions";
import { VocabularyApiResponse } from "@/lib/types/zalo.types";

/**
 * Định dạng JSON trả về từ API Từ vựng thành một tin nhắn string.
 * @param data Dữ liệu JSON từ API
 * @param topic Chủ đề người dùng đã nhập
 * @returns Tin nhắn đã được định dạng
 */
function formatVocabularyMessage(
  data: VocabularyApiResponse,
  topic: string,
): string {
  // Bắt đầu tin nhắn với chủ đề (viết hoa chữ cái đầu)
  const capitalizedTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
  let message = `📚 Chủ đề: ${capitalizedTopic} (${data.count} từ vựng)\n\n`;

  // Lặp qua từng từ
  data.words.forEach((word, index) => {
    message += `----------\n`;
    message += `${index + 1}. ${word.word} (${word.meaning})\n`;
    message += `   - Phiên âm: ${word.ipa}\n`;
    message += `   - Ví dụ: ${word.example}\n`;

    // Thêm phần giải nghĩa (nếu có)
    if (word.explanation && word.explanation.length > 0) {
      message += `   - Giải nghĩa ví dụ:\n`;
      word.explanation.forEach((ex) => {
        message += `     • ${ex.term} (${ex.type}): ${ex.meaning_vi}\n`;
      });
    }
  });

  return message;
}

/**
 * Action chính: Lấy từ vựng từ API và gửi vào nhóm Zalo
 * @param groupId ID của nhóm Zalo
 * @param topic Chủ đề do người dùng nhập
 * @param threadType Loại hội thoại (0 = User, 1 = Group)
 */
export async function sendVocabularyMessageAction(
  groupId: string,
  topic: string,
  threadType: 0 | 1, // THÊM MỚI
) {
  console.log(
    `[Action] Yêu cầu sendVocabularyMessageAction cho ${groupId} (Type: ${threadType}), topic: ${topic}`,
  );

  // 1. Gọi API bên ngoài (Server-to-Server, không bị CORS)
  let apiResponse: VocabularyApiResponse;
  try {
    const response = await fetch(
      "https://n8n-lhu.giize.com/webhook/vocabulary",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ID: groupId, // Gửi ID nhóm
          Topic: topic, // Gửi Topic
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API Từ vựng báo lỗi ${response.status}: ${
          errorText || "Lỗi không xác định từ API"
        }`,
      );
    }

    apiResponse = await response.json();

    // Kiểm tra dữ liệu trả về cơ bản
    if (!apiResponse || !Array.isArray(apiResponse.words)) {
      throw new Error("API Từ vựng trả về dữ liệu không hợp lệ.");
    }
  } catch (error: unknown) {
    console.error("[Action Error] Lỗi khi fetch API Từ vựng:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi kết nối đến API Từ vựng",
    );
  }

  // 2. Định dạng tin nhắn
  const formattedMessage = formatVocabularyMessage(apiResponse, topic);

  // 3. Gửi tin nhắn vào nhóm Zalo (sử dụng Action hiện có)
  try {
    await sendMessageAction(formattedMessage, groupId, threadType); // SỬA ĐỔI: Sử dụng threadType
    return { success: true };
  } catch (error: unknown) {
    console.error("[Action Error] Lỗi khi gửi tin nhắn Zalo:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Lỗi gửi tin nhắn từ vựng vào Zalo",
    );
  }
}
