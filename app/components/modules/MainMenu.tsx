/**
 * app/components/modules/MainMenu.tsx
 *
 * Module 1: Menu chính (Sidebar trái)
 */
import { ReactNode } from "react"; // THÊM MỚI
import { AccountInfo, ViewState } from "@/lib/types/zalo.types";
import { Avatar } from "@/app/components/ui/Avatar";
import {
  IconUser,
  IconRefresh,
  IconLogout,
  IconMenuToggle,
  IconChatBubble, // THÊM MỚI
  IconCog, // THÊM MỚI
} from "@/app/components/ui/Icons";

// THÊM MỚI: Component TabButton
const TabButton = ({
  icon: Icon,
  label,
  isActive,
  onClick,
  isExpanded,
}: {
  icon: (props: { className: string }) => ReactNode; // SỬA ĐỔI: JSX.Element -> ReactNode
  label: string;
  isActive: boolean;
  onClick: () => void;
  isExpanded: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-300 hover:bg-gray-700 hover:text-white"
    }`}
    title={label}
  >
    <Icon className="h-6 w-6 flex-shrink-0" />
    {isExpanded && <span className="flex-1 font-medium">{label}</span>}
  </button>
);

// THÊM MỚI: Component ActionButton (cho các nút phụ)
const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  isExpanded,
  isLoading = false,
  isDestructive = false,
}: {
  icon: (props: { className: string }) => ReactNode; // SỬA ĐỔI: JSX.Element -> ReactNode
  label: string;
  onClick: () => void;
  isExpanded: boolean;
  isLoading?: boolean;
  isDestructive?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={isLoading}
    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm transition-colors disabled:cursor-wait disabled:opacity-50 ${
      isDestructive
        ? "text-red-400 hover:bg-red-800 hover:text-red-300"
        : "text-gray-400 hover:bg-gray-700 hover:text-white"
    }`}
    title={label}
  >
    <Icon
      className={`h-6 w-6 flex-shrink-0 ${isLoading ? "animate-spin" : ""}`}
    />
    {isExpanded && <span className="flex-1">{label}</span>}
  </button>
);

export function MainMenu({
  accountInfo,
  onCopyToken,
  isCopying,
  isExpanded,
  onToggleMenu,
  onLogout,
  onFetchAccountInfo,
  isLoadingAccountInfo,
  // THÊM MỚI: Props cho Tabs (View)
  currentView,
  onChangeView,
}: {
  accountInfo: AccountInfo | null;
  onCopyToken: () => void;
  isCopying: boolean;
  isExpanded: boolean;
  onToggleMenu: () => void;
  onLogout: () => void;
  onFetchAccountInfo: () => void;
  isLoadingAccountInfo: boolean;
  // THÊM MỚI
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
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
        <TabButton
          icon={IconChatBubble}
          label="Chat"
          isActive={currentView === "chat"}
          onClick={() => onChangeView("chat")}
          isExpanded={isExpanded}
        />
        <TabButton
          icon={IconCog}
          label="Quản lý"
          isActive={currentView === "manage"}
          onClick={() => onChangeView("manage")}
          isExpanded={isExpanded}
        />
      </div>

      {/* 3. CÁC NÚT HÀNH ĐỘNG PHỤ */}
      <div className="mt-8 space-y-2 border-t border-gray-700 px-3 pt-4">
        <ActionButton
          icon={IconRefresh}
          label={isLoadingAccountInfo ? "Đang tải lại..." : "Tải lại Thông tin"}
          onClick={onFetchAccountInfo}
          isExpanded={isExpanded}
          isLoading={isLoadingAccountInfo}
        />
        <ActionButton
          icon={(props) => (
            <svg // Icon: Document Copy (Sao chép)
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className={props.className}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.438-3.43-8.161-7.759-8.404a.75.75 0 00-.517.22c-.114.113-.223.238-.323.364M11.25 12.75H9v-2.625M11.25 12.75c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H9v-2.25c0-.621.504-1.125 1.125-1.125z"
              />
            </svg>
          )}
          label={isCopying ? "Đang lấy..." : "Sao chép Session"}
          onClick={onCopyToken}
          isExpanded={isExpanded}
          isLoading={isCopying}
        />
        <ActionButton
          icon={IconLogout}
          label="Đăng xuất"
          onClick={onLogout}
          isExpanded={isExpanded}
          isDestructive={true}
        />
      </div>
      <div className="mt-auto px-3 pt-4">
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
