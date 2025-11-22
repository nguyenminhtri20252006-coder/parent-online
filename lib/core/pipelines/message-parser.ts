/**
 * lib/core/pipelines/message-parser.ts
 * [PIPELINE STEP 2]
 * Chuyển đổi RawZaloMessage -> StandardMessage.
 */

import {
  StandardMessage,
  NormalizedContent,
  RawZaloMessage,
} from "@/lib/types/zalo.types";

export class MessageParser {
  public parse(rawMsg: RawZaloMessage): StandardMessage | null {
    try {
      if (!rawMsg || !rawMsg.data) return null;

      const { msgType, content, uidFrom, dName, ts, quote } = rawMsg.data;

      // 1. Chuẩn hóa Content
      const normalizedContent = this.parseContent(msgType, content);

      // 2. Xây dựng object chuẩn
      return {
        msgId: rawMsg.data.msgId,
        threadId: rawMsg.threadId,
        isGroup: rawMsg.type === 1,
        type: rawMsg.type,
        isSelf: rawMsg.isSelf,
        timestamp: parseInt(ts) || Date.now(),
        sender: {
          uid: uidFrom,
          name: dName || "Unknown",
        },
        content: normalizedContent,
        quote: quote
          ? {
              text: quote.msg,
              senderId: quote.ownerId,
              attach: quote.attach,
            }
          : undefined,
      };
    } catch (error) {
      console.error("[MessageParser] Parse error:", error);
      return null;
    }
  }

  private parseContent(type: string, content: unknown): NormalizedContent {
    // Helper: Ép kiểu cục bộ an toàn
    const c = content as Record<string, unknown>;

    // A. TEXT
    if (type === "webchat") {
      const text =
        typeof content === "string"
          ? content
          : typeof c?.msg === "string"
          ? c.msg
          : "";
      return { type: "text", text: text };
    }

    // B. STICKER
    if (type === "chat.sticker" && c) {
      return {
        type: "sticker",
        data: {
          id: Number(c.id) || 0,
          cateId: Number(c.catId || c.cateId) || 0,
          type: Number(c.type) || 1,
          url: typeof c.url === "string" ? c.url : undefined,
        },
      };
    }

    // C. PHOTO
    if (type === "chat.photo" && c) {
      return {
        type: "photo",
        data: {
          url: String(c.href || ""),
          thumbnail: String(c.thumb || ""),
          width: Number(c.width) || 0,
          height: Number(c.height) || 0,
        },
      };
    }

    // D. VIDEO
    if (type === "chat.video.msg" && c) {
      let duration = 0,
        width = 0,
        height = 0;
      if (typeof c.params === "string") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const meta: any = JSON.parse(c.params);
          duration = Number(meta.duration) || 0;
          width = Number(meta.video_width) || 0;
          height = Number(meta.video_height) || 0;
        } catch {}
      }
      return {
        type: "video",
        data: {
          url: String(c.href || ""),
          thumbnail: String(c.thumb || ""),
          duration,
          width,
          height,
        },
      };
    }

    // E. VOICE
    if (type === "chat.voice" && c) {
      let duration = 0;
      if (typeof c.params === "string") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed: any = JSON.parse(c.params);
          duration = Number(parsed.duration) || 0;
        } catch {
          duration = parseInt(c.params) || 0;
        }
      }
      return {
        type: "voice",
        data: {
          url: String(c.href || ""),
          duration,
        },
      };
    }

    // F. LINK
    if (type === "chat.recommended" && c) {
      return {
        type: "link",
        data: {
          url: String(c.href || ""),
          title: String(c.title || ""),
          description: String(c.desc || c.description || ""),
          thumbnail: String(c.thumb || ""),
        },
      };
    }

    return { type: "unknown", raw: content };
  }
}
