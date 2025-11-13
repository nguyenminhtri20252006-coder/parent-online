/**
 * lib/runtime-service.ts
 *
 * Lớp Dịch vụ Singleton (Lớp 3) - "Bộ não" 24/7.
 * Quản lý khởi tạo, trạng thái đăng nhập và listener của `zca-js`.
 */

// Import các thư viện Node.js cần thiết
// CẬP NHẬT: Chỉ import fsPromise vì không dùng fs.readFileSync nữa
import { promises as fsPromise } from "fs";
import path from "path";

// Import các thư viện bên ngoài
import {
  Zalo,
  API,
  User,
  GetAllGroupsResponse,
  GroupInfoResponse,
} from "zca-js";
// THÊM MỚI: Import CookieJar từ thư viện tough-cookie (Sửa lỗi ts(2724))
import sharp from "sharp";

// Import Emitter toàn cục
import { globalZaloEmitter, ZALO_EVENTS } from "./event-emitter";
/**
 * Thông tin tài khoản (Bot) đã đăng nhập.
 * (Trích xuất từ 'User' của zca-js)
 */
export type AccountInfo = {
  userId: string;
  displayName: string;
  avatar: string;
};

/**
 * Thông tin hội thoại (đã hợp nhất).
 * (Trích xuất từ 'User' hoặc 'GroupInfo' của zca-js)
 */
export type ThreadInfo = {
  id: string; // userId (bạn bè) hoặc groupId (nhóm)
  name: string; // displayName (bạn bè) hoặc name (nhóm)
  avatar: string; // avatar (cả hai)
  type: 0 | 1; // 0 = User, 1 = Group
};

/**
 * THÊM MỚI: Định nghĩa kiểu dữ liệu cho Credentials/Session
 */
type ZaloCredentials = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cookie: any; // SỬA ĐỔI: Dùng 'any' để giải quyết xung đột kiểu (lỗi ts(2741) và ts(2345))
  imei: string;
  userAgent: string;
};

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
const customGlobal = globalThis as typeof globalThis & {
  zaloServiceInstance: ZaloSingletonService;
};

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
      this.emitSessionToken(); // THÊM MỚI: Gửi lại session nếu đã đăng nhập
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
        // Callback này được gọi khi thư viện CÓ dữ liệu QR
        console.log(
          "[Service DEBUG] 1/6: Callback loginQR được gọi. Dữ liệu thô:",
        ); // <-- DEBUG LOG 1

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
            console.log(
              "[Service] Luồng 3 (image): Nhận được QR base64 trực tiếp (image).",
            );
            base64Image = qrDataOrPath.data.image; // Đây đã là data URI
          }

          if (base64Image) {
            if (!base64Image.startsWith("data:image")) {
              console.log(
                "[Service] Sửa lỗi: Tự động thêm tiền tố 'data:image/png;base64,' vào QR code.",
              );
              base64Image = `data:image/png;base64,${base64Image}`;
            }

            console.log(
              `[Service DEBUG] 3/6: Đã có base64. Đang emit... (data: ${base64Image.substring(
                0,
                50,
              )}...)`,
            );
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
        this.api = api; // Gán API đã đăng nhập
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
          this.isEchoBotEnabled && // KIỂM TRA CÔNG TẮC
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
      const info: User = await this.api.fetchAccountInfo();

      // --- DEBUG LOG (SERVER-SIDE) ---
      // Thêm log này để xem chính xác zca-js trả về cái gì
      console.log(
        "[Service-DEBUG] Dữ liệu 'info' thô nhận được từ this.api.fetchAccountInfo():",
        JSON.stringify(info, null, 2),
      );
      // --- KẾT THÚC DEBUG LOG ---

      // Thêm kiểm tra an toàn
      if (!info || !info.userId) {
        console.warn(
          "[Service-WARN] fetchAccountInfo() trả về dữ liệu không hợp lệ hoặc rỗng.",
          info,
        );
        // Trả về một lỗi rõ ràng thay vì object rỗng
        throw new Error(
          "Không thể lấy thông tin tài khoản từ Zalo API (dữ liệu trả về rỗng).",
        );
      }

      return {
        userId: info.userId,
        displayName: info.displayName,
        avatar: info.avatar,
      };
    } catch (error) {
      console.error("[Service] Lỗi getAccountInfo:", error);
      throw error;
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
          name: friend.displayName || friend.zaloName, // Dùng displayName, fallback về zaloName
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
        // SỬA LỖI: Chia lô (Batching) để tránh lỗi "Tham số không hợp lệ"
        // API có thể có giới hạn số lượng ID trong một lần gọi.

        // Thêm logic debug
        // Hàm trợ giúp delay
        const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
        const CHUNK_SIZE = 20;
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
}
