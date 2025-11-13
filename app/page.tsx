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
  startLoginAction,
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

export default function BotControlPanel() {
  // Trạng thái chung
  type LoginState = "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR";
  const [loginState, setLoginState] = useState<LoginState>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

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
                return b.type - a.type; // 1 (Group) > 0 (User)
              }
              return a.name.localeCompare(b.name); // Sắp xếp theo tên
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
      setErrorMessage(null); // Xóa lỗi cũ nếu gửi thành công
      setMessageContent(""); // Xóa nội dung input
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

      {/* --- THÊM MỚI: Hiển thị Thông tin Tài khoản (Step 1) --- */}
      {accountInfo && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-xl flex items-center gap-4">
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
            <p className="text-sm text-gray-400 font-mono">
              ID: {accountInfo.userId}
            </p>
          </div>
        </div>
      )}
      {/* --- Kết thúc thêm mới --- */}

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

          {/* --- Thẻ Gửi tin nhắn (CẬP NHẬT) --- */}
          {loginState === "LOGGED_IN" && (
            <div className="bg-gray-800 rounded-lg shadow-xl p-6">
              <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
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
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Chọn Hội thoại
                  </label>

                  {/* --- THÊM MỚI: Nút tải lại thủ công --- */}
                  <div className="flex items-center gap-2 mb-2">
                    <select
                      id="threadId"
                      value={selectedThread ? selectedThread.id : ""}
                      onChange={(e) => {
                        const foundThread = threads.find(
                          (t) => t.id === e.target.value,
                        );
                        setSelectedThread(foundThread || null);
                      }}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="p-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-wait"
                      title="Tải lại danh sách hội thoại"
                    >
                      {/* Thêm biểu tượng SVG Tải lại (xoay nếu đang tải) */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className={`w-5 h-5 ${
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
                    <div className="w-full text-sm text-gray-400 italic">
                      Đang tải danh sách...
                    </div>
                  )}
                </div>
                {/* --- Kết thúc thay đổi --- */}

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
                      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                  </label>
                </div>
                {/* --- Kết thúc thêm mới --- */}
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
