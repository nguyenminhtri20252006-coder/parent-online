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
  private static instance: ZaloSingletonService;

  // 2. Các thuộc tính trạng thái
  private zalo: Zalo;
  private api: API | null = null;
  private loginState: "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR" = "IDLE";
  private loginError: string | null = null;

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
      .loginQR({}, (qrDataOrPath: unknown) => {
        // Callback này được gọi khi thư viện CÓ dữ liệu QR
        console.log(
          "[Service DEBUG] 1/6: Callback loginQR được gọi. Dữ liệu thô:",
          qrDataOrPath,
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

          // Xử lý kết quả
          if (base64Image) {
            console.log(
              `[Service DEBUG] 3/6: Đã có base64. Đang emit... (data: ${base64Image.substring(
                0,
                50,
              )}...)`,
            ); // <-- DEBUG LOG 3
            globalZaloEmitter.emit(ZALO_EVENTS.QR_GENERATED, base64Image);
          } else {
            // SỬA LỖI: Bỏ qua các sự kiện callback không phải là QR image
            // (ví dụ: { type: 1, data: null } là sự kiện 'expired' hoặc 'scanned')
            // Đây không phải là lỗi, chỉ là thông báo từ thư viện.
            console.warn(
              "[Service WARN] Nhận được sự kiện callback không phải QR image (ví dụ: expired, scanned). Bỏ qua.",
              qrDataOrPath,
            );
            return; // Quan trọng: Không làm gì cả và không báo lỗi
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
      // Lấy type (User/Group) từ threadId.
      // Đây là một phỏng đoán dựa trên logic Zalo, bạn có thể cần điều chỉnh
      // Hoặc yêu cầu người dùng nhập type trong UI
      const threadType = threadId.includes("@g.us") ? 1 : 0; // 1 = Group, 0 = User

      await this.api.sendMessage(content, threadId, threadType);
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
