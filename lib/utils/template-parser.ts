import { VocabularyWord, MessageContent } from "@/lib/types/zalo.types";

// --- KHO MẪU (TEMPLATE STORE) ---
// Sử dụng cú pháp:
// {{token}} : Thay thế dữ liệu
// *text* : In đậm (Bold)
// _text_    : In nghiêng (Italic)

export const TEMPLATE_4_CONVERSATIONAL = `👋 Chào bạn! Từ mới hôm nay:

✨ *{{word}}* (_{{type}}_) ✨
_{{ipa}}_

🤔 **Nghĩa là gì nhỉ?**
➥ *{{meaning}}*

🗣️ **Thử nói câu này xem:**
"_{{example}}_"

🧩 **Từ vựng trong câu:**
{{explanation_list}}`;

export const TEMPLATE_5_MODERN_UI = `➖➖➖➖➖➖➖➖
💎 WORD OF THE DAY
➖➖➖➖➖➖➖➖

🎯 *{{word}}* (_{{type}}_)
🔉 _{{ipa}}_

💡 **Ý nghĩa:**
*{{meaning}}*
ℹ️ *Cách dùng:* {{usage}}

📢 **Ví dụ mẫu:**
{{example}}

🧩 **Giải thích thêm:**
{{explanation_list}}
➖➖➖➖➖➖➖➖`;

export const TEMPLATE_6_DICTIONARY = `📖 **TỪ ĐIỂN ANH - VIỆT**
────────────────
🔵 *{{word}}* (_{{type}}_)

🔹 **Phát âm:** _{{ipa}}_
🔹 **Định nghĩa:** *{{meaning}}*
🔹 **Cách dùng:** {{usage}}

🔰 **Ví dụ minh họa:**
_{{example}}_

🧩 **Giải thích từ vựng:**
{{explanation_list}}`;

// --- LOGIC PARSER (TRÌNH BIÊN DỊCH) ---

/**
 * Hàm trợ giúp định dạng danh sách giải thích con
 * Output format: <từ>: <nghĩa> (<từ loại>)
 */
function formatExplanationList(data: VocabularyWord): string {
  if (!data.explanation || data.explanation.length === 0)
    return "(Không có giải thích thêm)";

  return data.explanation
    .map((ex) => `• ${ex.term}: ${ex.meaning_vi} (${ex.type})`)
    .join("\n");
}

/**
 * Hàm chính: Parse Template String thành Zalo MessageContent
 * @param templateStr Chuỗi mẫu chứa {{token}} và marker *bold*, _italic_
 * @param data Dữ liệu từ vựng
 * @param prefix Chuỗi thêm vào đầu (ví dụ: [Mẫu 1/5])
 */
export function parseTemplate(
  templateStr: string,
  data: VocabularyWord,
  prefix: string = "",
): MessageContent {
  // BƯỚC 1: HYDRATION (Điền dữ liệu)
  let content = templateStr;

  // Map các token cơ bản
  const replacements: Record<string, string> = {
    "{{word}}": data.word,
    "{{type}}": data.type,
    "{{ipa}}": data.ipa,
    "{{meaning}}": data.meaning,
    "{{usage}}": data.usage || "",
    "{{example}}": data.example,
    "{{explanation_list}}": formatExplanationList(data),
  };

  // Thực hiện thay thế
  Object.entries(replacements).forEach(([key, value]) => {
    // Dùng replaceAll hoặc Regex global để thay thế tất cả
    content = content.split(key).join(value);
  });

  // Thêm prefix vào đầu (nếu có)
  content = prefix + content;

  // BƯỚC 2: STYLING PARSER (Xử lý * và _)
  // Chúng ta sẽ duyệt chuỗi và xây dựng lại chuỗi kết quả + mảng styles

  let finalMsg = "";
  const styles: any[] = [];

  // Regex tìm kiếm marker: *...* hoặc _..._
  // Lưu ý: Regex này đơn giản, không hỗ trợ lồng nhau (nested) phức tạp
  // Group 1: Marker (* hoặc _)
  // Group 2: Nội dung bên trong
  const regex = /(\*|_)(.*?)\1/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [fullMatch, marker, innerText] = match;
    const matchIndex = match.index;

    // 1. Thêm phần văn bản thường trước marker
    finalMsg += content.substring(lastIndex, matchIndex);

    // 2. Tính toán style cho phần nội dung bên trong marker
    const startIndex = finalMsg.length;
    const len = innerText.length;

    // Xác định mã style
    // * -> 'b' (Bold)
    // _ -> 'i' (Italic)
    // ** -> Có thể người dùng gõ nhầm **text**, regex trên sẽ bắt '*' đầu và '*' cuối
    // Để đơn giản cho bản Lite:
    // - Nếu marker là *, style là 'b'
    // - Nếu marker là _, style là 'i'
    const styleCode = marker === "*" ? "b" : "i";

    if (len > 0) {
      styles.push({
        start: startIndex,
        len: len,
        st: styleCode,
      });
    }

    // 3. Thêm nội dung bên trong vào finalMsg (bỏ marker)
    finalMsg += innerText;

    // Cập nhật con trỏ
    lastIndex = regex.lastIndex;
  }

  // Thêm phần văn bản còn lại sau match cuối cùng
  finalMsg += content.substring(lastIndex);

  return {
    msg: finalMsg,
    styles: styles.length > 0 ? styles : undefined,
  };
}
