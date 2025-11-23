/**
 * lib/runtime-service.ts
 * Orchestrator điều phối luồng xử lý tin nhắn 6 bước.
 */

import {
  Zalo,
  API,
  CreateGroupOptions,
  ReviewPendingMemberRequestPayload,
  UpdateGroupSettingsOptions,
  MessageContent,
} from "zca-js";
import { globalZaloEmitter, ZALO_EVENTS } from "./event-emitter";
import { MessageParser } from "@/lib/core/pipelines/message-parser";
import { EchoWorker } from "@/lib/core/pipelines/echo-worker";
import { SenderService } from "@/lib/core/services/sender-service";
import {
  RawZaloMessage,
  LoginState,
  GroupInviteBoxParams,
  QRCallbackData,
  SendVoiceOptions,
  SendVideoOptions,
  SendLinkOptions,
  StandardVideo,
  AccountInfo,
  ThreadInfo,
  ZaloAPIUser,
} from "@/lib/types/zalo.types";
import { promises as fsPromise } from "fs";
import path from "path";

// Mock Storage
const MockStorage = {
  save: async (msg: unknown) => {
    /* console.log("Saved", msg); */
  },
};

export class ZaloSingletonService {
  private static instance: ZaloSingletonService;
  private zalo: Zalo;
  private api: API | null = null;

  // Modules
  private parser: MessageParser;
  private echoWorker: EchoWorker;
  private senderService: SenderService;

  private isEchoBotEnabled: boolean = false;
  private loginState: LoginState = "IDLE";
  private loginError: string | null = null;

  private constructor() {
    this.parser = new MessageParser();
    this.echoWorker = new EchoWorker();
    this.senderService = SenderService.getInstance();

    this.zalo = new Zalo({ selfListen: true, logging: true });
    this.ensurePublicDir();
  }

  public static getInstance(): ZaloSingletonService {
    const customGlobal = globalThis as typeof globalThis & {
      zaloServiceInstance: ZaloSingletonService;
    };
    if (!customGlobal.zaloServiceInstance) {
      customGlobal.zaloServiceInstance = new ZaloSingletonService();
    }
    return customGlobal.zaloServiceInstance;
  }

  private async ensurePublicDir() {
    try {
      await fsPromise.mkdir(path.join(process.cwd(), "public"));
    } catch {}
  }

  public getStatus() {
    return { loginState: this.loginState, error: this.loginError };
  }
  public setEchoBotState(enabled: boolean) {
    this.isEchoBotEnabled = enabled;
  }

  // --- AUTH ---
  public startLoginQR() {
    if (this.loginState === "LOGGING_IN") return;
    this.loginState = "LOGGING_IN";
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.zalo
      .loginQR({}, (qr: unknown) => {
        type QRObject = { data?: { image?: string } };

        const qrData = qr as QRCallbackData;
        let base64 = "";

        if (typeof qrData === "string") {
          base64 = qrData;
        } else if (typeof qrData === "object" && qrData !== null) {
          // Ép kiểu an toàn
          const qrObj = qrData as QRObject;
          if (qrObj.data && qrObj.data.image) {
            base64 = qrObj.data.image;
          }
        }

        if (base64 && !base64.startsWith("data:image")) {
          base64 = `data:image/png;base64,${base64}`;
        }
        if (base64) {
          globalZaloEmitter.emit(ZALO_EVENTS.QR_GENERATED, base64);
        }
      })
      .then((api) => this.onLoginSuccess(api))
      .catch((e) => this.onLoginError(e));
  }
  public async startLoginWithToken(token: string) {
    try {
      this.loginState = "LOGGING_IN";
      globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
      const api = await this.zalo.login(JSON.parse(token));
      this.onLoginSuccess(api);
    } catch (e) {
      this.onLoginError(e);
    }
  }

  private onLoginSuccess(api: API) {
    this.api = api;
    this.senderService.setApi(api);
    this.loginState = "LOGGED_IN";
    globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS);
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

    this.api.listener.start();
    this.setupUnifiedPipeline();
  }

  private onLoginError(err: unknown) {
    this.loginState = "ERROR";
    this.loginError = err instanceof Error ? err.message : "Unknown";
    globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_FAILURE, this.loginError);
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
  }

  // --- UNIFIED PIPELINE ---
  private setupUnifiedPipeline() {
    if (!this.api) return;

    this.api.listener.on("message", async (rawMsg: unknown) => {
      try {
        const rawMessage = rawMsg as RawZaloMessage;

        // [DEBUG] Log raw message nhận được từ ZCA listener
        // console.log("[Service] Listener Raw Message:", JSON.stringify(rawMessage.data.content));

        const stdMsg = this.parser.parse(rawMessage);
        if (!stdMsg) return;

        // 3. Storage (Mock)
        // await MockStorage.save(stdMsg);

        globalZaloEmitter.emit(ZALO_EVENTS.NEW_MESSAGE, rawMsg);

        if (this.isEchoBotEnabled && !stdMsg.isSelf) {
          await this.echoWorker.process(stdMsg);
        }
      } catch (error) {
        console.error("Pipeline Error:", error);
      }
    });
  }

  // --- PROXIES ---
  private checkApi(): API {
    if (!this.api) throw new Error("API chưa sẵn sàng");
    return this.api;
  }

  // [FIX] Cập nhật signature để chấp nhận MessageContent
  public async sendMessage(
    content: string | MessageContent,
    threadId: string,
    type: number,
  ) {
    if (typeof content === "string") {
      return this.senderService.sendText(content, threadId, type === 1);
    } else {
      return this.checkApi().sendMessage(content, threadId, type === 1 ? 1 : 0);
    }
  }

  public async logout() {
    this.api = null;
    this.loginState = "IDLE";
  }
  public async getSessionToken() {
    if (!this.api) throw new Error("No API");
    const ctx = this.api.getContext();
    return JSON.stringify({
      cookie: ctx.cookie,
      imei: ctx.imei,
      userAgent: ctx.userAgent,
    });
  }

  // [FIX] Map dữ liệu User -> AccountInfo
  public async getAccountInfo(): Promise<AccountInfo | null> {
    if (!this.api) {
      return null;
    }

    try {
      const response = await this.api.fetchAccountInfo();

      if (!response) {
        return null;
      }

      // Xử lý cấu trúc lồng nhau { profile: ... } hoặc trực tiếp
      type APIResponse = { profile?: ZaloAPIUser } & Partial<ZaloAPIUser>;

      const data = response as unknown as APIResponse;
      let userData: ZaloAPIUser | undefined;

      if (data.profile) {
        userData = data.profile;
      } else if (data.userId) {
        userData = data as ZaloAPIUser;
      }

      if (!userData) {
        return null;
      }

      // Fallback logic
      const displayName = userData.displayName || userData.zaloName || "Bot";
      const userId = userData.userId || "";
      const avatar = userData.avatar || "";

      return {
        userId,
        displayName,
        avatar,
      };
    } catch (error) {
      console.error("[Service] getAccountInfo Error:", error);
      return null;
    }
  }

  // [FIX] Map dữ liệu User[] -> ThreadInfo[]
  public async getThreads(): Promise<ThreadInfo[]> {
    if (!this.api) return [];
    const friends = await this.api.getAllFriends();
    return friends.map((u) => ({
      id: u.userId,
      name: u.displayName || u.zaloName || "Unknown",
      avatar: u.avatar,
      type: 0,
    }));
  }

  // Các hàm proxy khác giữ nguyên
  public async findUser(phone: string) {
    return this.checkApi().findUser(phone);
  }
  public async getAllFriends() {
    return this.checkApi().getAllFriends();
  }
  public async createGroup(opts: CreateGroupOptions) {
    return this.checkApi().createGroup(opts);
  }
  public async getGroupInfo(ids: string[]) {
    return this.checkApi().getGroupInfo(ids);
  }
  public async getGroupMembersInfo(ids: string[]) {
    return this.checkApi().getGroupMembersInfo(ids);
  }
  public async leaveGroup(id: string, s?: boolean) {
    return this.checkApi().leaveGroup(id, s);
  }
  public async disperseGroup(id: string) {
    return this.checkApi().disperseGroup(id);
  }
  public async addUserToGroup(m: string[], id: string) {
    return this.checkApi().addUserToGroup(m, id);
  }
  public async removeUserFromGroup(m: string[], id: string) {
    return this.checkApi().removeUserFromGroup(m, id);
  }

  // FIX: Thay 'any' bằng 'GroupInviteBoxParams'
  public async getGroupInviteBoxList(p?: GroupInviteBoxParams) {
    return this.checkApi().getGroupInviteBoxList(p);
  }

  public async getPendingGroupMembers(id: string) {
    return this.checkApi().getPendingGroupMembers(id);
  }
  public async reviewPendingMemberRequest(
    p: ReviewPendingMemberRequestPayload,
    id: string,
  ) {
    return this.checkApi().reviewPendingMemberRequest(p, id);
  }
  public async updateGroupSettings(o: UpdateGroupSettingsOptions, id: string) {
    return this.checkApi().updateGroupSettings(o, id);
  }
  public async getGroupLinkDetail(id: string) {
    return this.checkApi().getGroupLinkDetail(id);
  }
  public async enableGroupLink(id: string) {
    return this.api!.enableGroupLink(id);
  }
  public async disableGroupLink(id: string) {
    return this.api!.disableGroupLink(id);
  }
  public async joinGroupInviteBox(id: string) {
    return this.api!.joinGroupInviteBox(id);
  }
  public async deleteGroupInviteBox(ids: string[], b?: boolean) {
    return this.api!.deleteGroupInviteBox(ids, b);
  }
  public async getGroupLinkInfo(l: string) {
    return this.api!.getGroupLinkInfo({ link: l });
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
  public async blockUser(uid: string) {
    return this.checkApi().blockUser(uid);
  }
  public async unblockUser(uid: string) {
    return this.checkApi().unblockUser(uid);
  }

  // Proxy Media (Optional, UI gọi qua Action -> Service)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async sendVoice(opts: SendVoiceOptions, tid: string, type: number) {
    return this.senderService.sendVoice(opts.voiceUrl, tid, type === 1);
  }
  public async sendVideo(opts: SendVideoOptions, tid: string, type: number) {
    const standardVideo: StandardVideo = {
      url: opts.videoUrl,
      thumbnail: opts.thumbnailUrl,
      duration: opts.duration,
      width: opts.width,
      height: opts.height,
    };
    return this.senderService.sendVideo(standardVideo, tid, type === 1);
  }
  public async sendLink(opts: SendLinkOptions, tid: string, type: number) {
    return this.api!.sendLink(opts, tid, type === 1 ? 1 : 0);
  }
}
