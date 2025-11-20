"use server";

/**
 * lib/actions/test.actions.ts
 *
 * (TỆP MỚI)
 * Lớp Logic (Server Actions - Lớp 2.5) - Logic Kiểm thử Đa phương tiện.
 * Tệp này chứa các kịch bản kiểm thử để xác thực các API gửi tin.
 * Các hàm này được thiết kế để gọi từ "Cổng Kiểm thử" (API route).
 */

import {
  sendMessageAction,
  sendVoiceAction,
  // THÊM MỚI
  sendVideoAction,
  sendLinkAction,
} from "@/lib/actions/chat.actions";
import {
  MessageContent,
  ThreadType,
  SendVoiceOptions,
  // THÊM MỚI
  SendVideoOptions,
  SendLinkOptions,
} from "@/lib/types/zalo.types";
// Import TextStyle từ zca-js (Giả định nó được export từ SSOT hoặc zca-js)
// Nếu SSOT không export, chúng ta cần cập nhật nó, nhưng tạm thời dùng string
enum TextStyle {
  Bold = "b",
  Italic = "i",
  Red = "c_db342e",
  Big = "f_18",
}

// --- Hàm trợ giúp ---
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- CÁC KỊCH BẢN KIỂM THỬ ---

/**
 * [Kiểm thử 1] Gửi tin nhắn văn bản có định dạng (Styled Text)
 */
export async function runTestStyledTextAction(
  threadId: string,
  type: ThreadType,
) {
  console.log(`[Test Action] Đang chạy Test 1: Styled Text đến ${threadId}`);
  const text = "Big - Bold - Italic - Red";
  const message: MessageContent = {
    msg: text,
    styles: [
      { start: 0, len: 3, st: TextStyle.Big }, // "Kiểm thử API"
      { start: 6, len: 4, st: TextStyle.Bold }, // "Tin nhắn có Định dạng (Styles)"
      { start: 13, len: 6, st: TextStyle.Italic }, //"Tin nhắn có Định dạng (Styles)"
      { start: 22, len: 3, st: TextStyle.Red }, //"Tin nhắn có Định dạng (Styles)"
    ],
  };
  return sendMessageAction(message, threadId, type);
}

/**
 * [Kiểm thử 2] Gửi tin nhắn đính kèm Hình ảnh (Tải về Server)
 * (Giải pháp B: fetch URL -> Buffer -> Attachment)
 */
export async function runTestImageAttachmentAction(
  threadId: string,
  type: ThreadType,
) {
  console.log(
    `[Test Action] Đang chạy Test 2: Image Attachment đến ${threadId}`,
  );
  const imageUrl =
    "https://f21-zpc.zdn.vn/jpg/8848797253866041229/0fbba8d4891d05435c0c.jpg";
  let imageBuffer: Buffer;
  let imageSize: number;

  try {
    // 1. Tải ảnh từ URL
    console.log(`[Test Action] Đang tải ảnh từ: ${imageUrl}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Không thể tải ảnh: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
    imageSize = imageBuffer.length;
    console.log(
      `[Test Action] Tải ảnh thành công. Kích thước: ${imageSize} bytes`,
    );
  } catch (fetchError) {
    console.error("[Test Action] Lỗi khi tải ảnh:", fetchError);
    // Gửi tin nhắn báo lỗi nếu không tải được ảnh
    await sendMessageAction(
      `[Test Lỗi] Không thể tải ảnh từ URL: ${(fetchError as Error).message}`,
      threadId,
      type,
    );
    throw fetchError;
  }

  // 2. Gửi ảnh dưới dạng Buffer Attachment
  const message: MessageContent = {
    msg: "Kiểm thử API: Gửi ảnh (dưới dạng Buffer Attachment)",
    attachments: [
      {
        data: imageBuffer,
        filename: "test-image.png",
        metadata: {
          totalSize: imageSize,
          // width/height là tùy chọn, bỏ qua để đơn giản hóa
        },
      },
    ],
  };
  return sendMessageAction(message, threadId, type);
}

/**
 * [Kiểm thử 3] Gửi tin nhắn Voice (từ URL)
 */
export async function runTestVoiceAction(threadId: string, type: ThreadType) {
  console.log(`[Test Action] Đang chạy Test 3: Voice (URL) đến ${threadId}`);
  // Sử dụng một URL MP3 công khai để kiểm thử
  const voiceUrl =
    "https://voice-aac-dl.zdn.vn/4300961803396616484/abdf77fb64b185efdca0.aac";

  const options: SendVoiceOptions = {
    voiceUrl: voiceUrl,
    ttl: 0, // 0 = Không tự hủy
  };
  return sendVoiceAction(options, threadId, type);
}

/**
 * [Kiểm thử 4] Gửi tin nhắn Ảnh với Thumbnail (sử dụng API sendVideo)
 */
export async function runTestVideoAsImageAction(
  threadId: string,
  type: ThreadType,
) {
  console.log(
    `[Test Action] Đang chạy Test 4: Ảnh + Thumbnail (qua sendVideo) đến ${threadId}`,
  );
  // API này yêu cầu cả hai URL đều đã được host
  const mainImageUrl =
    "https://packaged-media.redd.it/nbs3hjdsyfqe1/pb/m2-res_480p.mp4?m=DASHPlaylist.mpd&v=1&e=1763262000&s=62198d3cc9f1d2f1bc5d1e2b6e39a9702207e1fb";
  const thumbnailUrl =
    "https://f21-zpc.zdn.vn/jpg/8848797253866041229/0fbba8d4891d05435c0c.jpg";

  const options: SendVideoOptions = {
    msg: "Kiểm thử API: Gửi ảnh (với thumbnail) bằng sendVideo",
    videoUrl: mainImageUrl, // API này dùng 'videoUrl' để gửi cả ảnh
    thumbnailUrl: thumbnailUrl,
    // --- SỬA LỖI: Thêm các tham số bắt buộc cho Nhóm ---
    width: 600,
    height: 400,
    duration: 1, // Đặt giá trị giả (1ms) vì đây là ảnh
    // -------------------------------------------------
  };
  return sendVideoAction(options, threadId, type);
}

/**
 * [Kiểm thử 5] Gửi tin nhắn Link (với Preview)
 */
export async function runTestLinkAction(threadId: string, type: ThreadType) {
  console.log(`[Test Action] Đang chạy Test 5: Link (Preview) đến ${threadId}`);
  const options: SendLinkOptions = {
    msg: "Kiểm thử API: Gửi tin nhắn Link (Google)",
    link: "https://google.com",
    ttl: 0,
  };
  return sendLinkAction(options, threadId, type);
}

/**
 * [Kiểm thử 6] Gửi tin nhắn Âm thanh (dưới dạng Buffer Attachment)
 * (Giải pháp B: fetch URL -> Buffer -> Attachment)
 */
export async function runTestAudioAttachmentAction(
  threadId: string,
  type: ThreadType,
) {
  console.log(
    `[Test Action] Đang chạy Test 6: Audio Attachment (Buffer) đến ${threadId}`,
  );
  // Sử dụng cùng một URL MP3 như Test 3
  const audioUrl =
    "https://voice-aac-dl.zdn.vn/4300961803396616484/abdf77fb64b185efdca0.aac";
  let audioBuffer: Buffer;
  let audioSize: number;

  try {
    // 1. Tải âm thanh từ URL
    console.log(`[Test Action] Đang tải âm thanh từ: ${audioUrl}`);
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Không thể tải âm thanh: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = Buffer.from(arrayBuffer);
    audioSize = audioBuffer.length;
    console.log(
      `[Test Action] Tải âm thanh thành công. Kích thước: ${audioSize} bytes`,
    );
  } catch (fetchError) {
    console.error("[Test Action] Lỗi khi tải âm thanh:", fetchError);
    await sendMessageAction(
      `[Test Lỗi] Không thể tải âm thanh từ URL: ${
        (fetchError as Error).message
      }`,
      threadId,
      type,
    );
    throw fetchError;
  }

  // 2. Gửi âm thanh dưới dạng Buffer Attachment
  // QUAN TRỌNG: Đặt tên 'filename' với đuôi .mp3
  const message: MessageContent = {
    msg: "Kiểm thử API: Gửi âm thanh (dưới dạng Buffer Attachment)",
    attachments: [
      {
        data: audioBuffer,
        filename: "test-audio.mp3", // Tên file rất quan trọng
        metadata: {
          totalSize: audioSize,
        },
      },
    ],
  };
  return sendMessageAction(message, threadId, type);
}

/**
 * [Hàm Tổng hợp] Chạy tất cả các bài kiểm thử
 */
export async function runAllMessagingTestsAction(
  threadId: string,
  type: ThreadType,
) {
  console.log(`[Test Action] Bắt đầu chạy TẤT CẢ kiểm thử cho ${threadId}...`);
  const results = {
    styledText: "pending",
    imageAttachment: "pending",
    voice: "pending",
    videoAsImage: "pending", // THÊM MỚI
    link: "pending", // THÊM MỚI
    audioAttachment: "pending", // THÊM MỚI (Test 6)
  };

  // try {
  //   await runTestStyledTextAction(threadId, type);
  //   results.styledText = "success";
  //   console.log("[Test Action] Test 1 (Styled Text) OK.");
  // } catch (e) {
  //   results.styledText = (e as Error).message;
  //   console.error("[Test Action] Test 1 (Styled Text) FAILED:", e);
  // }

  // await delay(2000); // Chờ 2 giây

  // try {
  //   await runTestImageAttachmentAction(threadId, type);
  //   results.imageAttachment = "success";
  //   console.log("[Test Action] Test 2 (Image Attachment) OK.");
  // } catch (e) {
  //   results.imageAttachment = (e as Error).message;
  //   console.error("[Test Action] Test 2 (Image Attachment) FAILED:", e);
  // }

  // await delay(2000); // Chờ 2 giây

  // try {
  //   await runTestVoiceAction(threadId, type);
  //   results.voice = "success";
  //   console.log("[Test Action] Test 3 (Voice) OK.");
  // } catch (e) {
  //   results.voice = (e as Error).message;
  //   console.error("[Test Action] Test 3 (Voice) FAILED:", e);
  // }

  // THÊM MỚI
  // await delay(2000); // Chờ 2 giây

  // try {
  //   await runTestVideoAsImageAction(threadId, type);
  //   results.videoAsImage = "success";
  //   console.log("[Test Action] Test 4 (Video as Image) OK.");
  // } catch (e) {
  //   results.videoAsImage = (e as Error).message;
  //   console.error("[Test Action] Test 4 (Video as Image) FAILED:", e);
  // }

  // THÊM MỚI
  // await delay(2000); // Chờ 2 giây

  // try {
  //   await runTestLinkAction(threadId, type);
  //   results.link = "success";
  //   console.log("[Test Action] Test 5 (Link) OK.");
  // } catch (e) {
  //   results.link = (e as Error).message;
  //   console.error("[Test Action] Test 5 (Link) FAILED:", e);
  // }
  // THÊM MỚI (Test 6)
  await delay(2000); // Chờ 2 giây

  try {
    await runTestAudioAttachmentAction(threadId, type);
    results.audioAttachment = "success";
    console.log("[Test Action] Test 6 (Audio Attachment) OK.");
  } catch (e) {
    results.audioAttachment = (e as Error).message;
    console.error("[Test Action] Test 6 (Audio Attachment) FAILED:", e);
  }

  console.log("[Test Action] Hoàn tất tất cả kiểm thử.", results);
  return results;
}
