/**
 * app/page.tsx
 *
 * Lớp Giao diện (UI Layer - Lớp 1).
 * Trang điều khiển Client Component để tương tác với Bot.
 */
"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
// CẬP NHẬT: Import thêm các actions mới
import {
  startLoginQRAction, // Đổi tên
  startLoginWithTokenAction, // Thêm mới
  getSessionTokenAction, // Thêm mới
  sendMessageAction,
  getAccountInfoAction,
  getThreadsAction,
  setEchoBotStateAction, // Thêm action mới
} from "./actions";

// Định nghĩa các loại sự kiện SSE
const ZALO_EVENTS = {
  QR_GENERATED: "qr_generated",
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILURE: "login_failure",
  NEW_MESSAGE: "new_message",
  STATUS_UPDATE: "status_update",
  SESSION_GENERATED: "session_generated", // Thêm mới
};

// Định nghĩa kiểu dữ liệu cho tin nhắn (để hiển thị)
type ZaloMessage = {
  threadId: string;
  isSelf: boolean;
  type: number; // 0 = User, 1 = Group
  data: {
    uidFrom: string;
    dName: string;
    content: string | object;
    ts: string;
  };
};
type AccountInfo = {
  userId: string;
  displayName: string;
  avatar: string;
};

export type ThreadInfo = {
  id: string; // userId (bạn bè) hoặc groupId (nhóm)
  name: string; // displayName (bạn bè) hoặc name (nhóm)
  avatar: string; // avatar (cả hai)
  type: 0 | 1; // 0 = User, 1 = Group
};

/**
 * THÊM MỚI: Component Modal để hiển thị Token
 */
function TokenModal({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-lg rounded-lg bg-gray-800 p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
          aria-label="Đóng modal"
        >
          &times;
        </button>
        <h3 className="mb-4 text-xl font-semibold text-white">
          Session Token (JSON)
        </h3>
        <p className="mb-3 text-sm text-gray-400">
          Đây là &quot;Token&quot; (Credentials) của bạn. Hãy sao chép và lưu
          trữ nó ở một nơi an toàn (như trình quản lý mật khẩu). Đừng chia sẻ nó
          với bất kỳ ai.
        </p>
        <textarea
          readOnly
          value={token}
          className="h-40 w-full rounded-lg border border-gray-600 bg-gray-900 p-3 font-mono text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          // Tự động chọn text khi click
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-gray-600 py-2 px-4 font-bold text-white transition duration-200 hover:bg-gray-700"
        >
          Đã hiểu và Đóng
        </button>
      </div>
    </div>
  );
}

export default function BotControlPanel() {
  // Trạng thái chung
  type LoginState = "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR";
  const [loginState, setLoginState] = useState<LoginState>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // --- CẬP NHẬT: Thêm các State mới cho luồng Token ---
  const [loginMethod, setLoginMethod] = useState<"qr" | "token">("qr");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [sessionTokenForCopy, setSessionTokenForCopy] = useState<string | null>(
    null,
  );
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  // --- Kết thúc cập nhật ---

  // --- CẬP NHẬT: Form state & Data state ---
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  // State mới cho Thông tin Tài khoản (Step 1)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadInfo | null>(null);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  // --- Kết thúc cập nhật ---

  // State mới cho Công tắc Bot Nhại
  const [isEchoBotEnabled, setIsEchoBotEnabled] = useState(false); // Mặc định TẮT

  // Trạng thái Log tin nhắn
  const [messages, setMessages] = useState<ZaloMessage[]>([]);

  // Ref cho EventSource (để quản lý kết nối SSE)
  const eventSourceRef = useRef<EventSource | null>(null);

  // --- THÊM MỚI: Hàm tải hội thoại (Tái cấu trúc) ---
  /**
   * Tải (hoặc tải lại) danh sách hội thoại từ server
   */
  const handleFetchThreads = async () => {
    console.log("[UI] Đang tải danh sách hội thoại...");
    setIsLoadingThreads(true);
    // Xóa danh sách cũ và lựa chọn cũ
    setThreads([]);
    setSelectedThread(null);
    setErrorMessage(null); // Xóa lỗi cũ (nếu có)

    try {
      const threadList = await getThreadsAction();

      console.log(`[UI] Tải thành công ${threadList.length} hội thoại.`);
      // Sắp xếp: Nhóm (1) lên trước, Bạn bè (0) xuống dưới, rồi sắp xếp theo tên
      threadList.sort((a, b) => {
        if (a.type !== b.type) {
          return b.type - a.type; // 1 (Group) > 0 (User)
        }
        return a.name.localeCompare(b.name); // Sắp xếp theo tên
      });

      setThreads(threadList);
    } catch (error) {
      console.error("[UI] Lỗi khi tải danh sách hội thoại:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Lỗi không xác định";
      setErrorMessage(
        `Lỗi khi tải danh sách hội thoại: ${errorMsg}. Vui lòng thử lại.`,
      );
    } finally {
      setIsLoadingThreads(false);
    }
  };
  // --- Kết thúc thêm mới ---

  /**
   * Quản lý kết nối SSE
   */
  useEffect(() => {
    console.log("Thiết lập kết nối SSE...");
    // Đảm bảo chỉ chạy 1 lần
    if (eventSourceRef.current) {
      return;
    }

    eventSourceRef.current = new EventSource("/api/zalo-events");
    const eventSource = eventSourceRef.current;

    eventSource.onopen = () => {
      console.log("Kết nối SSE đã mở.");
    };

    eventSource.onerror = (err) => {
      console.error("Lỗi EventSource:", err);
      setLoginState("ERROR");
      setErrorMessage("Mất kết nối với máy chủ (SSE).");
      eventSource.close();
    };

    eventSource.onmessage = (event) => {
      console.log("[SSE - onmessage] Nhận được sự kiện chung (không tên):", {
        data: event.data,
      });
    };

    // Hàm xử lý chung cho mọi sự kiện SSE
    const handleSSEMessage = (eventName: string, data: unknown) => {
      console.log(`SSE: ${eventName}`, data);

      switch (eventName) {
        case ZALO_EVENTS.STATUS_UPDATE:
          if (data && typeof data === "object" && "loginState" in data) {
            setLoginState(
              (data as { loginState: LoginState }).loginState || "IDLE",
            );
            if (
              "error" in data &&
              data.error &&
              typeof data.error === "string"
            ) {
              setErrorMessage(data.error);
            }
          }
          break;
        case ZALO_EVENTS.QR_GENERATED:
          // SỬA LỖI (KẾ HOẠCH E): SSE gửi về string base64 thô
          if (data && typeof data === "string") {
            console.log(
              `[UI DEBUG] 6/6: Đang setQrCode state... (data: ${data.substring(
                0,
                50,
              )}...)`,
            ); // <-- DEBUG LOG 6
            setQrCode(data); // Hiển thị ảnh QR
          } else {
            console.warn(
              "Nhận được qr_generated nhưng data không phải string:",
              data,
            );
          }
          break;
        case ZALO_EVENTS.LOGIN_SUCCESS:
          setLoginState("LOGGED_IN");
          setQrCode(null);
          setErrorMessage(null);
          setIsSending(false); // THÊM MỚI: Kích hoạt lại nút (cho cả Token login)
          setTokenInput(""); // THÊM MỚI: Xóa token input sau khi thành công

          // --- THÊM MỚI: Tải dữ liệu khi đăng nhập thành công ---
          console.log(
            "[UI] Đăng nhập thành công. Đang tải thông tin tài khoản...",
          );
          getAccountInfoAction()
            .then((info) => {
              console.log("[UI] Tải thông tin tài khoản thành công:", info);
              setAccountInfo(info);
            })
            .catch((err) => {
              console.error("[UI] Lỗi tải thông tin tài khoản:", err);
              setErrorMessage(`Lỗi tải thông tin tài khoản: ${err.message}`);
            });

          console.log("[UI] Đang tải danh sách hội thoại...");
          setIsLoadingThreads(true);
          getThreadsAction().then((threadList) => {
            console.log(`[UI] Tải thành công ${threadList.length} hội thoại.`);
            // Sắp xếp: Nhóm (1) lên trước, Bạn bè (0) xuống dưới, rồi sắp xếp theo tên
            threadList.sort((a, b) => {
              if (a.type !== b.type) {
                return b.type - a.type;
              }
              return a.name.localeCompare(b.name);
            });

            setThreads(threadList);
            setIsLoadingThreads(false);
          });
          // --- Kết thúc thêm mới ---
          break;
        case ZALO_EVENTS.LOGIN_FAILURE:
          let errorMsg = "Lỗi đăng nhập không xác định";

          // Kiểm tra an toàn: data là object, có thuộc tính 'error', và 'error' là string
          if (
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string"
          ) {
            errorMsg = data.error;
          }

          setErrorMessage(errorMsg); // Chỉ gán giá trị đã được kiểm tra
          setLoginState("ERROR");
          setErrorMessage(errorMsg);
          setQrCode(null);
          setIsSending(false); // THÊM MỚI: Kích hoạt lại nút (cho cả Token login)
          break;
        case ZALO_EVENTS.NEW_MESSAGE:
          // SỬA LỖI: Kiểm tra 'data' có phải là ZaloMessage không
          if (
            data &&
            typeof data === "object" &&
            "threadId" in data &&
            "data" in data
          ) {
            setMessages((prevMessages) => [
              data as ZaloMessage,
              ...prevMessages,
            ]);
          } else {
            // 3. Nếu không, log lỗi và không cập nhật state
            console.warn(
              "Nhận được new_message nhưng cấu trúc không hợp lệ:",
              data,
            );
          }
          break;

        // THÊM MỚI: Xử lý khi nhận được Session Token
        case ZALO_EVENTS.SESSION_GENERATED:
          if (data && typeof data === "string") {
            console.log("[UI] Đã nhận và lưu session token vào state.");
            setSessionTokenForCopy(data);
          }
          break;
      }
    };

    // --- Cập nhật các AddEventListener ---
    // (Không đổi logic, chỉ thêm listener mới)
    eventSource.addEventListener(ZALO_EVENTS.STATUS_UPDATE, (event) => {
      // DEBUG: Log dữ liệu thô
      console.log("[SSE - STATUS_UPDATE] Nhận được dữ liệu thô:", event.data);
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.STATUS_UPDATE, data);
    });

    // Lắng nghe sự kiện QR
    eventSource.addEventListener(ZALO_EVENTS.QR_GENERATED, (event) => {
      // SỬA LỖI (KẾ HOẠCH E): Không parse JSON vì data là string thô
      console.log(
        "[SSE - QR_GENERATED] Nhận được dữ liệu thô:",
        event.data.substring(0, 100) + "...", // Log 100 ký tự đầu
      );
      const data = event.data;
      handleSSEMessage(ZALO_EVENTS.QR_GENERATED, data);
    });

    eventSource.addEventListener(ZALO_EVENTS.LOGIN_SUCCESS, (event) => {
      // DEBUG: Log dữ liệu thô
      console.log("[SSE - LOGIN_SUCCESS] Nhận được dữ liệu thô:", event.data);
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.LOGIN_SUCCESS, data);
    });

    // Lắng nghe sự kiện đăng nhập thất bại
    eventSource.addEventListener(ZALO_EVENTS.LOGIN_FAILURE, (event) => {
      // DEBUG: Log dữ liệu thô
      console.log("[SSE - LOGIN_FAILURE] Nhận được dữ liệu thô:", event.data);
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.LOGIN_FAILURE, data);
    });

    // Lắng nghe tin nhắn mới
    eventSource.addEventListener(ZALO_EVENTS.NEW_MESSAGE, (event) => {
      // DEBUG: Log dữ liệu thô
      console.log("[SSE - NEW_MESSAGE] Nhận được dữ liệu thô:", event.data);
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.NEW_MESSAGE, data);
    });

    // THÊM MỚI: Listener cho Session Token
    eventSource.addEventListener(ZALO_EVENTS.SESSION_GENERATED, (event) => {
      console.log("[SSE - SESSION_GENERATED] Nhận được dữ liệu thô (token)...");
      const data = event.data; // Đây là chuỗi JSON (dạng string)
      handleSSEMessage(ZALO_EVENTS.SESSION_GENERATED, data);
    });

    // Dọn dẹp khi component unmount
    return () => {
      console.log("Đóng kết nối SSE.");
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []); // Chỉ chạy 1 lần duy nhất

  /**
   * Xử lý gọi Server Action để bắt đầu đăng nhập
   */
  const handleStartLoginQR = () => {
    setLoginState("LOGGING_IN");
    setErrorMessage(null);
    setQrCode(null);
    startLoginQRAction(); // Gọi Server Action (đã đổi tên)
  };

  /**
   * THÊM MỚI: Xử lý gọi Server Action để đăng nhập bằng Token
   */
  const handleStartLoginWithToken = async () => {
    if (isSending || !tokenInput) {
      if (!tokenInput) setErrorMessage("Vui lòng dán session token vào.");
      return;
    }
    setLoginState("LOGGING_IN");
    setErrorMessage(null);
    setQrCode(null);
    setIsSending(true); // Vô hiệu hóa nút
    try {
      // Gọi Action mới
      await startLoginWithTokenAction(tokenInput);
      // Thành công sẽ được xử lý bởi SSE (LOGIN_SUCCESS)
    } catch (error: unknown) {
      // Thất bại sẽ được xử lý bởi Action (throw) và SSE (LOGIN_FAILURE)
      const errorMsg =
        error instanceof Error ? error.message : "Lỗi không xác định";
      setLoginState("ERROR");
      setErrorMessage(`Lỗi đăng nhập token: ${errorMsg}`);
      setIsSending(false); // Kích hoạt lại nút nếu Action throw lỗi
    }
  };

  /**
   * THÊM MỚI: Xử lý Copy Session Token
   */
  const handleCopyToken = async () => {
    setIsCopying(true);
    setErrorMessage(null);
    let tokenToCopy = sessionTokenForCopy;

    // Nếu chưa có (ví dụ: F5 trang), thử lấy lại từ server
    if (!tokenToCopy) {
      console.log(
        "[UI] Không tìm thấy token, đang gọi getSessionTokenAction...",
      );
      try {
        tokenToCopy = await getSessionTokenAction();
        setSessionTokenForCopy(tokenToCopy);
      } catch (error: unknown) {
        console.error("[UI] Lỗi khi lấy token:", error);
        setErrorMessage("Không thể lấy session token. Vui lòng đăng nhập lại.");
        setIsCopying(false);
        return;
      }
    }

    // Sử dụng document.execCommand để đảm bảo hoạt động trong iframe/môi trường bị hạn chế
    try {
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = tokenToCopy!;
      tempTextArea.style.position = "absolute";
      tempTextArea.style.left = "-9999px";
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      document.execCommand("copy");
      document.body.removeChild(tempTextArea);

      console.log("[UI] Đã copy token vào clipboard. Mở modal...");
      // Hiển thị modal
      setShowTokenModal(true);
    } catch (err) {
      console.error("[UI] Lỗi copy:", err);
      setErrorMessage(
        "Copy tự động thất bại. Vui lòng copy thủ công từ popup.",
      );
      setShowTokenModal(true); // Vẫn hiển thị modal
    } finally {
      setIsCopying(false);
    }
  };

  // --- Hàm gửi tin nhắn (Không đổi) ---
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    // Cập nhật điều kiện kiểm tra
    if (!selectedThread || !messageContent || isSending) return;

    setIsSending(true);
    setErrorMessage(null);

    // Cập nhật lệnh gọi Server Action (thêm 'type')
    const result = await sendMessageAction(
      messageContent,
      selectedThread.id,
      selectedThread.type,
    );

    if (!result.success) {
      setErrorMessage(result.error || "Gửi thất bại");
    } else {
      setErrorMessage(null);
      setMessageContent("");
    }
    setIsSending(false);
  };

  // --- THÊM MỚI: Xử lý Bật/Tắt Bot Nhại ---
  const handleToggleEchoBot = async (e: ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    console.log(`[UI] Đang cập nhật Bot Nhại -> ${isEnabled}`);
    setIsEchoBotEnabled(isEnabled); // Cập nhật UI ngay lập tức
    try {
      await setEchoBotStateAction(isEnabled); // Gửi lệnh xuống Server
      console.log("[UI] Cập nhật Bot Nhại thành công.");
    } catch (error) {
      console.error("[UI] Lỗi cập nhật Bot Nhại:", error);
      setErrorMessage("Lỗi khi cập nhật trạng thái Bot Nhại.");
      // Hoàn tác (rollback) nếu thất bại
      setIsEchoBotEnabled(!isEnabled);
    }
  };

  /**
   * Render Trạng thái
   */
  const renderStatus = () => {
    let color = "text-gray-400";
    let text = "ĐANG TẢI...";

    switch (loginState) {
      case "IDLE":
        color = "text-yellow-400";
        text = "CHƯA KẾT NỐI";
        break;
      case "LOGGING_IN":
        color = "text-blue-400";
        text =
          loginMethod === "qr"
            ? "ĐANG CHỜ QUÉT QR..."
            : "ĐANG ĐĂNG NHẬP BẰNG TOKEN...";
        break;
      case "LOGGED_IN":
        color = "text-green-400";
        text = "ĐÃ ĐĂNG NHẬP";
        break;
      case "ERROR":
        color = "text-red-400";
        text = "LỖI KẾT NỐI/ĐĂNG NHẬP";
        break;
    }
    return <span className={`font-bold ${color}`}>{text}</span>;
  };

  /**
   * Render Nội dung Log tin nhắn
   */
  const renderMessageContent = (msg: ZaloMessage) => {
    if (typeof msg.data.content === "string") {
      return msg.data.content;
    }
    // Cải thiện hiển thị cho nội dung không phải text
    if (typeof msg.data.content === "object" && msg.data.content !== null) {
      if ("type" in msg.data.content && msg.data.content.type === "sticker") {
        return "[Hình dán Sticker]";
      }
      return `[Nội dung đa phương tiện: ${Object.keys(msg.data.content).join(
        ", ",
      )}]`;
    }
    return "[Nội dung không xác định]";
  };

  // --- JSX ---
  return (
    <div className="min-h-screen bg-gray-900 p-4 text-gray-100 lg:p-8 font-sans">
      {/* THÊM MỚI: Hiển thị Modal */}
      {showTokenModal && sessionTokenForCopy && (
        <TokenModal
          token={sessionTokenForCopy}
          onClose={() => setShowTokenModal(false)}
        />
      )}

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">
          Bảng điều khiển Bot ZCA
        </h1>
        <p className="text-gray-400">Trạng thái: {renderStatus()}</p>
        {errorMessage && (
          <div className="mt-2 p-3 bg-red-800 border border-red-600 text-red-100 rounded-lg">
            <strong>Lỗi:</strong> {errorMessage}
          </div>
        )}
      </header>

      {/* --- THÊM MỚI: Hiển thị Thông tin Tài khoản (Step 1) --- */}
      {accountInfo && (
        <div className="mb-6 flex items-center gap-4 rounded-lg bg-gray-800 p-4 shadow-xl">
          <img
            src={accountInfo.avatar}
            alt="Avatar"
            className="w-16 h-16 rounded-full border-2 border-green-500"
            // Thêm fallback
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null; // Ngăn lặp vô hạn
              target.src = "https://placehold.co/64x64/27272a/a1a1aa?text=Ava";
            }}
          />
          <div>
            <h2 className="text-xl font-bold text-white">
              {accountInfo.displayName}
            </h2>
            <p className="font-mono text-sm text-gray-400">
              ID: {accountInfo.userId}
            </p>
          </div>
        </div>
      )}
      {/* --- Kết thúc thêm mới --- */}

      <main className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* === CỘT ĐIỀU KHIỂN (TRÁI) === */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* --- CẬP NHẬT: Thẻ Đăng nhập --- */}
          <div className="rounded-lg bg-gray-800 p-6 shadow-xl">
            <h2 className="mb-4 border-b border-gray-700 pb-2 text-xl font-semibold">
              Đăng nhập
            </h2>

            {/* A. Trạng thái CHƯA ĐĂNG NHẬP (Idle hoặc Lỗi) */}
            {loginState === "IDLE" || loginState === "ERROR" ? (
              <div className="flex flex-col gap-4">
                {/* A.1. Tabs Chọn Phương thức */}
                <div className="flex rounded-lg bg-gray-700 p-1">
                  <button
                    onClick={() => setLoginMethod("qr")}
                    className={`w-1/2 rounded-md py-2 text-sm font-medium transition-colors ${
                      loginMethod === "qr"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Quét Mã QR
                  </button>
                  <button
                    onClick={() => setLoginMethod("token")}
                    className={`w-1/2 rounded-md py-2 text-sm font-medium transition-colors ${
                      loginMethod === "token"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Dùng Session Token
                  </button>
                </div>

                {/* A.2. Nội dung Tab QR */}
                {loginMethod === "qr" && (
                  <button
                    onClick={handleStartLoginQR}
                    // 'isSending' cũng dùng để chặn khi đang login token
                    disabled={isSending}
                    className="w-full rounded-lg bg-blue-600 py-3 px-4 font-bold text-white transition duration-200 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50"
                  >
                    Bắt đầu Đăng nhập bằng QR
                  </button>
                )}

                {/* A.3. Nội dung Tab Token */}
                {loginMethod === "token" && (
                  <div className="flex flex-col gap-3">
                    <label
                      htmlFor="token-input"
                      className="text-sm font-medium text-gray-300"
                    >
                      Dán Session Token (JSON)
                    </label>
                    <textarea
                      id="token-input"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder='{"cookie":{...},"imei":"...","userAgent":"..."}'
                      rows={4}
                      className="w-full rounded-lg border border-gray-600 bg-gray-700 p-2 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleStartLoginWithToken}
                      // 'isSending' dùng chung cho các hành động đăng nhập
                      disabled={isSending || !tokenInput}
                      className="w-full rounded-lg bg-green-600 py-3 px-4 font-bold text-white transition duration-200 hover:bg-green-700 disabled:cursor-wait disabled:opacity-50"
                    >
                      {isSending ? "Đang xác thực..." : "Đăng nhập bằng Token"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* B. Trạng thái ĐANG ĐĂNG NHẬP */}
            {loginState === "LOGGING_IN" && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-blue-400">{renderStatus()}</p>
                {/* Chỉ hiển thị QR nếu là phương thức QR */}
                {qrCode && loginMethod === "qr" && (
                  <div className="mt-4 rounded-lg bg-white p-4">
                    <img
                      src={qrCode}
                      alt="Zalo QR Code"
                      className="h-auto w-full"
                    />
                    <p className="mt-2 text-center text-black">
                      Quét mã này bằng Zalo
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* C. Trạng thái ĐÃ ĐĂNG NHẬP */}
            {loginState === "LOGGED_IN" && (
              <div className="flex flex-col gap-4">
                <p className="text-green-400">
                  Đã kết nối và đang lắng nghe...
                </p>
                <button
                  onClick={handleCopyToken}
                  disabled={isCopying}
                  className="w-full rounded-lg bg-teal-600 py-3 px-4 font-bold text-white transition duration-200 hover:bg-teal-700 disabled:cursor-wait disabled:opacity-50"
                >
                  {isCopying
                    ? "Đang lấy token..."
                    : "Sao chép (Copy) Session Token"}
                </button>
              </div>
            )}
          </div>
          {/* --- Kết thúc CẬP NHẬT Thẻ Đăng nhập --- */}

          {/* --- Thẻ Gửi tin nhắn (Không đổi) --- */}
          {loginState === "LOGGED_IN" && (
            <div className="rounded-lg bg-gray-800 p-6 shadow-xl">
              <h2 className="mb-4 border-b border-gray-700 pb-2 text-xl font-semibold">
                Gửi tin nhắn (Steps 2, 3, 4)
              </h2>
              <form
                onSubmit={handleSendMessage}
                className="flex flex-col gap-4"
              >
                {/* --- THAY ĐỔI: Input -> Select (Danh sách Hội thoại) --- */}
                <div>
                  <label
                    htmlFor="threadId"
                    className="mb-1 block text-sm font-medium text-gray-300"
                  >
                    Chọn Hội thoại
                  </label>
                  <div className="mb-2 flex items-center gap-2">
                    <select
                      id="threadId"
                      value={selectedThread ? selectedThread.id : ""}
                      onChange={(e) => {
                        const foundThread = threads.find(
                          (t) => t.id === e.target.value,
                        );
                        setSelectedThread(foundThread || null);
                      }}
                      className="w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" disabled>
                        {isLoadingThreads ? "..." : "--- Chọn 1 hội thoại ---"}
                      </option>
                      {threads.map((thread) => (
                        <option key={thread.id} value={thread.id}>
                          {thread.type === 1 ? "[Nhóm] " : ""}
                          {thread.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleFetchThreads}
                      disabled={isLoadingThreads}
                      className="rounded-lg bg-gray-600 p-2 text-white transition duration-200 hover:bg-gray-500 disabled:cursor-wait disabled:opacity-50"
                      title="Tải lại danh sách hội thoại"
                    >
                      {/* Thêm biểu tượng SVG Tải lại (xoay nếu đang tải) */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className={`h-5 w-5 ${
                          isLoadingThreads ? "animate-spin" : ""
                        }`}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                        />
                      </svg>
                    </button>
                  </div>
                  {/* --- Kết thúc thêm mới --- */}

                  {isLoadingThreads && (
                    <div className="w-full text-sm italic text-gray-400">
                      Đang tải danh sách...
                    </div>
                  )}
                </div>
                {/* --- Kết thúc thay đổi --- */}

                <div>
                  <label
                    htmlFor="message"
                    className="mb-1 block text-sm font-medium text-gray-300"
                  >
                    Nội dung
                  </label>
                  <textarea
                    id="message"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Viết tin nhắn..."
                    rows={3}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  // Cập nhật điều kiện disabled
                  disabled={isSending || !selectedThread || !messageContent}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isSending ? "Đang gửi..." : "Gửi"}
                </button>

                {/* --- THÊM MỚI: Công tắc Bot Nhại --- */}
                <div className="border-t border-gray-700 pt-4 mt-2">
                  <label
                    htmlFor="echo-toggle"
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-sm font-medium text-gray-300">
                      Bật Bot Nhại Lại (Echo Bot)
                    </span>
                    <div className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        id="echo-toggle"
                        className="sr-only peer"
                        checked={isEchoBotEnabled}
                        onChange={handleToggleEchoBot}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-gray-600 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:content-[''] after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-blue-500"></div>
                    </div>
                  </label>
                </div>
                {/* --- Kết thúc thêm mới --- */}
              </form>
            </div>
          )}
        </div>

        {/* === CỘT LOG (PHẢI) (Không đổi) === */}
        <div className="rounded-lg bg-gray-800 p-6 shadow-xl lg:col-span-2">
          <h2 className="mb-4 border-b border-gray-700 pb-2 text-xl font-semibold">
            Log Tin Nhắn (Real-time)
          </h2>
          <div className="h-[600px] space-y-4 overflow-y-auto rounded-lg bg-gray-900 p-4">
            {messages.length === 0 ? (
              <p className="pt-4 text-center italic text-gray-500">
                Chưa có tin nhắn nào...
              </p>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={msg.data.ts + index}
                  className={`max-w-xl rounded-lg p-3 ${
                    msg.isSelf ? "ml-auto bg-blue-900" : "bg-gray-700"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-bold text-teal-300">
                      {msg.data.dName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(parseInt(msg.data.ts, 10)).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-white">
                    {renderMessageContent(msg)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    ThreadID: {msg.threadId}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
