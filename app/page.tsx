/**
 * app/page.tsx
 *
 * Lớp Giao diện (UI Layer - Lớp 1).
 * ĐÃ TÁI CẤU TRÚC (REFACTORED) thành giao diện 4-Module.
 */
"use client";

import {
  useState,
  useEffect,
  useRef,
  FormEvent,
  ChangeEvent,
  useMemo,
  ReactNode, // Thêm ReactNode
} from "react";
// Import các actions
import {
  startLoginQRAction,
  startLoginWithTokenAction,
  getSessionTokenAction,
  sendMessageAction,
  getAccountInfoAction,
  getThreadsAction,
  setEchoBotStateAction,
  logoutAction, // THÊM MỚI
} from "./actions";

// --- Định nghĩa Types (Không đổi) ---
const ZALO_EVENTS = {
  QR_GENERATED: "qr_generated",
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILURE: "login_failure",
  NEW_MESSAGE: "new_message",
  STATUS_UPDATE: "status_update",
  SESSION_GENERATED: "session_generated",
};

type ZaloMessage = {
  threadId: string;
  isSelf: boolean;
  type: number;
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
  id: string;
  name: string;
  avatar: string;
  type: 0 | 1; // 0 = User, 1 = Group
};

type LoginState = "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR";

// --- Các Component Biểu tượng (Icon) SVG (Mới) ---
// (Sử dụng SVG nội tuyến để tránh phụ thuộc)

const IconUser = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      clipRule="evenodd"
    />
  </svg>
);

const IconUsers = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.599 1.591 12.067 12.067 0 01-6.162 3.424c.226.03.452.056.678.082 2.103.09 4.206-.153 6.161-1.001a2.25 2.25 0 01.598-1.59l-.001-.145z" />
  </svg>
);

const IconInfo = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c.264-.263.614-.383.944-.383s.68.12.944.383c.527.527.527 1.38 0 1.907a.997.997 0 01-.944.384.997.997 0 01-.944-.384c-.527-.527-.527-1.38 0-1.907zM11.25 12.75a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v3.75a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-3.75z"
      clipRule="evenodd"
    />
  </svg>
);

const IconSend = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
);

const IconSearch = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z"
      clipRule="evenodd"
    />
  </svg>
);

const IconLogout = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9a.75.75 0 01-1.5 0V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

const IconClose = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
      clipRule="evenodd"
    />
  </svg>
);
const IconRefresh = ({
  className,
  isSpinning = false,
}: {
  className: string;
  isSpinning?: boolean;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={`${className} ${isSpinning ? "animate-spin" : ""}`}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);
const IconMenuToggle = ({
  className,
  isExpanded = false,
}: {
  className: string;
  isExpanded?: boolean;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    {isExpanded ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"
      />
    )}
  </svg>
);

// --- Component Hình ảnh (Mới) ---
/**
 * Component Avatar (hiển thị ảnh hoặc fallback)
 */
function Avatar({
  src,
  alt,
  isGroup = false,
}: {
  src: string;
  alt: string;
  isGroup?: boolean;
}) {
  const [error, setError] = useState(false);
  const Icon = isGroup ? IconUsers : IconUser;

  if (error || !src) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-600 object-cover">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 rounded-full object-cover"
      onError={() => setError(true)}
    />
  );
}

// --- Component Modal Token (Không đổi) ---
function TokenModal({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  // ... (Giữ nguyên code của TokenModal)
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

// --- Component Giao diện Đăng nhập (Mới) ---
/**
 * Module 0: Panel Đăng nhập
 */
function LoginPanel({
  loginState,
  loginMethod,
  qrCode,
  isSending,
  onLoginMethodChange,
  onTokenChange,
  onStartLoginQR,
  onStartLoginToken,
  tokenInput,
  renderStatus,
}: {
  loginState: LoginState;
  loginMethod: "qr" | "token";
  qrCode: string | null;
  isSending: boolean;
  onLoginMethodChange: (method: "qr" | "token") => void;
  onTokenChange: (token: string) => void;
  onStartLoginQR: () => void;
  onStartLoginToken: () => void;
  tokenInput: string;
  renderStatus: () => React.ReactNode; // Sửa lỗi: Thay JSX.Element bằng React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-8 shadow-xl">
        <h1 className="mb-2 text-center text-3xl font-bold text-white">
          Bot ZCA
        </h1>
        <p className="mb-6 text-center text-gray-400">
          Trạng thái: {renderStatus()}
        </p>

        {/* A. Trạng thái CHƯA ĐĂNG NHẬP (Idle hoặc Lỗi) */}
        {(loginState === "IDLE" || loginState === "ERROR") && (
          <div className="flex flex-col gap-4">
            <div className="flex rounded-lg bg-gray-700 p-1">
              <button
                onClick={() => onLoginMethodChange("qr")}
                className={`w-1/2 rounded-md py-2 text-sm font-medium transition-colors ${
                  loginMethod === "qr"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-300 hover:bg-gray-600"
                }`}
              >
                Quét Mã QR
              </button>
              <button
                onClick={() => onLoginMethodChange("token")}
                className={`w-1/2 rounded-md py-2 text-sm font-medium transition-colors ${
                  loginMethod === "token"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-300 hover:bg-gray-600"
                }`}
              >
                Dùng Session Token
              </button>
            </div>

            {loginMethod === "qr" && (
              <button
                onClick={onStartLoginQR}
                disabled={isSending}
                className="w-full rounded-lg bg-blue-600 py-3 px-4 font-bold text-white transition duration-200 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50"
              >
                Bắt đầu Đăng nhập bằng QR
              </button>
            )}

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
                  onChange={(e) => onTokenChange(e.target.value)}
                  placeholder='{"cookie":{...},"imei":"...","userAgent":"..."}'
                  rows={4}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 p-2 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={onStartLoginToken}
                  disabled={isSending || !tokenInput}
                  className="w-full rounded-lg bg-green-600 py-3 px-4 font-bold text-white transition duration-200 hover:bg-green-700 disabled:cursor-wait disabled:opacity-50"
                >
                  {isSending ? "Đang xác thực..." : "Đăng nhập bằng Token"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* B. Trạng thái ĐANG ĐĂNG NHẬP */}
        {loginState === "LOGGING_IN" && (
          <div className="flex flex-col items-center gap-4">
            {qrCode && loginMethod === "qr" ? (
              <div className="mt-4 rounded-lg bg-white p-4">
                <img src={qrCode} alt="Zalo QR Code" className="h-auto w-64" />
                <p className="mt-2 text-center text-black">
                  Quét mã này bằng Zalo
                </p>
              </div>
            ) : (
              <div className="h-64 w-64 animate-pulse rounded-lg bg-gray-700" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Component Giao diện Chat (Mới) ---
/**
 * Module 1: Menu chính (Sidebar trái)
 */
function MainMenu({
  accountInfo,
  onCopyToken,
  isCopying,
  isExpanded,
  onToggleMenu,
  onLogout,
  onFetchAccountInfo,
  isLoadingAccountInfo,
}: {
  accountInfo: AccountInfo | null;
  onCopyToken: () => void;
  isCopying: boolean;
  isExpanded: boolean;
  onToggleMenu: () => void;
  onLogout: () => void;
  onFetchAccountInfo: () => void;
  isLoadingAccountInfo: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col bg-gray-900 py-4 transition-all duration-300 ease-in-out ${
        isExpanded ? "w-64" : "w-16"
      }`}
    >
      {/* 1. Profile */}
      <div
        className={`flex items-center gap-3 px-4 ${
          !isExpanded ? "justify-center" : ""
        }`}
      >
        {accountInfo ? (
          <Avatar src={accountInfo.avatar} alt={accountInfo.displayName} />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700">
            <IconUser className="h-6 w-6 text-gray-400" />
          </div>
        )}
        {isExpanded && accountInfo && (
          <div className="flex-1 overflow-hidden">
            <h3 className="truncate font-semibold text-white">
              {accountInfo.displayName}
            </h3>
            <p className="truncate text-xs text-gray-400">
              ID: {accountInfo.userId}
            </p>
          </div>
        )}
      </div>

      {/* 2. Các Nút Chức năng (Hiển thị đầy đủ khi mở rộng) */}
      <div className="mt-8 flex-1 space-y-2 px-3">
        {/* --- Nút Tải lại --- */}
        <button
          onClick={onFetchAccountInfo}
          disabled={isLoadingAccountInfo}
          className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:cursor-wait disabled:opacity-50"
          title="Tải lại Thông tin"
        >
          <IconRefresh
            className="h-6 w-6 flex-shrink-0"
            isSpinning={isLoadingAccountInfo}
          />
          {isExpanded && (
            <span className="flex-1">
              {isLoadingAccountInfo ? "Đang tải lại..." : "Tải lại Thông tin"}
            </span>
          )}
        </button>

        {/* --- Nút Copy Session --- */}
        <button
          onClick={onCopyToken}
          disabled={isCopying}
          className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:cursor-wait disabled:opacity-50"
          title={
            isCopying ? "Đang lấy token..." : "Sao chép (Copy) Session Token"
          }
        >
          <svg // Icon: Document Copy (Sao chép)
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-6 w-6 flex-shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.438-3.43-8.161-7.759-8.404a.75.75 0 00-.517.22c-.114.113-.223.238-.323.364M11.25 12.75H9v-2.625M11.25 12.75c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H9v-2.25c0-.621.504-1.125 1.125-1.125z"
            />
          </svg>

          {isExpanded && (
            <span className="flex-1">
              {isCopying ? "Đang lấy..." : "Sao chép Session"}
            </span>
          )}
        </button>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm text-red-400 transition-colors hover:bg-red-800 hover:text-red-300"
          title="Đăng xuất"
        >
          <IconLogout className="h-6 w-6 flex-shrink-0" />
          {isExpanded && <span className="flex-1">Đăng xuất</span>}
        </button>
      </div>
      <div className="mt-auto px-3">
        <button
          onClick={onToggleMenu}
          className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-white ${
            !isExpanded ? "justify-center" : ""
          }`}
          title={isExpanded ? "Thu gọn menu" : "Mở rộng menu"}
        >
          <IconMenuToggle className="h-6 w-6" isExpanded={isExpanded} />
        </button>
      </div>
    </div>
  );
}

/**
 * Module 2: Cột danh sách hội thoại
 */
function ConversationList({
  threads,
  selectedThread,
  onSelectThread,
  searchTerm,
  onSearchChange,
  onFetchThreads,
  isLoadingThreads,
}: {
  threads: ThreadInfo[];
  selectedThread: ThreadInfo | null;
  onSelectThread: (thread: ThreadInfo) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onFetchThreads: () => void;
  isLoadingThreads: boolean;
}) {
  return (
    <div className="flex h-full w-80 flex-col border-r border-gray-700 bg-gray-800">
      {/* Header và Thanh tìm kiếm */}
      <div className="p-4">
        <h2 className="mb-4 text-2xl font-bold text-white">Chats</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm bạn bè, nhóm..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-gray-700 py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <IconSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Nút Tải lại */}
      <button
        type="button"
        onClick={onFetchThreads}
        disabled={isLoadingThreads}
        className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-lg bg-gray-600 p-2 text-sm text-white transition duration-200 hover:bg-gray-500 disabled:cursor-wait disabled:opacity-50"
      >
        {isLoadingThreads ? (
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
        )}
        {isLoadingThreads ? "Đang tải..." : "Tải lại danh sách"}
      </button>

      {/* Danh sách Hội thoại */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 && !isLoadingThreads && (
          <p className="p-4 text-center text-gray-500">
            Không tìm thấy hội thoại.
          </p>
        )}
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread)}
            className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${
              selectedThread?.id === thread.id
                ? "bg-blue-800"
                : "hover:bg-gray-700"
            }`}
          >
            <Avatar
              src={thread.avatar}
              alt={thread.name}
              isGroup={thread.type === 1}
            />
            <div className="flex-1 overflow-hidden">
              <h3 className="truncate font-semibold text-white">
                {thread.name}
              </h3>
              <p className="truncate text-sm text-gray-400">
                {thread.type === 1 ? "Nhóm" : "Bạn bè"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Module 3: Khung chat chính
 */
function ChatFrame({
  thread,
  messages,
  onSendMessage,
  onToggleDetails,
  isEchoBotEnabled,
  onToggleEchoBot,
}: {
  thread: ThreadInfo | null;
  messages: ZaloMessage[];
  onSendMessage: (content: string) => Promise<void>;
  onToggleDetails: () => void;
  isEchoBotEnabled: boolean;
  onToggleEchoBot: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự cuộn xuống khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageContent || isSending || !thread) return;

    setIsSending(true);
    await onSendMessage(messageContent);
    setMessageContent("");
    setIsSending(false);
  };

  const renderMessageContent = (msg: ZaloMessage) => {
    // ... (Giữ nguyên hàm renderMessageContent từ code cũ)
    if (typeof msg.data.content === "string") {
      return msg.data.content;
    }
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

  if (!thread) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-gray-800">
        <p className="text-gray-500">Chọn một hội thoại để bắt đầu</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-gray-800">
      {/* Header Khung Chat */}
      <header className="flex items-center justify-between border-b border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={thread.avatar}
            alt={thread.name}
            isGroup={thread.type === 1}
          />
          <div>
            <h2 className="text-lg font-bold text-white">{thread.name}</h2>
            <p className="text-sm text-green-400">Đang hoạt động</p>
          </div>
        </div>
        <button
          onClick={onToggleDetails}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          title="Thông tin hội thoại"
        >
          <IconInfo className="h-6 w-6" />
        </button>
      </header>

      {/* Khung Log Tin nhắn */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <div
            key={msg.data.ts + index}
            className={`flex max-w-lg flex-col ${
              msg.isSelf ? "ml-auto items-end" : "mr-auto items-start"
            }`}
          >
            <span className="text-xs text-gray-400">{msg.data.dName}</span>
            <div
              className={`mt-1 rounded-lg p-3 ${
                msg.isSelf
                  ? "rounded-br-none bg-blue-700"
                  : "rounded-bl-none bg-gray-700"
              }`}
            >
              <p className="whitespace-pre-wrap break-words text-white">
                {renderMessageContent(msg)}
              </p>
            </div>
            <span className="mt-1 text-xs text-gray-500">
              {new Date(parseInt(msg.data.ts, 10)).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Form Gửi tin */}
      <footer className="border-t border-gray-700 p-4">
        <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
          <textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Viết tin nhắn..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-600 bg-gray-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleFormSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={isSending || !messageContent}
            className="rounded-lg bg-blue-600 p-3 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconSend className="h-6 w-6" />
          </button>
        </form>
        {/* Công tắc Bot Nhại */}
        <div className="border-t border-gray-700 pt-3 mt-3">
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
                onChange={onToggleEchoBot}
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-600 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:content-[''] after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-blue-500"></div>
            </div>
          </label>
        </div>
      </footer>
    </div>
  );
}

/**
 * Module 4: Cột chi tiết hội thoại (Sidebar phải)
 */
function DetailsPanel({
  thread,
  onClose,
}: {
  thread: ThreadInfo | null;
  onClose: () => void;
}) {
  if (!thread) return null;

  return (
    <div className="flex h-full w-80 flex-col border-l border-gray-700 bg-gray-800">
      <header className="flex items-center justify-between border-b border-gray-700 p-4">
        <h2 className="text-lg font-bold text-white">Chi tiết</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
        >
          <IconClose className="h-6 w-6" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center">
          <Avatar
            src={thread.avatar}
            alt={thread.name}
            isGroup={thread.type === 1}
          />
          <h3 className="mt-4 text-xl font-bold">{thread.name}</h3>
          <p className="text-sm text-gray-400">
            {thread.type === 1 ? "Nhóm" : "Bạn bè"}
          </p>
        </div>

        <div className="mt-6">
          <h4 className="mb-2 font-semibold text-gray-300">ID Hội thoại</h4>
          <p className="select-all break-all font-mono text-xs text-gray-400">
            {thread.id}
          </p>
        </div>

        <div className="mt-6 rounded-lg bg-gray-700 p-3">
          <p className="text-center text-sm italic text-gray-400">
            (Module 4 Placeholder)
            <br />
            Chi tiết thành viên nhóm hoặc thông tin profile user sẽ được tải ở
            đây (yêu cầu cập nhật backend - Giai đoạn 2).
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Component Chính (Container) ---
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
  const [isSending, setIsSending] = useState(false); // Dùng chung cho (login, send msg)

  // Trạng thái Dữ liệu (State của Ứng dụng)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [messages, setMessages] = useState<ZaloMessage[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadInfo | null>(null);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isEchoBotEnabled, setIsEchoBotEnabled] = useState(false);

  // THÊM MỚI: Trạng thái Module 1
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [isLoadingAccountInfo, setIsLoadingAccountInfo] = useState(false);

  // Trạng thái UI
  const [searchTerm, setSearchTerm] = useState("");
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);

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
    setIsLoadingAccountInfo(true); // Bật loading
    setErrorMessage(null); // Xóa lỗi cũ
    try {
      const info = await getAccountInfoAction();
      // --- DEBUG LOG (THEO YÊU CẦU) ---
      console.log("[UI-DEBUG] Tải thông tin tài khoản thành công:", info);
      // --- KẾT THÚC DEBUG ---
      setAccountInfo(info);
    } catch (err) {
      // --- DEBUG LOG (THEO YÊU CẦU) ---
      console.error("[UI-DEBUG] Lỗi tải thông tin tài khoản:", err);
      // --- KẾT THÚC DEBUG ---
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
              setIsSending(false);
              setSessionTokenForCopy(null);
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
          setIsSending(false);
          setTokenInput("");
          // Tải dữ liệu cần thiết cho UI chat
          handleFetchAccountInfo(); // Cập nhật: Gọi hàm debug mới
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
          setIsSending(false);
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
    setIsSending(true); // Đặt isSending khi bắt đầu
    startLoginQRAction();
  };

  const handleStartLoginWithToken = async () => {
    if (isSending || !tokenInput) return;
    setLoginState("LOGGING_IN");
    setErrorMessage(null);
    setQrCode(null);
    setIsSending(true);
    try {
      await startLoginWithTokenAction(tokenInput);
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : "Lỗi không xác định";
      setLoginState("ERROR");
      setErrorMessage(`Lỗi đăng nhập token: ${errorMsg}`);
      setIsSending(false);
    }
  };
  const handleLogout = async () => {
    console.log("[UI] Yêu cầu đăng xuất...");
    setErrorMessage(null);

    // 1. Reset trạng thái client ngay lập tức (UI mượt hơn)
    // (SSE cũng sẽ làm điều này, nhưng làm trước sẽ nhanh hơn)
    setLoginState("IDLE"); // Chuyển về màn hình đăng nhập
    setAccountInfo(null);
    setThreads([]);
    setMessages([]);
    setSelectedThread(null);
    setQrCode(null);
    setIsSending(false);
    setSessionTokenForCopy(null);

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

    const result = await sendMessageAction(
      content,
      selectedThread.id,
      selectedThread.type,
    );

    if (!result.success) {
      setErrorMessage(result.error || "Gửi thất bại");
    } else {
      setErrorMessage(null);
    }
  };

  const handleToggleEchoBot = async (e: ChangeEvent<HTMLInputElement>) => {
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
        break; // Sẽ không thấy vì UI chính hiển thị
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
        isSending={isSending}
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
    <div className="flex h-screen w-full overflow-hidden bg-gray-800 font-sans text-gray-100">
      {/* Module 1: Main Menu */}
      <MainMenu
        accountInfo={accountInfo}
        onCopyToken={handleCopyToken}
        isCopying={isCopying}
        isExpanded={isMenuExpanded}
        onToggleMenu={() => setIsMenuExpanded(!isMenuExpanded)}
        onLogout={handleLogout}
        onFetchAccountInfo={handleFetchAccountInfo}
        isLoadingAccountInfo={isLoadingAccountInfo}
      />

      {/* Module 2: Conversation List */}
      <ConversationList
        threads={filteredThreads} // Hiển thị danh sách đã lọc
        selectedThread={selectedThread}
        onSelectThread={(thread) => {
          setSelectedThread(thread);
          // Tự động mở Module 4 trên mobile/tablet (nếu cần)
          // setIsDetailsPanelOpen(false); // Đóng panel chi tiết khi đổi chat
        }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onFetchThreads={handleFetchThreads}
        isLoadingThreads={isLoadingThreads}
      />

      {/* Module 3: Main Chat Frame */}
      <ChatFrame
        thread={selectedThread}
        // Lọc tin nhắn cho đúng hội thoại đang chọn
        messages={messages.filter((m) => m.threadId === selectedThread?.id)}
        onSendMessage={handleSendMessage}
        onToggleDetails={() => setIsDetailsPanelOpen(!isDetailsPanelOpen)}
        isEchoBotEnabled={isEchoBotEnabled}
        onToggleEchoBot={handleToggleEchoBot}
      />

      {/* Module 4: Details Panel (Conditional) */}
      {isDetailsPanelOpen && (
        <DetailsPanel
          thread={selectedThread}
          onClose={() => setIsDetailsPanelOpen(false)}
        />
      )}

      {/* Hiển thị lỗi (nếu có) */}
      {errorMessage && (
        <div className="absolute bottom-4 right-4 z-50 max-w-sm rounded-lg bg-red-800 p-4 text-red-100 shadow-xl">
          <strong>Lỗi:</strong> {errorMessage}
          <button
            onClick={() => setErrorMessage(null)}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
