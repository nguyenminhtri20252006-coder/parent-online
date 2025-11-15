/**
 * lib/runtime-service.ts
 *
 * Lớp Dịch vụ Singleton (Lớp 3) - "Bộ não" 24/7.
 * Quản lý khởi tạo, trạng thái đăng nhập và listener của `zca-js`.
 * CẬP NHẬT (GĐ 1.1): Tách biệt Types
 * CẬP NHẬT (GĐ 2): Thêm các phương thức API nghiệp vụ mới (Bạn bè, Nhóm)
 * CẬP NHẬT (GĐ 3 Hotfix): Sửa tên type và thêm import
 */

// Import các thư viện Node.js cần thiết
// CẬP NHẬT: Chỉ import fsPromise vì không dùng fs.readFileSync nữa
import { promises as fsPromise } from "fs";
import path from "path";

// Import các thư viện bên ngoài
import {
  Zalo,
  API,
  User, // Giữ lại cho getThreads
  GetAllGroupsResponse,
  GroupInfoResponse,
  // Thêm các kiểu dữ liệu API cần thiết
  FindUserResponse,
  GetFriendRecommendationsResponse, // Sửa lỗi (GĐ 3 Hotfix)
  GetSentFriendRequestResponse, // Thêm (GĐ 3.6 Hotfix)
  CreateGroupOptions,
  AttachmentSource,
  ReviewPendingMemberRequestPayload,
  UpdateGroupSettingsOptions,
  // THÊM MỚI (GĐ 3.8)
  GetGroupLinkDetailResponse,
  GetPendingGroupMembersResponse,
  ReviewPendingMemberRequestStatus,
  // THÊM MỚI (GĐ 3.10)
  GroupInfo,
  GetGroupMembersInfoResponse,
} from "zca-js";
// THÊM MỚI: Import CookieJar từ thư viện tough-cookie (Sửa lỗi ts(2724))
import sharp from "sharp";

// Import Emitter toàn cục
import { globalZaloEmitter, ZALO_EVENTS } from "./event-emitter";

// SỬA ĐỔI: Nhập (import) tất cả types từ tệp SSOT
import {
  type AccountInfo,
  type ThreadInfo,
  type ZaloCredentials,
  type ZaloUser,
} from "@/lib/types/zalo.types";

/**
 * Hàm trợ giúp lấy metadata ảnh (theo yêu cầu của zca-js).
 * Cần thiết nếu chúng ta muốn gửi ảnh/GIF từ đường dẫn tệp.
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
  // 1. Biến static để giữ instance duy nhất
  // (Sửa lỗi Singleton: Tạm thời giữ lại, nhưng getInstance sẽ dùng globalThis)
  private static instance: ZaloSingletonService;

  // 2. Các thuộc tính trạng thái
  private zalo: Zalo;
  private api: API | null = null;
  private loginState: "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR" = "IDLE";
  private loginError: string | null = null;
  private isEchoBotEnabled: boolean = false; // Mặc định TẮT Bot Nhại

  // 3. Constructor (private)
  private constructor() {
    console.log("[Service] Đang khởi tạo ZaloSingletonService lần đầu...");

    // Đảm bảo thư mục 'public' tồn tại
    fsPromise.mkdir(path.join(process.cwd(), "public")).catch((err) => {
      // Bỏ qua lỗi nếu thư mục đã tồn tại
      if (err.code !== "EEXIST") {
        console.error("[Service] Không thể tạo thư mục public:", err);
      }
    });

    this.zalo = new Zalo({
      imageMetadataGetter,
      selfListen: false,
      logging: true,
    });
  }

  // 4. Phương thức static để lấy instance (Singleton pattern)
  public static getInstance(): ZaloSingletonService {
    // --- SỬA LỖI KIẾN TRÚC: Đảm bảo Singleton trong môi trường Next.js ---
    // 1. Mở rộng 'globalThis'
    const customGlobal = globalThis as typeof globalThis & {
      zaloServiceInstance: ZaloSingletonService;
    };

    // 2. Khởi tạo nếu chưa tồn tại
    if (!customGlobal.zaloServiceInstance) {
      console.log(
        "[Global] Đang khởi tạo ZaloSingletonService (Singleton) lần đầu...",
      );
      customGlobal.zaloServiceInstance = new ZaloSingletonService();
    }
    return customGlobal.zaloServiceInstance;
  }

  // 5. Phương thức bắt đầu quá trình đăng nhập QR
  public startLoginQR(): void {
    if (this.loginState === "LOGGING_IN") {
      console.warn("[Service] Quá trình đăng nhập đã đang chạy.");
      return;
    }

    if (this.loginState === "LOGGED_IN") {
      console.warn("[Service] Đã đăng nhập rồi.");
      globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS);
      this.emitSessionToken();
      return;
    }

    console.log("[Service] Bắt đầu quá trình đăng nhập QR...");
    this.loginState = "LOGGING_IN";
    this.loginError = null;
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

    // Chạy bất đồng bộ
    // SỬA LỖI: Không dùng qrPath, thay bằng callback (qrData)
    this.zalo
      .loginQR({}, (qrDataOrPath: unknown) => {
        try {
          // KẾ HOẠCH C: Xử lý cả hai trường hợp
          let base64Image: string | null = null;

          // Trường hợp 3 (Luồng 3 - Log mới): Thư viện trả về object (data.image)
          if (
            qrDataOrPath &&
            typeof qrDataOrPath === "object" &&
            "data" in qrDataOrPath &&
            typeof qrDataOrPath.data === "object" &&
            qrDataOrPath.data &&
            "image" in qrDataOrPath.data &&
            typeof qrDataOrPath.data.image === "string"
          ) {
            base64Image = qrDataOrPath.data.image;
          }

          if (base64Image) {
            if (!base64Image.startsWith("data:image")) {
              base64Image = `data:image/png;base64,${base64Image}`;
            }

            globalZaloEmitter.emit(ZALO_EVENTS.QR_GENERATED, base64Image);
          } else {
            console.warn(
              "[Service WARN] Nhận được sự kiện callback không phải QR image (ví dụ: expired, scanned). Bỏ qua.",
              qrDataOrPath,
            );
            return;
          }
        } catch (error: unknown) {
          console.error("[Service] Lỗi nghiêm trọng khi xử lý QR:", error);
          const errorMsg =
            error instanceof Error ? error.message : "Lỗi không xác định";
          this.loginState = "ERROR";
          this.loginError = `Không thể xử lý dữ liệu QR: ${errorMsg}`;
          globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_FAILURE, this.loginError);
          globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
        }
      })
      .then((api) => {
        // Promise này resolve khi người dùng quét QR thành công
        console.log("[Service] Đăng nhập QR thành công!");
        this.api = api;
        this.loginState = "LOGGED_IN";

        globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS);
        globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

        // Khởi động listener
        this.api.listener.start();
        this.setupListeners();

        // THÊM MỚI: Phát (emit) session token cho UI
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

  /**
   * THÊM MỚI: Phương thức đăng nhập bằng Session Token
   * @param tokenString Chuỗi JSON chứa credentials
   */
  public async startLoginWithToken(tokenString: string): Promise<void> {
    if (this.loginState === "LOGGING_IN") {
      throw new Error("Quá trình đăng nhập đã đang chạy.");
    }
    if (this.loginState === "LOGGED_IN") {
      throw new Error("Đã đăng nhập rồi.");
    }

    console.log("[Service] Bắt đầu quá trình đăng nhập bằng Token...");
    this.loginState = "LOGGING_IN";
    this.loginError = null;
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

    try {
      // 1. Parse chuỗi JSON
      const credentials = JSON.parse(tokenString) as ZaloCredentials;

      // 2. Xác thực cấu trúc cơ bản
      if (!credentials.cookie || !credentials.imei || !credentials.userAgent) {
        throw new Error(
          "Token không hợp lệ (thiếu cookie, imei, hoặc userAgent).",
        );
      }

      console.log("[Service] Đang gọi zalo.login() với token...");
      // 3. Gọi API A (login)
      this.api = await this.zalo.login(credentials);

      // 4. Thành công
      console.log("[Service] Đăng nhập bằng Token thành công!");
      this.loginState = "LOGGED_IN";

      globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS);
      globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

      // Khởi động listener
      this.api.listener.start();
      this.setupListeners();

      // 5. Phát (emit) lại session token (để đồng bộ UI)
      this.emitSessionToken();
    } catch (error: unknown) {
      console.error("[Service] Lỗi đăng nhập bằng Token:", error);
      this.loginState = "ERROR";
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Token không hợp lệ hoặc đã hết hạn";
      this.loginError = errorMsg;
      globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_FAILURE, this.loginError);
      globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
      // Ném lỗi về cho Action
      throw new Error(errorMsg);
    }
  }

  // 6. Thiết lập các listener nền
  private setupListeners(): void {
    if (!this.api) return;

    console.log("[Service] Đã thiết lập các listeners.");

    // Lắng nghe tin nhắn mới
    this.api.listener.on("message", (msg) => {
      try {
        console.log(
          `[Service] Tin nhắn mới từ ${msg.threadId}:`,
          typeof msg.data.content === "string"
            ? msg.data.content
            : "(Nội dung không phải text)",
        );

        // Phát sự kiện lên Emitter để SSE Route bắt được
        globalZaloEmitter.emit(ZALO_EVENTS.NEW_MESSAGE, msg);

        // --- CẬP NHẬT LOGIC: Bot Nhại (Echo Bot) ---
        // Chỉ nhại lại nếu công tắc (biến) isEchoBotEnabled là true
        if (
          this.isEchoBotEnabled &&
          typeof msg.data.content === "string" &&
          !msg.isSelf
        ) {
          const content = msg.data.content;
          // Chỉ nhại lại nếu không phải là bot tự nhại
          if (!content.startsWith("Bot nhại: ")) {
            console.log(
              `[Service] Bot Nhại ĐANG BẬT. Đang nhại lại tin nhắn tới ${msg.threadId}`,
            );
            this.api
              ?.sendMessage(`Bot nhại: ${content}`, msg.threadId, msg.type)
              .catch(console.error);
          }
        } else if (!this.isEchoBotEnabled && !msg.isSelf) {
          console.log("[Service] Bot Nhại ĐANG TẮT. Bỏ qua tin nhắn đến.");
        }
      } catch (e) {
        console.error('[Service] Lỗi xử lý listener "message":', e);
      }
    });
  }

  /**
   * THÊM MỚI: Hàm trợ giúp nội bộ để lấy và phát session token
   */
  private emitSessionToken(): void {
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      console.warn("[Service] Không thể emit session: chưa đăng nhập.");
      return;
    }
    try {
      // 1. Gọi API C (getContext)
      const context = this.api.getContext();
      // 2. Trích xuất
      const session: ZaloCredentials = {
        cookie: context.cookie,
        imei: context.imei,
        userAgent: context.userAgent,
      };
      // 3. Tuần tự hóa
      const tokenString = JSON.stringify(session);
      // 4. Phát sự kiện
      console.log("[Service] Đang phát sự kiện SESSION_GENERATED cho UI.");
      globalZaloEmitter.emit(ZALO_EVENTS.SESSION_GENERATED, tokenString);
    } catch (e) {
      console.error("[Service] Lỗi khi emit session token:", e);
    }
  }

  /**
   * THÊM MỚI: Phương thức nghiệp vụ: Lấy Session Token (để copy)
   */
  public async getSessionToken(): Promise<string> {
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      console.warn("[Service] getSessionToken thất bại: Chưa đăng nhập.");
      throw new Error("Chưa đăng nhập");
    }
    try {
      const context = this.api.getContext();
      const session = {
        cookie: context.cookie,
        imei: context.imei,
        userAgent: context.userAgent,
      };
      return JSON.stringify(session);
    } catch (error) {
      console.error("[Service] Lỗi getSessionToken:", error);
      throw error;
    }
  }

  // 7. Phương thức nghiệp vụ: Gửi tin nhắn
  public async sendMessage(
    content: string,
    threadId: string,
    type: 0 | 1,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      console.warn("[Service] sendMessage thất bại: Chưa đăng nhập.");
      return { success: false, error: "Chưa đăng nhập" };
    }

    try {
      console.log(
        `[Service] Đang gửi tin nhắn "${content}" tới ${threadId} (Type: ${
          type === 0 ? "User" : "Group"
        })`,
      );

      // XÓA: Logic cũ `const threadType = threadId.includes("@g.us") ? 1 : 0;`
      // Sử dụng 'type' được truyền vào trực tiếp
      await this.api.sendMessage(content, threadId, type);
      return { success: true };
    } catch (error: unknown) {
      console.error("[Service] Lỗi gửi tin nhắn:", error);

      // SỬA LỖI: Kiểm tra 'error' là 'unknown'
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: "Lỗi không xác định khi gửi tin" };
    }
  }

  // 8. Phương thức nghiệp vụ: Lấy trạng thái
  public getStatus() {
    return {
      loginState: this.loginState,
      error: this.loginError,
    };
  }
  /**
   * [Step 1] Lấy thông tin tài khoản (Bot) đang đăng nhập
   */
  public async getAccountInfo(): Promise<AccountInfo> {
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      console.warn("[Service] getAccountInfo thất bại: Chưa đăng nhập.");
      throw new Error("Chưa đăng nhập");
    }
    console.log("[Service] Đang tải thông tin tài khoản (fetchAccountInfo)...");
    try {
      // SỬA ĐỔI: Gán kiểu 'any' để chấp nhận mọi cấu trúc trả về từ API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info: any = await this.api.fetchAccountInfo();

      // SỬA ĐỔI: Truy cập vào đối tượng 'profile' lồng bên trong
      const profile: ZaloUser = info.profile;

      // Thêm kiểm tra an toàn (KIỂM TRA profile.userId)
      if (!profile || !profile.userId) {
        console.warn(
          "[Service-WARN] fetchAccountInfo() trả về 'profile' không hợp lệ hoặc rỗng.",
          info,
        );
        // Trả về một lỗi rõ ràng thay vì object rỗng
        throw new Error(
          "Không thể lấy thông tin tài khoản từ Zalo API (thiếu 'profile').",
        );
      }

      return {
        userId: profile.userId,
        displayName: profile.displayName || profile.zaloName,
        avatar: profile.avatar,
      };
    } catch (error) {
      console.error("[Service] Lỗi getAccountInfo:", error);
      // SỬA ĐỔI: Ném lỗi rõ ràng hơn
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Lỗi không xác định khi lấy thông tin tài khoản.");
    }
  }

  /**
   * [Steps 2 & 3] Lấy và hợp nhất danh sách hội thoại (Bạn bè & Nhóm)
   */
  public async getThreads(): Promise<ThreadInfo[]> {
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      console.warn("[Service] getThreads thất bại: Chưa đăng nhập.");
      throw new Error("Chưa đăng nhập");
    }
    console.log("[Service] Đang tải danh sách hội thoại (getThreads)...");

    const mergedThreads: ThreadInfo[] = [];

    try {
      // --- Step 2: Tải danh sách Bạn bè ---
      console.log("[Service] Đang tải danh sách bạn bè (getAllFriends)...");
      const friends: User[] = await this.api.getAllFriends();
      console.log(`[Service] Đã tải ${friends.length} bạn bè.`);

      friends.forEach((friend) => {
        mergedThreads.push({
          id: friend.userId,
          name: friend.displayName || friend.zaloName,
          avatar: friend.avatar,
          type: 0, // 0 = User
        });
      });
      console.log(`[Service] Đã tải ${friends.length} bạn bè.`);

      // --- Step 3: Tải danh sách Nhóm (Luồng 2 bước) ---
      console.log("[Service] Đang tải danh sách nhóm (getAllGroups)...");
      // Step 3.1: Lấy ID Nhóm
      const groupsResponse: GetAllGroupsResponse =
        await this.api.getAllGroups();
      const groupIds = Object.keys(groupsResponse.gridVerMap);
      console.log(`[Service] Tìm thấy ${groupIds.length} ID nhóm.`);

      if (groupIds.length > 0) {
        const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
        const CHUNK_SIZE = 20; // Xử lý 20 nhóm một lúc
        const totalChunks = Math.ceil(groupIds.length / CHUNK_SIZE);

        console.log(
          `[Service Debug] Bắt đầu xử lý ${groupIds.length} ID nhóm thành ${totalChunks} lô (mỗi lô tối đa ${CHUNK_SIZE} ID).`,
        );

        // Lặp qua các lô
        for (let i = 0; i < groupIds.length; i += CHUNK_SIZE) {
          const chunk = groupIds.slice(i, i + CHUNK_SIZE);
          console.log(
            `[Service Debug] Đang xử lý lô ${
              i / CHUNK_SIZE + 1
            }/${totalChunks} (IDs: ${chunk.join(", ")})`,
          );

          // Step 3.2: Lấy thông tin chi tiết nhóm (theo lô)
          console.log(
            "[Service] Đang tải thông tin chi tiết nhóm (getGroupInfo)...",
          );
          const groupInfos: GroupInfoResponse = await this.api.getGroupInfo(
            chunk,
          );

          // Lặp qua Map kết quả
          // SỬA LỖI TS(2349): gridInfoMap là Object, không phải Map
          Object.entries(groupInfos.gridInfoMap).forEach(([groupId, group]) => {
            mergedThreads.push({
              id: groupId,
              name: group.name,
              avatar: group.avt,
              type: 1,
            });
          });

          await delay(200);
        }
        console.log("[Service Debug] Hoàn tất xử lý tất cả các lô.");
        // --- Kết thúc Sửa lỗi Batching ---
      }

      console.log(
        `[Service] Tải hoàn tất. Tổng số hội thoại: ${mergedThreads.length}`,
      );
      return mergedThreads;
    } catch (error) {
      console.error("[Service] Lỗi getThreads:", error);
      throw error;
    }
  }

  // --- THÊM MỚI: Phương thức Bật/Tắt Bot Nhại ---
  /**
   * Cập nhật trạng thái Bật/Tắt của Bot Nhại
   * @param isEnabled Trạng thái mới (true = Bật)
   */
  public setEchoBotState(isEnabled: boolean) {
    this.isEchoBotEnabled = isEnabled;
    console.log(
      `[Service] Trạng thái Bot Nhại đã được cập nhật thành: ${
        isEnabled ? "BẬT" : "TẮT"
      }`,
    );
  }
  /**
   * THÊM MỚI: Phương thức Đăng xuất
   * CẬP NHẬT: Mô phỏng logout (thay vì gọi API) bằng cách
   * hủy instance 'api' và reset trạng thái (theo yêu cầu).
   */
  public logout(): void {
    // SỬA ĐỔI: Bỏ async, vì chúng ta không await bất cứ thứ gì.
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      console.warn("[Service] Yêu cầu logout khi chưa đăng nhập.");
      // Vẫn reset về IDLE để đảm bảo đồng bộ
      this.loginState = "IDLE";
      this.api = null;
      globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
      return;
    }

    console.log("[Service] Bắt đầu quá trình đăng xuất (mô phỏng)...");

    // 3. Reset trạng thái service về ban đầu
    this.api = null;
    this.loginState = "IDLE";
    this.loginError = null;
    this.isEchoBotEnabled = false; // Reset bot nhại
    console.log(
      "[Service] Trạng thái đã được reset về IDLE. API instance đã bị hủy.",
    );

    // 4. Phát sự kiện cho UI
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
  }

  // --- HÀM CHECK API (ĐẢM BẢO ĐĂNG NHẬP) ---
  private checkApi(): API {
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      console.warn("[Service] Yêu cầu API thất bại: Chưa đăng nhập.");
      throw new Error("Chưa đăng nhập (API instance is null).");
    }
    return this.api;
  }

  /**
   * [API] Lấy thông tin chi tiết (Info) của 1 hoặc nhiều nhóm
   * (Đã có trong GĐ 2, nhưng cần thiết cho GĐ 3.10)
   */
  public async getGroupInfo(
    groupId: string | string[],
  ): Promise<GroupInfoResponse> {
    const api = this.checkApi();
    console.log(`[Service] Lấy thông tin chi tiết nhóm: ${groupId}`);
    return api.getGroupInfo(groupId);
  }

  /**
   * [API] Lấy thông tin (Profile) của thành viên nhóm
   */
  public async getGroupMembersInfo(
    memberId: string | string[],
  ): Promise<GetGroupMembersInfoResponse> {
    const api = this.checkApi();
    console.log(`[Service] Lấy thông tin thành viên: ${memberId}`);
    return api.getGroupMembersInfo(memberId);
  }

  // --- GIAI ĐOẠN 2: TRIỂN KHAI API QUẢN LÝ BẠN BÈ ---

  /**
   * [API] Tìm kiếm người dùng bằng SĐT
   */
  public async findUser(phoneNumber: string): Promise<FindUserResponse> {
    const api = this.checkApi();
    console.log(`[Service] Đang tìm SĐT: ${phoneNumber}`);
    return api.findUser(phoneNumber);
  }

  /**
   * [API] Gửi lời mời kết bạn
   */
  public async sendFriendRequest(msg: string, userId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Đang gửi lời mời kết bạn đến: ${userId}`);
    await api.sendFriendRequest(msg, userId);
  }

  /**
   * [API] Chấp nhận lời mời kết bạn
   */
  public async acceptFriendRequest(userId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Đang chấp nhận lời mời từ: ${userId}`);
    await api.acceptFriendRequest(userId);
  }

  /**
   * [API] Hủy (thu hồi) lời mời đã gửi
   */
  public async undoFriendRequest(friendId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Đang thu hồi lời mời đến: ${friendId}`);
    await api.undoFriendRequest(friendId);
  }

  public async getSentFriendRequest(): Promise<GetSentFriendRequestResponse> {
    const api = this.checkApi();
    console.log(`[Service] Lấy danh sách lời mời đã gửi...`);
    return api.getSentFriendRequest();
  }

  public async getFriendRecommendations(): Promise<GetFriendRecommendationsResponse> {
    const api = this.checkApi();
    console.log(`[Service] Lấy danh sách gợi ý kết bạn...`);
    // Lưu ý: Tên hàm gốc trong tài liệu là getFriendRecommendationsList
    // Cần xác nhận tên hàm chính xác trong zca-js là gì
    // Tạm giả định là getFriendRecommendations (theo tài liệu)
    return api.getFriendRecommendations();
  }

  public async removeFriend(friendId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Đang xóa bạn: ${friendId}`);
    await api.removeFriend(friendId);
  }

  /**
   * [API] Chặn người dùng
   */
  public async blockUser(userId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Đang chặn người dùng: ${userId}`);
    await api.blockUser(userId);
  }

  /**
   * [API] Bỏ chặn người dùng
   */
  public async unblockUser(userId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Đang bỏ chặn người dùng: ${userId}`);
    await api.unblockUser(userId);
  }

  // --- P2: Quản lý Nhóm ---

  public async createGroup(options: CreateGroupOptions) {
    const api = this.checkApi();
    console.log(`[Service] Tạo nhóm mới: ${options.name}`);
    // Cần xử lý avatarSource nếu là đường dẫn file
    // (Tạm thời giả định zca-js tự xử lý hoặc người dùng truyền Buffer)
    // CẬP NHẬT: API `zca-js` yêu cầu `AttachmentSource` cho avatar.
    // Logic nghiệp vụ (Lớp 1) sẽ cần cung cấp đường dẫn tệp.
    // (Service sẽ không xử lý logic tải file ở đây)
    return api.createGroup(options);
  }

  /**
   * [API] Rời khỏi nhóm
   */
  public async leaveGroup(groupId: string, silent?: boolean): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Rời nhóm: ${groupId}`);
    await api.leaveGroup(groupId, silent);
  }

  /**
   * [API] Giải tán nhóm
   */
  public async disperseGroup(groupId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Giải tán nhóm: ${groupId}`);
    await api.disperseGroup(groupId);
  }

  public async addUserToGroup(memberId: string | string[], groupId: string) {
    const api = this.checkApi();
    console.log(`[Service] Thêm thành viên vào nhóm: ${groupId}`);
    return api.addUserToGroup(memberId, groupId);
  }

  /**
   * [API] Xóa thành viên khỏi nhóm
   */
  public async removeUserFromGroup(
    memberId: string | string[],
    groupId: string,
  ) {
    const api = this.checkApi();
    console.log(`[Service] Xóa thành viên khỏi nhóm: ${groupId}`);
    return api.removeUserFromGroup(memberId, groupId);
  }

  /**
   * [API] Lấy danh sách lời mời vào nhóm (chờ duyệt)
   */
  public async getGroupInviteBoxList(payload?: {
    mpage?: number;
    page?: number;
    invPerPage?: number;
    mcount?: number;
  }) {
    const api = this.checkApi();
    console.log(`[Service] Lấy danh sách lời mời vào nhóm...`);
    return api.getGroupInviteBoxList(payload);
  }

  public async getPendingGroupMembers(
    groupId: string,
    offset: number,
    count: number,
  ): Promise<GetPendingGroupMembersResponse> {
    const api = this.checkApi();
    console.log(
      `[Service] Lấy thành viên chờ duyệt của nhóm: ${groupId} (Offset: ${offset}, Count: ${count})`,
    );
    // @ts-expect-error - Bỏ qua lỗi type (Expected 1) vì API thật sự cần 3 tham số
    return api.getPendingGroupMembers(groupId, offset, count);
  }

  /**
   * [API] Duyệt thành viên
   */
  public async reviewPendingMemberRequest(
    payload: ReviewPendingMemberRequestPayload,
    groupId: string,
  ): Promise<Record<string, ReviewPendingMemberRequestStatus>> {
    const api = this.checkApi();
    console.log(`[Service] Duyệt thành viên cho nhóm: ${groupId}`);
    return api.reviewPendingMemberRequest(payload, groupId);
  }

  /**
   * [API] Cập nhật cài đặt nhóm
   */
  public async updateGroupSettings(
    options: UpdateGroupSettingsOptions,
    groupId: string,
  ) {
    const api = this.checkApi();
    console.log(`[Service] Cập nhật cài đặt nhóm: ${groupId}`);
    return api.updateGroupSettings(options, groupId);
  }

  public async getGroupLinkDetail(
    groupId: string,
  ): Promise<GetGroupLinkDetailResponse> {
    const api = this.checkApi();
    console.log(`[Service] Lấy chi tiết link nhóm: ${groupId}`);
    return api.getGroupLinkDetail(groupId);
  }

  // --- THÊM MỚI (GĐ 3.8): Các hàm API Nhóm còn thiếu ---

  public async enableGroupLink(groupId: string) {
    const api = this.checkApi();
    console.log(`[Service] Bật link mời nhóm: ${groupId}`);
    return api.enableGroupLink(groupId);
  }

  public async disableGroupLink(groupId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Tắt link mời nhóm: ${groupId}`);
    await api.disableGroupLink(groupId);
  }

  public async joinGroupInviteBox(groupId: string): Promise<void> {
    const api = this.checkApi();
    console.log(`[Service] Chấp nhận lời mời vào nhóm: ${groupId}`);
    await api.joinGroupInviteBox(groupId);
  }

  public async deleteGroupInviteBox(
    groupId: string | string[],
    blockFutureInvite?: boolean,
  ) {
    const api = this.checkApi();
    console.log(`[Service] Xóa/Từ chối lời mời vào nhóm: ${groupId}`);
    return api.deleteGroupInviteBox(groupId, blockFutureInvite);
  }

  public async getGroupLinkInfo(link: string) {
    const api = this.checkApi();
    console.log(`[Service] Lấy thông tin link mời: ${link}`);
    return api.getGroupLinkInfo({ link });
  }
}
