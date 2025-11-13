/**
 * app/page.tsx
 *
 * Lớp Giao diện (UI Layer - Lớp 1).
 * Trang điều khiển Client Component để tương tác với Bot.
 */
"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { startLoginAction, sendMessageAction } from "./actions";

// Định nghĩa các loại sự kiện SSE
const ZALO_EVENTS = {
  QR_GENERATED: "qr_generated",
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILURE: "login_failure",
  NEW_MESSAGE: "new_message",
  STATUS_UPDATE: "status_update",
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

export default function BotControlPanel() {
  // Trạng thái chung
  type LoginState = "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR";
  const [loginState, setLoginState] = useState<LoginState>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Form state
  const [targetThreadId, setTargetThreadId] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Trạng thái Log tin nhắn
  const [messages, setMessages] = useState<ZaloMessage[]>([]);

  // Ref cho EventSource (để quản lý kết nối SSE)
  const eventSourceRef = useRef<EventSource | null>(null);

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
          // SỬA LỖI: SSE gửi về { qr: '...' }
          if (
            data &&
            typeof data === "object" &&
            "qr" in data &&
            typeof data.qr === "string"
          ) {
            setQrCode(data.qr); // Hiển thị ảnh QR
          }
          break;
        case ZALO_EVENTS.LOGIN_SUCCESS:
          setLoginState("LOGGED_IN");
          setQrCode(null);
          setErrorMessage(null);
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
      }
    };

    // Lắng nghe sự kiện cập nhật trạng thái
    // LỖI TYPO: Sửa ZALI_EVENTS -> ZALO_EVENTS
    eventSource.addEventListener(ZALO_EVENTS.STATUS_UPDATE, (event) => {
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.STATUS_UPDATE, data);
    });

    // Lắng nghe sự kiện QR
    eventSource.addEventListener(ZALO_EVENTS.QR_GENERATED, (event) => {
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.QR_GENERATED, data);
    });

    eventSource.addEventListener(ZALO_EVENTS.LOGIN_SUCCESS, (event) => {
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.LOGIN_SUCCESS, data);
    });

    // Lắng nghe sự kiện đăng nhập thất bại
    eventSource.addEventListener(ZALO_EVENTS.LOGIN_FAILURE, (event) => {
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.LOGIN_FAILURE, data);
    });

    // Lắng nghe tin nhắn mới
    eventSource.addEventListener(ZALO_EVENTS.NEW_MESSAGE, (event) => {
      const data = JSON.parse(event.data);
      handleSSEMessage(ZALO_EVENTS.NEW_MESSAGE, data);
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
  const handleStartLogin = () => {
    setLoginState("LOGGING_IN");
    setErrorMessage(null);
    setQrCode(null);
    startLoginAction(); // Gọi Server Action (không cần await)
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetThreadId || !messageContent || isSending) return;

    setIsSending(true);
    setErrorMessage(null);

    // Gọi Server Action
    const result = await sendMessageAction(messageContent, targetThreadId);
    if (!result.success) {
      setErrorMessage(result.error || "Gửi thất bại");
    } else {
      setErrorMessage(null); // Xóa lỗi cũ nếu gửi thành công
      setMessageContent(""); // Xóa nội dung input
    }
    setIsSending(false);
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
        text = "ĐANG CHỜ QUÉT QR...";
        break;
      case "LOGGED_IN":
        color = "text-green-400";
        text = "ĐÃ ĐĂNG NHẬP";
        break;
      case "ERROR":
        color = "text-red-400";
        text = "LỖI KẾT NỐI";
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
    return `[Nội dung đa phương tiện: ${Object.keys(msg.data.content).join(
      ", ",
    )}]`;
  };

  // --- JSX ---
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 lg:p-8 font-sans">
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

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* === CỘT ĐIỀU KHIỂN (TRÁI) === */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* --- Thẻ Đăng nhập --- */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
              Đăng nhập
            </h2>

            {loginState !== "LOGGED_IN" && (
              <button
                onClick={handleStartLogin}
                disabled={loginState === "LOGGING_IN"}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-wait"
              >
                {loginState === "LOGGING_IN"
                  ? "Đang tải QR..."
                  : "Bắt đầu Đăng nhập bằng QR"}
              </button>
            )}

            {loginState === "LOGGED_IN" && (
              <p className="text-green-400">Đã kết nối và đang lắng nghe...</p>
            )}

            {qrCode && loginState === "LOGGING_IN" && (
              <div className="mt-4 p-4 bg-white rounded-lg">
                <img
                  src={qrCode}
                  alt="Zalo QR Code"
                  className="w-full h-auto"
                />
                <p className="text-center text-black mt-2">
                  Quét mã này bằng Zalo
                </p>
              </div>
            )}
          </div>

          {/* --- Thẻ Gửi tin nhắn --- */}
          {loginState === "LOGGED_IN" && (
            <div className="bg-gray-800 rounded-lg shadow-xl p-6">
              <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
                Gửi tin nhắn Test
              </h2>
              <form
                onSubmit={handleSendMessage}
                className="flex flex-col gap-4"
              >
                <div>
                  <label
                    htmlFor="threadId"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Thread ID (User/Group)
                  </label>
                  <input
                    id="threadId"
                    type="text"
                    value={targetThreadId}
                    onChange={(e) => setTargetThreadId(e.target.value)}
                    placeholder="Dán Thread ID vào đây..."
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-300 mb-1"
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
                  disabled={isSending || !targetThreadId || !messageContent}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isSending ? "Đang gửi..." : "Gửi"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* === CỘT LOG (PHẢI) === */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg shadow-xl p-6">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
            Log Tin Nhắn (Real-time)
          </h2>
          <div className="h-[600px] overflow-y-auto bg-gray-900 rounded-lg p-4 space-y-4">
            {messages.length === 0 ? (
              <p className="text-gray-500 italic text-center pt-4">
                Chưa có tin nhắn nào...
              </p>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={msg.data.ts + index}
                  className={`p-3 rounded-lg ${
                    msg.isSelf ? "bg-blue-900 ml-auto" : "bg-gray-700"
                  } max-w-xl`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-teal-300">
                      {msg.data.dName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(parseInt(msg.data.ts, 10)).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-white whitespace-pre-wrap break-words">
                    {renderMessageContent(msg)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
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
