import { sendMessageAction, sendVoiceAction } from "@/lib/actions/chat.actions";
import {
  ThreadType,
  SendVoiceOptions,
  VocabularyWord,
} from "@/lib/types/zalo.types";
import {
  parseTemplate,
  TEMPLATE_4_CONVERSATIONAL,
  TEMPLATE_5_MODERN_UI,
  TEMPLATE_6_DICTIONARY,
} from "@/lib/utils/template-parser";
import { delay } from "../utils";

// --- MOCK DATA ---
const SAMPLE_WORD: VocabularyWord = {
  word: "Power nap",
  type: "noun",
  ipa: "/ˈpaʊər næp/",
  meaning: "Giấc ngủ ngắn để phục hồi năng lượng",
  usage: "Dùng trong bối cảnh làm việc căng thẳng.",
  example: "A 20-minute power nap can improve alertness.",
  explanation: [
    { term: "alertness", type: "noun", meaning_vi: "sự tỉnh táo" },
    { term: "performance", type: "noun", meaning_vi: "hiệu suất" },
  ],
  wordImage:
    "https://f25-zpc.zdn.vn/jpg/420656546094202488/43ff9ca9a1572d097446.jpg",
  wordVoice:
    "https://voice-aac-dl.zdn.vn/4300961803396616484/abdf77fb64b185efdca0.aac",
};

/**
 * Chạy test các mẫu Template động
 */
export async function runVocabularyTest(threadId: string, type: ThreadType) {
  console.log(`[Vocab Suite] Start Testing Templates -> ${threadId}`);

  // Tải ảnh (Buffer) một lần để dùng chung
  let imageBuffer: Buffer | null = null;
  try {
    if (SAMPLE_WORD.wordImage) {
      const res = await fetch(SAMPLE_WORD.wordImage);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        imageBuffer = Buffer.from(ab);
      }
    }
  } catch (e) {
    console.error("[Vocab Suite] Failed to load image:", e);
  }

  const templates = [
    { name: "Conversational", tpl: TEMPLATE_4_CONVERSATIONAL },
    { name: "Modern UI", tpl: TEMPLATE_5_MODERN_UI },
    { name: "Dictionary", tpl: TEMPLATE_6_DICTIONARY },
  ];

  // 1. Loop gửi Text
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    console.log(`   -> Sending Template: ${t.name}`);

    const msg = parseTemplate(
      t.tpl,
      SAMPLE_WORD,
      `[Mẫu ${i + 1}/${templates.length}] `,
    );

    await sendMessageAction(msg, threadId, type);
    await delay(2000);
  }

  // 2. Gửi Combo (Template 5)
  console.log("   -> Sending Multimedia Combo...");
  await delay(1000);

  // A. Ảnh
  if (imageBuffer) {
    await sendMessageAction(
      {
        msg: "📷 Minh họa:",
        attachments: [
          {
            data: imageBuffer,
            filename: "vocab.jpg",
            metadata: { totalSize: imageBuffer.length },
          },
        ],
      },
      threadId,
      type,
    );
  }
  await delay(500);

  // B. Text
  const textMsg = parseTemplate(TEMPLATE_5_MODERN_UI, SAMPLE_WORD, "");
  await sendMessageAction(textMsg, threadId, type);
  await delay(500);

  // C. Voice
  if (SAMPLE_WORD.wordVoice) {
    await sendVoiceAction(
      { voiceUrl: SAMPLE_WORD.wordVoice, ttl: 0 },
      threadId,
      type,
    );
  }

  return { success: true, message: "Vocabulary Test Suite Completed" };
}
