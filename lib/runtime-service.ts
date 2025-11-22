/**
 * lib/runtime-service.ts
 *
 * Lớp Dịch vụ Singleton (Lớp 3) - "Bộ não" 24/7.
 * Quản lý khởi tạo, trạng thái đăng nhập và listener của `zca-js`.
 * PHIÊN BẢN FINAL (GĐ 3): Clean code, Full Echo Media, Type Safe.
 */

import { promises as fsPromise } from "fs";
import path from "path";

// Import các thư viện bên ngoài
import {
  Zalo,
  API,
  User,
  GetAllGroupsResponse,
  GroupInfoResponse,
  FindUserResponse,
  GetFriendRecommendationsResponse,
  GetSentFriendRequestResponse,
  CreateGroupOptions,
  ReviewPendingMemberRequestPayload,
  UpdateGroupSettingsOptions,
  GetGroupLinkDetailResponse,
  GetPendingGroupMembersResponse,
  ReviewPendingMemberRequestStatus,
  GetGroupMembersInfoResponse,
  // Các type cho API gửi đa phương tiện (nếu thư viện hỗ trợ)
  ThreadType,
  SendVoiceOptions,
  SendVoiceResponse,
  SendVideoOptions,
  SendVideoResponse,
  SendLinkOptions,
  SendLinkResponse,
} from "zca-js";
import sharp from "sharp";

// Import Emitter toàn cục
import { globalZaloEmitter, ZALO_EVENTS } from "./event-emitter";

// Import types từ tệp SSOT
import {
  type AccountInfo,
  type ThreadInfo,
  type ZaloCredentials,
  type ZaloUser,
  type ZaloStickerContent,
  type ZaloAttachmentContent,
  type ZaloVoiceContent,
  type ZaloVideoContent,
} from "@/lib/types/zalo.types";

/**
 * Hàm trợ giúp lấy metadata ảnh (theo yêu cầu của zca-js).
 */
async function imageMetadataGetter(filePath: string) {
  try {
    const data = await fsPromise.readFile(filePath);
    const metadata = await sharp(data).metadata();
    return {
      height: metadata.height,
      width: metadata.width,
      size: metadata.size || data.length,
    };
  } catch (error) {
    console.error(`[imageMetadataGetter] Lỗi đọc file: ${filePath}`, error);
    throw error;
  }
}

/**
 * Lớp Singleton Service
 * Đảm bảo chỉ có MỘT instance của Zalo được khởi tạo.
 */
export class ZaloSingletonService {
  private static instance: ZaloSingletonService;
  private zalo: Zalo;
  private api: API | null = null;
  private loginState: "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR" = "IDLE";
  private loginError: string | null = null;
  private isEchoBotEnabled: boolean = false;

  // Cache quyền hạn Bot
  private botId: string | null = null;
  private groupPermissionCache: Map<
    string,
    { isOwner: boolean; isAdmin: boolean }
  > = new Map();

  private constructor() {
    console.log("[Service] Đang khởi tạo ZaloSingletonService...");

    // Đảm bảo thư mục 'public' tồn tại
    fsPromise.mkdir(path.join(process.cwd(), "public")).catch((err) => {
      if (err.code !== "EEXIST") {
        console.error("[Service] Lỗi tạo thư mục public:", err);
      }
    });

    this.zalo = new Zalo({
      imageMetadataGetter,
      selfListen: true,
      logging: true,
    });
  }

  // Singleton Pattern với GlobalThis (hỗ trợ Next.js Hot Reload)
  public static getInstance(): ZaloSingletonService {
    const customGlobal = globalThis as typeof globalThis & {
      zaloServiceInstance: ZaloSingletonService;
    };

    if (!customGlobal.zaloServiceInstance) {
      console.log(
        "[Global] Đang khởi tạo ZaloSingletonService (Singleton) lần đầu...",
      );
      customGlobal.zaloServiceInstance = new ZaloSingletonService();
    }
    return customGlobal.zaloServiceInstance;
  }

  // --- AUTHENTICATION ---

  public startLoginQR(): void {
    if (this.loginState === "LOGGING_IN") return;
    if (this.loginState === "LOGGED_IN") {
      globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS);
      this.emitSessionToken();
      return;
    }

    this.loginState = "LOGGING_IN";
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

    this.zalo
      .loginQR({}, (qrDataOrPath: unknown) => {
        try {
          let base64Image: string | null = null;

          // Ép kiểu an toàn để truy cập thuộc tính
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dataObj = qrDataOrPath as any;

          // Logic trích xuất QR code an toàn
          if (
            dataObj &&
            typeof dataObj === "object" &&
            dataObj.data &&
            typeof dataObj.data.image === "string"
          ) {
            base64Image = dataObj.data.image;
          }

          if (base64Image) {
            if (!base64Image.startsWith("data:image")) {
              base64Image = `data:image/png;base64,${base64Image}`;
            }
            globalZaloEmitter.emit(ZALO_EVENTS.QR_GENERATED, base64Image);
          }
        } catch (error) {
          console.error("[Service] Lỗi xử lý QR callback:", error);
        }
      })
      .then((api) => {
        console.log("[Service] Đăng nhập QR thành công!");
        this.api = api;
        this.loginState = "LOGGED_IN";
        globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS);
        globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

        this.api.listener.start();
        this.setupListeners();
        this.emitSessionToken();
      })
      .catch((err) => {
        console.error("[Service] Lỗi đăng nhập QR:", err);
        this.loginState = "ERROR";
        this.loginError = err.message || "Lỗi không xác định";
        globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_FAILURE, this.loginError);
        globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
      });
  }

  public async startLoginWithToken(tokenString: string): Promise<void> {
    if (this.loginState === "LOGGING_IN" || this.loginState === "LOGGED_IN") {
      throw new Error("Đang đăng nhập hoặc đã đăng nhập.");
    }

    console.log("[Service] Đăng nhập bằng Token...");
    this.loginState = "LOGGING_IN";
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

    try {
      const credentials = JSON.parse(tokenString) as ZaloCredentials;
      if (!credentials.cookie || !credentials.imei || !credentials.userAgent) {
        throw new Error("Token không hợp lệ.");
      }

      this.api = await this.zalo.login(credentials);
      this.loginState = "LOGGED_IN";

      globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS);
      globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

      this.api.listener.start();
      this.setupListeners();
      this.emitSessionToken();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Lỗi Token";
      this.loginState = "ERROR";
      this.loginError = errorMsg;
      globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_FAILURE, this.loginError);
      globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
      throw new Error(errorMsg);
    }
  }

  // --- EVENT LISTENER & ECHO LOGIC ---

  private setupListeners(): void {
    if (!this.api) return;
    console.log("[Service] Listeners đã sẵn sàng.");

    this.api.listener.on("message", (msg) => {
      try {
        // 1. Phát sự kiện lên UI
        globalZaloEmitter.emit(ZALO_EVENTS.NEW_MESSAGE, msg);

        // 2. Logic Bot Nhại (Echo Bot)
        if (!this.isEchoBotEnabled || msg.isSelf) return;

        // Access an toàn vào msg.data
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { msgType, content } = msg.data;

        // Debug nhẹ loại tin nhắn để theo dõi
        console.log(`[Echo] Xử lý tin nhắn loại: ${msgType}`);

        // A. Nhại Text / Webchat
        if (msgType === "webchat" && typeof content === "string") {
          if (!content.startsWith("Bot nhại: ")) {
            // type: msg.type (0: User, 1: Group)
            this.api?.sendMessage(
              `Bot nhại: ${content}`,
              msg.threadId,
              msg.type as unknown as ThreadType,
            );
          }
        }

        // B. Nhại Sticker
        else if (msgType === "chat.sticker" && typeof content === "object") {
          // FIX TYPE: Ép kiểu 'unknown' trước khi ép sang 'ZaloStickerContent'
          const sticker = content as unknown as ZaloStickerContent;

          if (sticker.id && sticker.catId) {
            this.api?.sendSticker(
              {
                id: Number(sticker.id),
                cateId: Number(sticker.catId),
                type: sticker.type || 1,
              },
              msg.threadId,
            );
          }
        }

        // C. Nhại Ảnh (Photo) -> Gửi Link
        else if (msgType === "chat.photo" && typeof content === "object") {
          // FIX TYPE: Double cast
          const photo = content as unknown as ZaloAttachmentContent;
          if (photo.href) {
            this.api?.sendMessage(
              `Bot nhại ảnh: ${photo.href}`,
              msg.threadId,
              msg.type as unknown as ThreadType,
            );
          }
        }

        // D. Nhại Voice -> Gửi Link
        else if (msgType === "chat.voice" && typeof content === "object") {
          // FIX TYPE: Double cast
          const voice = content as unknown as ZaloVoiceContent;
          if (voice.href) {
            this.api?.sendVoice(
              { voiceUrl: voice.href, ttl: 0 },
              msg.threadId,
              msg.type as unknown as ThreadType,
            );
          }
        }

        // E. Nhại Video (DEBUG MODE KÍCH HOẠT)
        // Bỏ điều kiện 'typeof content === "object"' ở đây để bắt mọi trường hợp
        else if (msgType === "chat.video.msg") {
          // Bỏ qua kiểm tra typeof content object ở đây để bắt mọi case
          if (typeof content === "object" && content !== null) {
            const video = content as unknown as ZaloVideoContent;

            // 1. Khởi tạo giá trị mặc định (Fallback)
            let duration = 1000;
            let width = 0; // Để 0 nếu không biết, nhưng tốt nhất là lấy từ params
            let height = 0;

            // 2. Cố gắng parse JSON từ params string
            // Log raw cho thấy Zalo trả về duration, video_width, video_height trong chuỗi params
            if (video.params && typeof video.params === "string") {
              try {
                console.log("[Echo Video] Parsing params:", video.params);
                const paramsObj = JSON.parse(video.params);
                // Cập nhật nếu parse thành công và giá trị hợp lệ
                if (paramsObj.duration) duration = Number(paramsObj.duration);
                if (paramsObj.video_width)
                  width = Number(paramsObj.video_width);
                if (paramsObj.video_height)
                  height = Number(paramsObj.video_height);
              } catch (err) {
                console.error("[Echo Video] Lỗi parse params JSON:", err);
              }
            }

            // Nếu không parse được, dùng fallback 640x480 (có rủi ro crash nhưng đỡ hơn 0x0)
            if (width === 0) width = 640;
            if (height === 0) height = 480;

            console.log(
              `[Echo Video] Metadata chuẩn bị gửi: ${width}x${height}, ${duration}ms`,
            );

            // 3. Gửi Video với Metadata chuẩn
            if (video.href && video.thumb) {
              const videoOptions: SendVideoOptions = {
                videoUrl: video.href,
                thumbnailUrl: video.thumb,
                duration: duration, // Sử dụng giá trị thực
                width: width, // Sử dụng giá trị thực
                height: height, // Sử dụng giá trị thực
                msg: "Bot nhại lại video 🎥",
              };

              this.api?.sendVideo(
                videoOptions,
                msg.threadId,
                msg.type as unknown as ThreadType,
              );
            } else {
              console.warn(
                "[Echo Video] Thiếu href hoặc thumb, không thể nhại.",
              );
            }
          }
        }
        // F. Link
        else if (
          msgType === "chat.recommended" &&
          typeof content === "object"
        ) {
          // FIX TYPE: Double cast
          const link = content as unknown as ZaloAttachmentContent;
          if (link.href) {
            this.api?.sendMessage(
              `Bot nhại link: ${link.href}`,
              msg.threadId,
              msg.type as unknown as ThreadType,
            );
          }
        }
      } catch (e) {
        console.error("[Service] Message listener error:", e);
      }
    });
  }

  // --- HELPER METHODS ---

  public setEchoBotState(isEnabled: boolean) {
    this.isEchoBotEnabled = isEnabled;
    console.log(`[Service] Bot Nhại: ${isEnabled ? "BẬT" : "TẮT"}`);
  }

  public logout(): void {
    // Reset mềm, không cần async
    this.api = null;
    this.loginState = "IDLE";
    this.loginError = null;
    this.isEchoBotEnabled = false;
    this.botId = null;
    this.groupPermissionCache.clear();
    console.log("[Service] Đã đăng xuất (reset trạng thái).");
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
  }

  public getStatus() {
    return { loginState: this.loginState, error: this.loginError };
  }

  private checkApi(): API {
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      throw new Error("Chưa đăng nhập (API instance is null).");
    }
    return this.api;
  }

  private emitSessionToken() {
    if (this.api) {
      try {
        const ctx = this.api.getContext();
        const token = JSON.stringify({
          cookie: ctx.cookie,
          imei: ctx.imei,
          userAgent: ctx.userAgent,
        });
        globalZaloEmitter.emit(ZALO_EVENTS.SESSION_GENERATED, token);
      } catch (e) {
        console.error("[Service] Lỗi emit token:", e);
      }
    }
  }

  // --- PUBLIC API METHODS (Proxy) ---

  public async getSessionToken(): Promise<string> {
    const api = this.checkApi();
    const ctx = api.getContext();
    return JSON.stringify({
      cookie: ctx.cookie,
      imei: ctx.imei,
      userAgent: ctx.userAgent,
    });
  }

  public async sendMessage(content: string, threadId: string, type: 0 | 1) {
    const api = this.checkApi();
    // type 0/1 tương thích với ThreadType.User/Group
    await api.sendMessage(content, threadId, type as unknown as ThreadType);
    return { success: true };
  }

  public async getAccountInfo(): Promise<AccountInfo> {
    const api = this.checkApi();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: any = await api.fetchAccountInfo();
    const profile = info.profile;
    return {
      userId: profile.userId,
      displayName: profile.displayName || profile.zaloName,
      avatar: profile.avatar,
    };
  }

  public async getThreads(): Promise<ThreadInfo[]> {
    const api = this.checkApi();
    const threads: ThreadInfo[] = [];

    // 1. Lấy bạn bè
    const friends = await api.getAllFriends();
    friends.forEach((f) =>
      threads.push({
        id: f.userId,
        name: f.displayName || f.zaloName,
        avatar: f.avatar,
        type: 0,
      }),
    );

    // 2. Lấy nhóm (Chunking để tránh lỗi quá tải)
    const groups = await api.getAllGroups();
    const gIds = Object.keys(groups.gridVerMap);
    if (gIds.length > 0) {
      const CHUNK_SIZE = 20;
      for (let i = 0; i < gIds.length; i += CHUNK_SIZE) {
        const chunk = gIds.slice(i, i + CHUNK_SIZE);
        const gInfos = await api.getGroupInfo(chunk);

        // FIX ESLINT: Sử dụng unknown thay vì any cho tham số callback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.entries((gInfos as any).gridInfoMap).forEach(
          ([id, g]: [string, unknown]) => {
            // Ép kiểu cục bộ an toàn
            const group = g as { name: string; avt: string };
            threads.push({
              id,
              name: group.name,
              avatar: group.avt,
              type: 1,
            });
          },
        );
        // Delay nhẹ
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    return threads;
  }

  // --- Group & Friend Actions (Proxy) ---

  private async _getBotPermissions(
    groupId: string,
  ): Promise<{ isOwner: boolean; isAdmin: boolean }> {
    const api = this.checkApi();
    if (!this.botId) this.botId = api.getOwnId();

    if (this.groupPermissionCache.has(groupId)) {
      return this.groupPermissionCache.get(groupId)!;
    }

    const gInfo = await api.getGroupInfo(groupId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gData = (gInfo as any).gridInfoMap[groupId];

    if (!gData) throw new Error("Group info not found");

    const isOwner = gData.creatorId === this.botId;
    const isAdmin =
      Array.isArray(gData.adminIds) && gData.adminIds.includes(this.botId);

    this.groupPermissionCache.set(groupId, { isOwner, isAdmin });
    return { isOwner, isAdmin };
  }

  public async findUser(phone: string) {
    return this.checkApi().findUser(phone);
  }
  public async sendFriendRequest(msg: string, uid: string) {
    return this.checkApi().sendFriendRequest(msg, uid);
  }
  public async acceptFriendRequest(uid: string) {
    return this.checkApi().acceptFriendRequest(uid);
  }
  public async undoFriendRequest(uid: string) {
    return this.checkApi().undoFriendRequest(uid);
  }
  public async getSentFriendRequest() {
    return this.checkApi().getSentFriendRequest();
  }
  public async getFriendRecommendations() {
    return this.checkApi().getFriendRecommendations();
  }
  public async removeFriend(uid: string) {
    return this.checkApi().removeFriend(uid);
  }
  public async getAllFriends() {
    return this.checkApi().getAllFriends();
  }
  public async blockUser(uid: string) {
    return this.checkApi().blockUser(uid);
  }
  public async unblockUser(uid: string) {
    return this.checkApi().unblockUser(uid);
  }

  public async createGroup(opts: CreateGroupOptions) {
    return this.checkApi().createGroup(opts);
  }
  public async leaveGroup(gid: string, silent?: boolean) {
    return this.checkApi().leaveGroup(gid, silent);
  }

  public async disperseGroup(gid: string) {
    const p = await this._getBotPermissions(gid);
    if (!p.isOwner) throw new Error("Permission Denied");
    return this.checkApi().disperseGroup(gid);
  }

  public async addUserToGroup(mids: string[], gid: string) {
    const p = await this._getBotPermissions(gid);
    if (!p.isAdmin && !p.isOwner) throw new Error("Permission Denied");
    return this.checkApi().addUserToGroup(mids, gid);
  }

  public async removeUserFromGroup(mids: string[], gid: string) {
    const p = await this._getBotPermissions(gid);
    if (!p.isAdmin && !p.isOwner) throw new Error("Permission Denied");
    return this.checkApi().removeUserFromGroup(mids, gid);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async getGroupInviteBoxList(p?: any) {
    return this.checkApi().getGroupInviteBoxList(p);
  }

  public async getPendingGroupMembers(gid: string) {
    const p = await this._getBotPermissions(gid);
    if (!p.isAdmin && !p.isOwner) throw new Error("Permission Denied");
    return this.checkApi().getPendingGroupMembers(gid);
  }

  public async reviewPendingMemberRequest(
    payload: ReviewPendingMemberRequestPayload,
    gid: string,
  ) {
    const p = await this._getBotPermissions(gid);
    if (!p.isAdmin && !p.isOwner) throw new Error("Permission Denied");
    return this.checkApi().reviewPendingMemberRequest(payload, gid);
  }

  public async updateGroupSettings(
    opts: UpdateGroupSettingsOptions,
    gid: string,
  ) {
    const p = await this._getBotPermissions(gid);
    if (!p.isAdmin && !p.isOwner) throw new Error("Permission Denied");
    return this.checkApi().updateGroupSettings(opts, gid);
  }

  public async getGroupLinkDetail(gid: string) {
    return this.checkApi().getGroupLinkDetail(gid);
  }

  public async enableGroupLink(gid: string) {
    const p = await this._getBotPermissions(gid);
    if (!p.isAdmin && !p.isOwner) throw new Error("Permission Denied");
    return this.checkApi().enableGroupLink(gid);
  }

  public async disableGroupLink(gid: string) {
    const p = await this._getBotPermissions(gid);
    if (!p.isAdmin && !p.isOwner) throw new Error("Permission Denied");
    return this.checkApi().disableGroupLink(gid);
  }

  public async joinGroupInviteBox(gid: string) {
    return this.checkApi().joinGroupInviteBox(gid);
  }
  public async deleteGroupInviteBox(gids: string[], block?: boolean) {
    return this.checkApi().deleteGroupInviteBox(gids, block);
  }
  public async getGroupLinkInfo(link: string) {
    return this.checkApi().getGroupLinkInfo({ link });
  }
  public async getGroupInfo(gids: string[]) {
    return this.checkApi().getGroupInfo(gids);
  }
  public async getGroupMembersInfo(mids: string[]) {
    return this.checkApi().getGroupMembersInfo(mids);
  }

  // API Gửi Media Mới
  public async sendVoice(
    opts: SendVoiceOptions,
    tid: string,
    type: ThreadType,
  ) {
    return this.checkApi().sendVoice(opts, tid, type);
  }
  public async sendVideo(
    opts: SendVideoOptions,
    tid: string,
    type: ThreadType,
  ) {
    return this.checkApi().sendVideo(opts, tid, type);
  }
  public async sendLink(opts: SendLinkOptions, tid: string, type: ThreadType) {
    return this.checkApi().sendLink(opts, tid, type);
  }
}
