import { Zalo, API } from "zca-js";
import {
  ZaloSessionToken,
  VocabularyItem,
  formatVocabularyText,
  ThreadInfo,
} from "@/lib/types";

// Helper: Tải buffer từ URL
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

    if (!token.cookie || !token.imei) {
      throw new Error("Token thiếu cookie hoặc imei");
    }

    let cookieData = token.cookie;
    if (typeof cookieData === "string" && cookieData.trim().startsWith("{")) {
      try {
        cookieData = JSON.parse(cookieData);
        console.log("[ZaloStateless] Parsed cookie string to object.");
      } catch {
        console.log("[ZaloStateless] Cookie is raw string.");
      }
    }

    const credentials = {
      cookie: cookieData,
      imei: token.imei,
      userAgent:
        token.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    console.log(`[ZaloStateless] Credentials prepared. IMEI: ${token.imei}`);

    const zalo = new Zalo({
      authType: "cookie",
      selfListen: false,
      log: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

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

  async getThreads(): Promise<ThreadInfo[]> {
    if (!this.api) throw new Error("Unauthorized: Bot chưa đăng nhập");

    console.log("[ZaloStateless] Fetching threads (Friends & Groups)...");
    try {
      // 1. Lấy danh sách bạn bè
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const friendsList: any[] = await this.api.getAllFriends();
      console.log(`[ZaloStateless] Found ${friendsList.length} friends.`);

      const friendThreads: ThreadInfo[] = friendsList.map((f) => ({
        id: f.userId,
        name: f.displayName || f.zaloName || "Unknown User",
        avatar: f.avatar || "",
        type: "user",
      }));

      // 2. Lấy danh sách nhóm
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const groupsResult: any = await this.api.getAllGroups();
      const allGroupIds = Object.keys(groupsResult.gridVerMap || {});
      console.log(`[ZaloStateless] Found ${allGroupIds.length} groups.`);

      let groupThreads: ThreadInfo[] = [];

      // 3. Hydrate thông tin nhóm (Batching 50)
      const targetGroupIds = allGroupIds.slice(0, 50);

      if (targetGroupIds.length > 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const groupInfos: any = await this.api.getGroupInfo(targetGroupIds);

          groupThreads = targetGroupIds.map((gid) => {
            const info = groupInfos.gridInfoMap?.[gid];
            return {
              id: gid,
              name: info ? info.name : `Group ${gid}`,
              avatar: info ? info.avt : "",
              type: "group",
            };
          });
        } catch (err) {
          console.error("[ZaloStateless] Error fetching group details:", err);
          groupThreads = targetGroupIds.map((gid) => ({
            id: gid,
            name: `Group ${gid}`,
            avatar: "",
            type: "group",
          }));
        }
      }

      const combined = [...groupThreads, ...friendThreads];
      console.log(
        `[ZaloStateless] Returning ${combined.length} total threads.`,
      );
      return combined;
    } catch (e) {
      console.error("[ZaloStateless] Fetch threads failed:", e);
      throw e;
    }
  }

  async sendVocabulary(targetId: string, vocab: VocabularyItem) {
    if (!this.api) throw new Error("Unauthorized: Bot chưa đăng nhập");

    const results = [];
    // Logic check group (đơn giản hóa)
    const isGroup = targetId.startsWith("g") || targetId.length > 18;
    const type = isGroup ? 1 : 0;

    // A. Gửi Ảnh (Ưu tiên Buffer để ổn định)
    if (vocab.media.image_url) {
      try {
        const buffer = await fetchBuffer(vocab.media.image_url);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg: any = {
          msg: "",
          attachments: [
            {
              data: buffer,
              filename: "vocab_image.jpg",
              metadata: { totalSize: buffer.length },
            },
          ],
        };
        await this.api.sendMessage(msg, targetId, type);
        results.push("Image Sent (Buffer)");
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

    // C. Gửi Voice (FIXED LOGIC)
    // Thay vì dùng sendVoice (dễ lỗi với URL ngoài), ta tải về và gửi như File Attachment (.mp3)
    if (vocab.media.voice_url) {
      try {
        console.log(`[Voice] Sending URL directly: ${vocab.media.voice_url}`);

        // Gọi API sendVoice gốc với URL
        await this.api.sendVoice(
          { voiceUrl: vocab.media.voice_url },
          targetId,
          type,
        );

        results.push("Voice Sent (Direct URL)");
      } catch (e) {
        console.error("Lỗi gửi voice (Direct):", e);

        // Fallback: Gửi link trần nếu API sendVoice thất bại
        try {
          await this.api.sendMessage(
            `Link phát âm: ${vocab.media.voice_url}`,
            targetId,
            type,
          );
          results.push("Voice Sent (Link Fallback)");
        } catch (err2) {
          results.push(
            `Voice Failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    return results;
  }
}
