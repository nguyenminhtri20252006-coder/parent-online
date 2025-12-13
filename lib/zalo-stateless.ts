import { Zalo, API } from "zca-js";
import {
  ZaloSessionToken,
  VocabularyItem,
  formatVocabularyText,
} from "@/lib/types";

// Helper: Tải buffer ảnh
async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch media: ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export class ZaloStateless {
  private api: API | null = null;

  async login(token: ZaloSessionToken): Promise<void> {
    console.log("[ZaloStateless] Starting login process...");

    // [REVERTED LOGIC] Dựa trên code tham khảo từ ZaloLite
    // Chúng ta KHÔNG normalize cookie thành string nữa.
    // Truyền nguyên object cookie (dù là tough-cookie object hay string) vào.

    // Kiểm tra sơ bộ
    if (!token.cookie || !token.imei) {
      throw new Error("Token thiếu cookie hoặc imei");
    }

    // Nếu token.cookie là string JSON, parse nó ra object
    let cookieData = token.cookie;
    if (typeof cookieData === "string" && cookieData.trim().startsWith("{")) {
      try {
        cookieData = JSON.parse(cookieData);
        console.log("[ZaloStateless] Parsed cookie string to object.");
      } catch {
        // Giữ nguyên nếu không parse được
        console.log("[ZaloStateless] Cookie is raw string.");
      }
    }

    const credentials = {
      cookie: cookieData, // Truyền nguyên object/string
      imei: token.imei,
      userAgent:
        token.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    console.log(`[ZaloStateless] Credentials prepared. IMEI: ${token.imei}`);

    // 2. Khởi tạo
    // Ép kiểu 'any' cho options
    const zalo = new Zalo({
      authType: "cookie",
      selfListen: false,
      log: false, // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // 3. Login
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = await zalo.login(credentials as any);
      this.api = api;
      console.log("[ZaloStateless] Login successful.");
    } catch (e) {
      console.error("[ZaloStateless] Login failed:", e);
      throw new Error(
        `Zalo Login Failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async getThreads() {
    if (!this.api) throw new Error("Unauthorized: Bot chưa đăng nhập");

    console.log("[ZaloStateless] Fetching threads...");
    try {
      const [groups, friends] = await Promise.all([
        this.api.getAllGroups(),
        this.api.getAllFriends(),
      ]);

      const threads = [
        ...friends.map((f) => ({
          id: f.userId,
          name: f.displayName || f.zaloName,
          avatar: f.avatar,
          type: "user" as const,
        })),
        ...Object.keys(groups.gridVerMap).map((gid) => ({
          id: gid,
          name: `Group ${gid}`,
          avatar: "",
          type: "group" as const,
        })),
      ];

      console.log(`[ZaloStateless] Found ${threads.length} threads.`);
      return threads;
    } catch (e) {
      console.error("[ZaloStateless] Fetch threads failed:", e);
      throw e;
    }
  }

  async sendVocabulary(targetId: string, vocab: VocabularyItem) {
    if (!this.api) throw new Error("Unauthorized: Bot chưa đăng nhập");

    const results = [];
    const type = targetId.length < 18 ? 1 : 0;

    // A. Gửi Ảnh
    if (vocab.media.image_url) {
      try {
        const buffer = await fetchBuffer(vocab.media.image_url);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg: any = {
          msg: "",
          attachments: [
            {
              data: buffer,
              filename: "vocab.jpg",
              metadata: { totalSize: buffer.length },
            },
          ],
        };
        await this.api.sendMessage(msg, targetId, type);
        results.push("Image Sent");
      } catch (e) {
        console.error("Lỗi gửi ảnh:", e);
        results.push(
          `Image Failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    // B. Gửi Text
    try {
      const textContent = formatVocabularyText(vocab);
      await this.api.sendMessage(textContent, targetId, type);
      results.push("Text Sent");
    } catch (e) {
      console.error("Lỗi gửi text:", e);
      results.push("Text Failed");
    }

    // C. Gửi Voice
    if (vocab.media.voice_url) {
      try {
        await this.api.sendVoice(
          { voiceUrl: vocab.media.voice_url },
          targetId,
          type,
        );
        results.push("Voice Sent");
      } catch (e) {
        console.error("Lỗi gửi voice:", e);
        results.push(
          `Voice Failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return results;
  }
}
