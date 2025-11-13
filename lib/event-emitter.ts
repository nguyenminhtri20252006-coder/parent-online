/**
 * lib/event-emitter.ts
 *
 * Tạo một instance EventEmitter toàn cục (singleton) để cho phép
 * Service Layer (Stateful) và API Routes (Stateless/Stream)
 * giao tiếp với nhau trong cùng một tiến trình Node.js.
 */
import { EventEmitter } from "events";

// Đây là instance duy nhất sẽ được chia sẻ
export const globalZaloEmitter = new EventEmitter();

// Định nghĩa các loại sự kiện để nhất quán
export const ZALO_EVENTS = {
  // Sự kiện khi QR được tạo (gửi QR base64)
  QR_GENERATED: "qr_generated",
  // Sự kiện khi đăng nhập thành công
  LOGIN_SUCCESS: "login_success",
  // Sự kiện khi đăng nhập thất bại
  LOGIN_FAILURE: "login_failure",
  // Sự kiện khi có tin nhắn mới (gửi payload tin nhắn)
  NEW_MESSAGE: "new_message",
  // Báo cáo trạng thái chung
  STATUS_UPDATE: "status_update",
};
