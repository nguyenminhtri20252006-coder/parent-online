/**
 * app/page.tsx
 *
 * Lớp Giao diện (UI Layer - Lớp 1).
 * ĐÃ TÁI CẤU TRÚC (REFACTORED) thành giao diện 4-Module.
 */
"use client";

import { useState, useEffect, useRef, useMemo, ReactNode } from "react";

// Tái cấu trúc (GĐ 1.2): Import actions từ vị trí mới
import {
  startLoginQRAction,
  startLoginWithTokenAction,
  getSessionTokenAction,
  logoutAction,
} from "@/lib/actions/auth.actions";
import {
  sendMessageAction,
  getAccountInfoAction,
  getThreadsAction,
  setEchoBotStateAction,
} from "@/lib/actions/chat.actions";
// THÊM MỚI: Import action từ vựng
import { sendVocabularyMessageAction } from "@/lib/actions/vocabulary.actions";

// SỬA ĐỔI: Nhập (import) tất cả types và constants từ tệp SSOT
import {
  ZALO_EVENTS,
  type ZaloMessage,
  type AccountInfo,
  type ThreadInfo,
  type LoginState,
  type ViewState, // (GĐ 3.2)
} from "@/lib/types/zalo.types";

// Tái cấu trúc (GĐ 1.3): Import các component con
import { TokenModal } from "@/app/components/ui/TokenModal";
import { LoginPanel } from "@/app/components/modules/LoginPanel";
import { BotInterface } from "@/app/components/BotInterface";

/**
 * Component Chính (Container)
 */
export default function BotControlPanel() {
  // Trạng thái chung
  const [loginState, setLoginState] = useState<LoginState>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Trạng thái Đăng nhập
  const [loginMethod, setLoginMethod] = useState<"qr" | "token">("qr");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [sessionTokenForCopy, setSessionTokenForCopy] = useState<string | null>(
    null,
  );
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  // SỬA ĐỔI: Đổi tên isSending -> isLoggingIn (để rõ ràng hơn)
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Trạng thái Dữ liệu (State của Ứng dụng)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [messages, setMessages] = useState<ZaloMessage[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadInfo | null>(null);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isEchoBotEnabled, setIsEchoBotEnabled] = useState(false);

  // THÊM MỚI: Trạng thái cho Giai đoạn 3
  const [view, setView] = useState<ViewState>("chat"); // ('chat' | 'manage')

  // THÊM MỚI: Trạng thái Module 1
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [isLoadingAccountInfo, setIsLoadingAccountInfo] = useState(false);

  // Trạng thái UI
  const [searchTerm, setSearchTerm] = useState("");
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);

  // THÊM MỚI: State cho các hành động gửi (để tránh xung đột)
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSendingVocab, setIsSendingVocab] = useState(false);

  // Ref cho EventSource
  const eventSourceRef = useRef<EventSource | null>(null);

  // --- Logic Lọc/Tìm kiếm (Mới) ---
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) =>
      thread.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [threads, searchTerm]);

  // --- Logic Xử lý Dữ liệu (Hàm trợ giúp) ---

  const handleFetchThreads = async () => {
    console.log("[UI] Đang tải danh sách hội thoại...");
    setIsLoadingThreads(true);
    setThreads([]);
    setSelectedThread(null);
    setErrorMessage(null);

    try {
      const threadList = await getThreadsAction();

      console.log(`[UI] Tải thành công ${threadList.length} hội thoại.`);
      threadList.sort((a, b) => {
        if (a.type !== b.type) {
          return b.type - a.type;
        }
        return a.name.localeCompare(b.name);
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

  const handleFetchAccountInfo = async () => {
    console.log("[UI] Đang tải thông tin tài khoản...");
    setIsLoadingAccountInfo(true);
    setErrorMessage(null);
    try {
      const info = await getAccountInfoAction();
      setAccountInfo(info);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Lỗi không xác định";
      setErrorMessage(`Lỗi tải thông tin tài khoản: ${errorMsg}`);
    } finally {
      setIsLoadingAccountInfo(false); // Tắt loading
    }
  };

  // --- Quản lý Kết nối SSE (useEffect chính) ---
  useEffect(() => {
    if (eventSourceRef.current) {
      return;
    }

    console.log("Thiết lập kết nối SSE...");
    eventSourceRef.current = new EventSource("/api/zalo-events");
    const eventSource = eventSourceRef.current;

    eventSource.onopen = () => console.log("Kết nối SSE đã mở.");
    eventSource.onerror = (err) => {
      console.error("Lỗi EventSource:", err);
      setLoginState("ERROR");
      setErrorMessage("Mất kết nối với máy chủ (SSE).");
      eventSource.close();
    };

    // Hàm xử lý chung
    const handleSSEMessage = (eventName: string, data: unknown) => {
      console.log(`[SSE] Nhận: ${eventName}`, data);

      switch (eventName) {
        case ZALO_EVENTS.STATUS_UPDATE:
          if (data && typeof data === "object" && "loginState" in data) {
            const newLoginState = (data as { loginState: LoginState })
              .loginState;
            setLoginState(newLoginState || "IDLE");

            // QUAN TRỌNG: Xử lý khi nhận được tin logout từ server
            if (newLoginState === "IDLE" || newLoginState === "ERROR") {
              console.log(
                "[SSE] Nhận trạng thái IDLE/ERROR từ server, đang reset UI...",
              );
              setAccountInfo(null);
              setThreads([]);
              setMessages([]);
              setSelectedThread(null);
              setQrCode(null);
              setIsLoggingIn(false); // SỬA ĐỔI: Đổi tên
              setSessionTokenForCopy(null);
              setView("chat"); // Reset view về chat
            }

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
          if (data && typeof data === "string") {
            setQrCode(data);
          }
          break;
        case ZALO_EVENTS.LOGIN_SUCCESS:
          setLoginState("LOGGED_IN");
          setQrCode(null);
          setErrorMessage(null);
          setIsLoggingIn(false); // SỬA ĐỔI: Đổi tên
          setTokenInput("");
          handleFetchAccountInfo();
          handleFetchThreads();
          break;
        case ZALO_EVENTS.LOGIN_FAILURE:
          const errorMsg =
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Lỗi đăng nhập không xác định";
          setErrorMessage(errorMsg);
          setLoginState("ERROR");
          setQrCode(null);
          setIsLoggingIn(false); // SỬA ĐỔI: Đổi tên
          break;
        case ZALO_EVENTS.NEW_MESSAGE:
          if (
            data &&
            typeof data === "object" &&
            "threadId" in data &&
            "data" in data
          ) {
            setMessages((prevMessages) => [
              ...prevMessages, // Sửa lỗi: Thêm tin nhắn mới vào CUỐI mảng
              data as ZaloMessage,
            ]);
          } else {
            console.warn(
              "Nhận được new_message nhưng cấu trúc không hợp lệ:",
              data,
            );
          }
          break;
        case ZALO_EVENTS.SESSION_GENERATED:
          if (data && typeof data === "string") {
            setSessionTokenForCopy(data);
          }
          break;
      }
    };

    // Thêm các Event Listeners
    const addJsonListener = (eventName: string) => {
      eventSource.addEventListener(eventName, (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage(eventName, data);
        } catch (e) {
          console.error(
            `Lỗi parse JSON cho sự kiện ${eventName}:`,
            e,
            event.data,
          );
        }
      });
    };

    // QR là string thô, không phải JSON
    eventSource.addEventListener(ZALO_EVENTS.QR_GENERATED, (event) => {
      handleSSEMessage(ZALO_EVENTS.QR_GENERATED, event.data);
    });
    // Session (token) là string thô (đã JSON.stringify từ service)
    eventSource.addEventListener(ZALO_EVENTS.SESSION_GENERATED, (event) => {
      handleSSEMessage(ZALO_EVENTS.SESSION_GENERATED, event.data);
    });

    // Các sự kiện còn lại là JSON
    addJsonListener(ZALO_EVENTS.STATUS_UPDATE);
    addJsonListener(ZALO_EVENTS.LOGIN_SUCCESS);
    addJsonListener(ZALO_EVENTS.LOGIN_FAILURE);
    addJsonListener(ZALO_EVENTS.NEW_MESSAGE);

    // Dọn dẹp
    return () => {
      console.log("Đóng kết nối SSE.");
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []); // Chỉ chạy 1 lần

  // --- Các Hàm Xử lý Tương tác (Actions) ---

  const handleStartLoginQR = () => {
    setLoginState("LOGGING_IN");
    setErrorMessage(null);
    setQrCode(null);
    setIsLoggingIn(true); // SỬA ĐỔI: Đổi tên
    startLoginQRAction();
  };

  const handleStartLoginWithToken = async () => {
    if (isLoggingIn || !tokenInput) return; // SỬA ĐỔI: Đổi tên
    setLoginState("LOGGING_IN");
    setErrorMessage(null);
    setQrCode(null);
    setIsLoggingIn(true); // SỬA ĐỔI: Đổi tên
    try {
      await startLoginWithTokenAction(tokenInput);
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : "Lỗi không xác định";
      setLoginState("ERROR");
      setErrorMessage(`Lỗi đăng nhập token: ${errorMsg}`);
      setIsLoggingIn(false); // SỬA ĐỔI: Đổi tên
    }
  };
  const handleLogout = async () => {
    console.log("[UI] Yêu cầu đăng xuất...");
    setErrorMessage(null);

    setLoginState("IDLE");
    setAccountInfo(null);
    setThreads([]);
    setMessages([]);
    setSelectedThread(null);
    setQrCode(null);
    setIsLoggingIn(false); // SỬA ĐỔI: Đổi tên
    setSessionTokenForCopy(null);
    setView("chat"); // Reset view

    // 2. Gọi Server Action (không cần await, chạy nền)
    logoutAction();
  };

  const handleCopyToken = async () => {
    setIsCopying(true);
    setErrorMessage(null);
    let tokenToCopy = sessionTokenForCopy;

    if (!tokenToCopy) {
      try {
        tokenToCopy = await getSessionTokenAction();
        setSessionTokenForCopy(tokenToCopy);
      } catch (error: unknown) {
        setErrorMessage("Không thể lấy session token. Vui lòng đăng nhập lại.");
        setIsCopying(false);
        return;
      }
    }

    try {
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = tokenToCopy!;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      document.execCommand("copy");
      document.body.removeChild(tempTextArea);
      setShowTokenModal(true);
    } catch (err) {
      setShowTokenModal(true);
    } finally {
      setIsCopying(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedThread) {
      setErrorMessage("Lỗi: Không có hội thoại nào được chọn.");
      return;
    }
    setErrorMessage(null);
    setIsSendingMessage(true);

    try {
      const result = await sendMessageAction(
        content,
        selectedThread.id,
        selectedThread.type,
      );

      if (!result.success) {
        setErrorMessage(result.error || "Gửi thất bại");
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Lỗi gửi tin nhắn",
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  // THÊM MỚI: Handler cho Gửi Từ vựng
  const handleSendVocabulary = async (topic: string, type: 0 | 1) => {
    if (!selectedThread) {
      setErrorMessage("Lỗi: Phải chọn một hội thoại để gửi từ vựng.");
      return;
    }
    setErrorMessage(null);
    setIsSendingVocab(true);

    try {
      // SỬA ĐỔI: Truyền `type` xuống Action
      await sendVocabularyMessageAction(selectedThread.id, topic, type);
      // Không cần làm gì khi thành công, tin nhắn sẽ tự gửi
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Lỗi gửi từ vựng",
      );
    } finally {
      setIsSendingVocab(false);
    }
  };

  const handleToggleEchoBot = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const isEnabled = e.target.checked;
    setIsEchoBotEnabled(isEnabled);
    try {
      await setEchoBotStateAction(isEnabled);
    } catch (error) {
      setErrorMessage("Lỗi khi cập nhật trạng thái Bot Nhại.");
      setIsEchoBotEnabled(!isEnabled);
    }
  };

  // Hàm render trạng thái (cho Login Panel)
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

  // --- JSX RENDER CHÍNH ---

  // 1. Hiển thị Modal (nếu cần)
  if (showTokenModal && sessionTokenForCopy) {
    return (
      <TokenModal
        token={sessionTokenForCopy}
        onClose={() => setShowTokenModal(false)}
      />
    );
  }

  // 2. Hiển thị Panel Đăng nhập (nếu chưa đăng nhập)
  if (loginState !== "LOGGED_IN") {
    return (
      <LoginPanel
        loginState={loginState}
        loginMethod={loginMethod}
        qrCode={qrCode}
        isSending={isLoggingIn} // SỬA ĐỔI: Đổi tên
        onLoginMethodChange={setLoginMethod}
        onTokenChange={setTokenInput}
        onStartLoginQR={handleStartLoginQR}
        onStartLoginToken={handleStartLoginWithToken}
        tokenInput={tokenInput}
        renderStatus={renderStatus}
      />
    );
  }

  // 3. Hiển thị Giao diện Chat chính (đã đăng nhập)
  return (
    <BotInterface
      // State & Handlers cho Module 1 (Menu)
      accountInfo={accountInfo}
      onCopyToken={handleCopyToken}
      isCopying={isCopying}
      isExpanded={isMenuExpanded}
      onToggleMenu={() => setIsMenuExpanded(!isMenuExpanded)}
      onLogout={handleLogout}
      onFetchAccountInfo={handleFetchAccountInfo}
      isLoadingAccountInfo={isLoadingAccountInfo}
      // (GĐ 3.2) Props cho Tabs (View)
      currentView={view}
      onChangeView={setView}
      // State & Handlers cho Module 2 (List)
      filteredThreads={filteredThreads}
      selectedThread={selectedThread}
      onSelectThread={(thread) => {
        setSelectedThread(thread);
      }}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFetchThreads={handleFetchThreads}
      isLoadingThreads={isLoadingThreads}
      // Props cho Module 3 (Chat)
      // SỬA LỖI: Thêm lại prop 'thread' bị thiếu
      thread={selectedThread}
      messages={messages.filter((m) => m.threadId === selectedThread?.id)}
      onSendMessage={handleSendMessage}
      isEchoBotEnabled={isEchoBotEnabled}
      onToggleEchoBot={handleToggleEchoBot}
      // THÊM MỚI: Props cho Gửi Từ vựng
      onSendVocabulary={handleSendVocabulary}
      isSendingMessage={isSendingMessage}
      isSendingVocab={isSendingVocab}
      // State & Handlers cho Module 4 (Details)
      threadForDetails={selectedThread}
      isDetailsPanelOpen={isDetailsPanelOpen}
      onToggleDetails={() => setIsDetailsPanelOpen(!isDetailsPanelOpen)}
      threads={threads}
      onRefreshThreads={handleFetchThreads}
      onClearSelectedThread={() => setSelectedThread(null)}
      // State & Handlers cho Lỗi
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(null)}
      // THÊM MỚI: Truyền handler set lỗi xuống
      onSetError={(msg) => setErrorMessage(msg)}
    />
  );
}
