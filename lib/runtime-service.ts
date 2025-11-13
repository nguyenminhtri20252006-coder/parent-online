/**
 * lib/runtime-service.ts
 *
 * Lớp Dịch vụ Singleton (Lớp 3) - "Bộ não" 24/7.
 * Quản lý khởi tạo, trạng thái đăng nhập và listener của `zca-js`.
 */

// Import các thư viện Node.js cần thiết
import { promises as fs } from "fs";
import path from "path";

// Import các thư viện bên ngoài
import { Zalo, API } from "zca-js";
import sharp from "sharp";

// Import Emitter toàn cục
import { globalZaloEmitter, ZALO_EVENTS } from "./event-emitter";

/**
 * Hàm trợ giúp lấy metadata ảnh (theo yêu cầu của zca-js).
 * Cần thiết nếu chúng ta muốn gửi ảnh/GIF từ đường dẫn tệp.
 */
async function imageMetadataGetter(filePath: string) {
  try {
    const data = await fs.readFile(filePath);
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
  private static instance: ZaloSingletonService;

  // 2. Các thuộc tính trạng thái
  private zalo: Zalo;
  private api: API | null = null;
  private loginState: "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR" = "IDLE";
  private loginError: string | null = null;

  // 3. Constructor (private)
  private constructor() {
    console.log("[Service] Đang khởi tạo ZaloSingletonService lần đầu...");

    // Đảm bảo thư mục 'public' tồn tại (cho các tệp khác sau này)
    // Mặc dù không dùng cho QR nữa, việc này vẫn tốt
    fs.mkdir(path.join(process.cwd(), "public")).catch((err) => {
      // Bỏ qua lỗi nếu thư mục đã tồn tại
      if (err.code !== "EEXIST") {
        console.error("[Service] Không thể tạo thư mục public:", err);
      }
    });

    this.zalo = new Zalo({
      imageMetadataGetter, // Cung cấp hàm lấy metadata ảnh
      selfListen: false, // Không lắng nghe tin nhắn của chính mình
      logging: true, // Bật log của thư viện zca-js
    });
  }

  // 4. Phương thức static để lấy instance (Singleton pattern)
  public static getInstance(): ZaloSingletonService {
    if (!ZaloSingletonService.instance) {
      ZaloSingletonService.instance = new ZaloSingletonService();
    }
    return ZaloSingletonService.instance;
  }

  // 5. Phương thức bắt đầu quá trình đăng nhập QR
  public startLoginQR(): void {
    if (this.loginState === "LOGGING_IN") {
      console.warn("[Service] Quá trình đăng nhập đã đang chạy.");
      return;
    }

    if (this.loginState === "LOGGED_IN") {
      console.warn("[Service] Đã đăng nhập rồi.");
      globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS); // Gửi lại sự kiện
      return;
    }

    console.log("[Service] Bắt đầu quá trình đăng nhập QR...");
    this.loginState = "LOGGING_IN";
    this.loginError = null;
    globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

    // Chạy bất đồng bộ
    // SỬA LỖI: Không dùng qrPath, thay bằng callback (qrData)
    this.zalo
      .loginQR({}, (qrData: unknown) => {
        // Callback này được gọi khi thư viện CÓ dữ liệu QR
        console.log("[Service] Callback QR data:", qrData); // (Dùng để debug)

        // SỬA LỖI (Dựa trên log image_8e4285.png):
        // Cấu trúc đúng là qrData.data.nbf
        if (
          qrData &&
          typeof qrData === "object" &&
          "data" in qrData &&
          typeof qrData.data === "object" &&
          qrData.data &&
          "nbf" in qrData.data &&
          typeof qrData.data.nbf === "string"
        ) {
          console.log("[Service] Đã nhận QR base64 từ qrData.data.nbf.");
          // Phát sự kiện QR_GENERATED với chuỗi base64
          globalZaloEmitter.emit(ZALO_EVENTS.QR_GENERATED, qrData.data.nbf);
        } else {
          console.error(
            "[Service] Cấu trúc dữ liệu QR không mong đợi:",
            qrData,
          );
          this.loginState = "ERROR";
          this.loginError = "Cấu trúc QR không hợp lệ";
          globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_FAILURE, this.loginError);
          globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
        }
      })
      .then((api) => {
        // Promise này resolve khi người dùng quét QR thành công
        console.log("[Service] Đăng nhập thành công!");
        this.api = api; // Gán API đã đăng nhập
        this.loginState = "LOGGED_IN";

        globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_SUCCESS);
        globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());

        // Khởi động listener
        this.api.listener.start();
        this.setupListeners();
      })
      .catch((err) => {
        console.error("[Service] Lỗi đăng nhập:", err);
        this.loginState = "ERROR";
        this.loginError = err.message || "Lỗi không xác định";
        globalZaloEmitter.emit(ZALO_EVENTS.LOGIN_FAILURE, this.loginError);
        globalZaloEmitter.emit(ZALO_EVENTS.STATUS_UPDATE, this.getStatus());
      });
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

        // Logic tự động (Ví dụ: Bot nhại lại)
        if (typeof msg.data.content === "string" && !msg.isSelf) {
          const content = msg.data.content;
          // Chỉ nhại lại nếu không phải là bot tự nhại
          if (!content.startsWith("Bot nhại: ")) {
            this.api
              ?.sendMessage(`Bot nhại: ${content}`, msg.threadId, msg.type)
              .catch(console.error);
          }
        }
      } catch (e) {
        console.error('[Service] Lỗi xử lý listener "message":', e);
      }
    });

    // (Bạn có thể thêm các listener khác ở đây, ví dụ: 'reaction', 'undo', 'group_event')
    // this.api.listener.on('reaction', (reaction) => {
    //   console.log('[Service] React mới:', reaction);
    // });
  }

  // 7. Phương thức nghiệp vụ: Gửi tin nhắn
  public async sendMessage(
    content: string,
    threadId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.loginState !== "LOGGED_IN" || !this.api) {
      console.warn("[Service] sendMessage thất bại: Chưa đăng nhập.");
      return { success: false, error: "Chưa đăng nhập" };
    }

    try {
      console.log(`[Service] Đang gửi tin nhắn "${content}" tới ${threadId}`);
      await this.api.sendMessage(content, threadId);
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
}
