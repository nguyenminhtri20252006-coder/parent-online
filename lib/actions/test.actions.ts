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
  VocabularyWord, // Import type
} from "@/lib/types/zalo.types";
import {
  formatVocabularyMessage,
  TEMPLATE_1_MINIMALIST,
  TEMPLATE_2_ACADEMIC,
  TEMPLATE_3_FLASHCARD,
} from "@/lib/utils/message-formatter";

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

/**
 * [Kiểm thử Mới] Chạy thử nghiệm 3 định dạng từ vựng (Hardcoded)
 * Bao gồm cả Ảnh và Voice (giả lập).
 */
export async function runVocabularyTestFormatsAction(
  threadId: string,
  type: ThreadType,
) {
  console.log(`[Test Vocab] Bắt đầu gửi bộ test Power Nap đến ${threadId}...`);

  // 1. Dữ liệu Hardcoded (Theo yêu cầu)
  const sampleWord: VocabularyWord = {
    word: "Power nap",
    ipa: "/ˈpaʊər næp/",
    meaning: "Giấc ngủ ngắn để phục hồi năng lượng",
    example: "A 20-minute power nap can improve alertness and performance.",
    explanation: [
      { term: "alertness", type: "noun", meaning_vi: "sự tỉnh táo" },
    ],
    // Placeholder URLs (Bạn sẽ thay thế sau khi có link thật)
    wordImage:
      "data:image/jpeg;base64,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", // Ảnh minh họa giấc ngủ
    wordVoice:
      "https://f2-voice-aac-dl.zdn.vn/6023104021219272633/dfe318fc9ea07ffe26b1.aac", // Link AAC mẫu
  };
  let imageBuffer: Buffer | null = null;
  try {
    if (sampleWord.wordImage) {
      const res = await fetch(sampleWord.wordImage);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }
    }
  } catch (e) {
    console.error("Lỗi tải ảnh mẫu:", e);
  }

  // --- KỊCH BẢN GỬI ---

  // Gửi Format 1: Minimalist
  console.log("-> Gửi Format 1...");
  const msg1 = formatVocabularyMessage(sampleWord, TEMPLATE_1_MINIMALIST, 1, 1);
  await sendMessageAction(msg1, threadId, type);
  await delay(1000);

  // Gửi Format 2: Academic
  console.log("-> Gửi Format 2...");
  const msg2 = formatVocabularyMessage(sampleWord, TEMPLATE_2_ACADEMIC, 1, 1);
  await sendMessageAction(msg2, threadId, type);
  await delay(1000);

  // Gửi Format 3: Flashcard
  console.log("-> Gửi Format 3...");
  const msg3 = formatVocabularyMessage(sampleWord, TEMPLATE_3_FLASHCARD, 1, 1);
  const upperWord = { ...sampleWord, word: sampleWord.word.toUpperCase() };
  const msg3Upper = formatVocabularyMessage(
    upperWord,
    TEMPLATE_3_FLASHCARD,
    1,
    1,
  );
  await sendMessageAction(msg3Upper, threadId, type);
  await delay(2000);

  // --- TEST MULTIMEDIA COMBO (Full Experience) ---
  // Kịch bản Mới: Ảnh (Attachment) -> Text Giải thích (Format) -> Voice
  console.log("-> Gửi Combo Multimedia (Ảnh -> Text -> Voice)...");

  // B1: Gửi Ảnh
  if (imageBuffer) {
    await sendMessageAction(
      {
        msg: "Hình ảnh minh họa:", // Caption ngắn (hoặc để trống)
        attachments: [
          {
            data: imageBuffer,
            filename: "power-nap.jpg",
            metadata: { totalSize: imageBuffer.length },
          },
        ],
      },
      threadId,
      type,
    );
  } else {
    await sendMessageAction("[Lỗi] Không tải được ảnh mẫu.", threadId, type);
  }

  await delay(300); // Delay ngắn để đảm bảo thứ tự

  // Bước 2: Gửi Text Giải thích (Format Academic)
  // Sử dụng Template 2 làm chuẩn cho combo này
  const textMsg = formatVocabularyMessage(
    sampleWord,
    TEMPLATE_2_ACADEMIC,
    1,
    1,
  );
  await sendMessageAction(textMsg, threadId, type);

  await delay(500);

  // 4. Gửi Voice
  if (sampleWord.wordVoice) {
    const voiceOptions: SendVoiceOptions = {
      voiceUrl: sampleWord.wordVoice,
      ttl: 0,
    };
    // Gọi hàm sendVoiceAction (cần import từ chat.actions)
    await sendVoiceAction(voiceOptions, threadId, type);
  }

  return {
    success: true,
    message: "Đã gửi xong: 3 Text Format + 1 Combo (Image -> Text -> Voice).",
  };
}

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

  try {
    await runTestStyledTextAction(threadId, type);
    results.styledText = "success";
    console.log("[Test Action] Test 1 (Styled Text) OK.");
  } catch (e) {
    results.styledText = (e as Error).message;
    console.error("[Test Action] Test 1 (Styled Text) FAILED:", e);
  }

  await delay(2000); // Chờ 2 giây

  try {
    await runTestImageAttachmentAction(threadId, type);
    results.imageAttachment = "success";
    console.log("[Test Action] Test 2 (Image Attachment) OK.");
  } catch (e) {
    results.imageAttachment = (e as Error).message;
    console.error("[Test Action] Test 2 (Image Attachment) FAILED:", e);
  }

  await delay(2000); // Chờ 2 giây

  try {
    await runTestVoiceAction(threadId, type);
    results.voice = "success";
    console.log("[Test Action] Test 3 (Voice) OK.");
  } catch (e) {
    results.voice = (e as Error).message;
    console.error("[Test Action] Test 3 (Voice) FAILED:", e);
  }

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
  // await delay(2000); // Chờ 2 giây

  // try {
  //   await runTestAudioAttachmentAction(threadId, type);
  //   results.audioAttachment = "success";
  //   console.log("[Test Action] Test 6 (Audio Attachment) OK.");
  // } catch (e) {
  //   results.audioAttachment = (e as Error).message;
  //   console.error("[Test Action] Test 6 (Audio Attachment) FAILED:", e);
  // }

  console.log("[Test Action] Hoàn tất tất cả kiểm thử.", results);
  return results;
}
