// lib/types.ts

// 1. Cấu trúc Token (Credentials)
export interface ZaloSessionToken {
  cookie: unknown;
  imei: string;
  userAgent: string;
}

// 2. Cấu trúc Từ vựng (Vocabulary MVP)
export interface VocabularyItem {
  word: string;
  type: string;
  ipa: string;
  meaning: string;
  usage: string;
  example: string;
  example_meaning?: string;
  explanation: Array<{
    term: string;
    type: string;
    meaning: string;
  }>;
  media: {
    image_url?: string;
    voice_url?: string;
  };
}

// 3. Cấu trúc Hội thoại (Simplified Thread)
export interface ThreadInfo {
  id: string;
  name: string;
  avatar: string;
  type: "user" | "group";
}

// --- UTILS FORMATTER ---

export function formatVocabularyText(data: VocabularyItem): string {
  // Format tin nhắn Styled Text giả lập (vì gửi qua API text thường sẽ ổn định hơn trên serverless)
  // Nếu muốn Rich Text (Bold/Color), chúng ta cần construct object MessageContent của zca-js.
  // Ở đây tôi làm text thuần có icon trước để đảm bảo MVP chạy tốt.

  let explanationText = "";
  if (data.explanation && data.explanation.length > 0) {
    explanationText = data.explanation
      .map((ex) => `• ${ex.term} (${ex.type}): ${ex.meaning}`)
      .join("\n");
  }

  return `🔥 TỪ MỚI HÔM NAY 🔥

✨ ${data.word} (${data.type})
🔊 ${data.ipa}

💡 Nghĩa: ${data.meaning}
ℹ️ Cách dùng: ${data.usage}

📝 Ví dụ:
"${data.example}"
(${data.example_meaning || "..."})

🧩 Từ vựng trong câu:
${explanationText}
`;
}
