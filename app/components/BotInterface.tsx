"use client";

/**
 * app/components/BotInterface.tsx
 *
 * Component Giao diện Chat chính (sau khi đã đăng nhập).
 * Bao gồm bố cục 4-module và truyền (props) state/handlers xuống.
 */
import { ChangeEvent } from "react";
import {
  AccountInfo,
  ThreadInfo,
  ZaloMessage,
  ViewState,
  UserCacheEntry, // THÊM MỚI (Lô Cache)
} from "@/lib/types/zalo.types";
import { MainMenu } from "@/app/components/modules/MainMenu";
import { ConversationList } from "@/app/components/modules/ConversationList";
import { ChatFrame } from "@/app/components/modules/ChatFrame";
import { DetailsPanel } from "@/app/components/modules/DetailsPanel";
// THÊM MỚI (GĐ 3.3)
import { ManagementPanel } from "@/app/components/modules/ManagementPanel";

// Định nghĩa Props cho component này
type BotInterfaceProps = {
  accountInfo: AccountInfo | null;
  onCopyToken: () => void;
  isCopying: boolean;
  isExpanded: boolean; // SỬA LỖI: Thêm prop
  onToggleMenu: () => void;
  onLogout: () => void;
  onFetchAccountInfo: () => void;
  isLoadingAccountInfo: boolean;
  // (GĐ 3.2) Props cho Tabs (View)
  currentView: ViewState; // SỬA LỖI: Thêm prop
  onChangeView: (view: ViewState) => void; // SỬA LỖI: Thêm prop
  // Props cho Module 2
  filteredThreads: ThreadInfo[];
  selectedThread: ThreadInfo | null;
  onSelectThread: (thread: ThreadInfo) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onFetchThreads: () => void;
  isLoadingThreads: boolean;
  thread: ThreadInfo | null;
  messages: ZaloMessage[];
  onSendMessage: (content: string) => Promise<void>;
  isEchoBotEnabled: boolean;
  onToggleEchoBot: (e: ChangeEvent<HTMLInputElement>) => void;
  // THÊM MỚI: Props cho Gửi Từ vựng
  onSendVocabulary: (topic: string, type: 0 | 1) => Promise<void>; // SỬA ĐỔI: Thêm type
  isSendingMessage: boolean;
  isSendingVocab: boolean;
  // Props cho Module 4
  threadForDetails: ThreadInfo | null; // SỬA LỖI: Thêm prop vào định nghĩa type
  isDetailsPanelOpen: boolean;
  onToggleDetails: () => void;
  // THÊM MỚI (GĐ 3.4): Props cho Action Handlers
  onRefreshThreads: () => void;
  onClearSelectedThread: () => void;
  threads: ThreadInfo[];
  // Props cho Lỗi
  errorMessage: string | null;
  onClearError: () => void;
  // THÊM MỚI: Handler set lỗi
  onSetError: (message: string | null) => void;
  // THÊM MỚI (Lô Cache): Props cho User Cache
  userCache: Record<string, UserCacheEntry>;
  onStartManualScan: () => void;
  isScanningAll: boolean;
  scanStatus: string;
};

export function BotInterface({
  // Tách props ra
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
  // Props cho Module 2
  filteredThreads,
  selectedThread,
  onSelectThread,
  searchTerm,
  onSearchChange,
  onFetchThreads,
  isLoadingThreads,
  // Props cho Module 3
  thread, // SỬA ĐỔI: Thêm lại
  messages,
  onSendMessage,
  isEchoBotEnabled,
  onToggleEchoBot,
  // THÊM MỚI: Props cho Gửi Từ vựng
  onSendVocabulary,
  isSendingMessage,
  isSendingVocab,
  // Props cho Module 4
  threadForDetails,
  isDetailsPanelOpen,
  onToggleDetails,
  // THÊM MỚI (GĐ 3.4)
  onRefreshThreads,
  onClearSelectedThread,
  // Props cho Lỗi
  threads,
  errorMessage,
  onClearError,
  // THÊM MỚI: Handler set lỗi
  onSetError,
  // THÊM MỚI (Lô Cache): Props cho User Cache
  userCache,
  onStartManualScan,
  isScanningAll,
  scanStatus,
}: BotInterfaceProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-800 font-sans text-gray-100">
      {/* Module 1: Main Menu */}
      <MainMenu
        accountInfo={accountInfo}
        onCopyToken={onCopyToken}
        isCopying={isCopying}
        isExpanded={isExpanded}
        onToggleMenu={onToggleMenu}
        onLogout={onLogout}
        onFetchAccountInfo={onFetchAccountInfo}
        isLoadingAccountInfo={isLoadingAccountInfo}
        // THÊM MỚI: Props cho Tabs (View)
        currentView={currentView}
        onChangeView={onChangeView}
      />

      {/* SỬA ĐỔI (GĐ 3.3): Render có điều kiện */}
      {currentView === "chat" ? (
        <>
          {/* Module 2: Conversation List */}
          <ConversationList
            threads={filteredThreads}
            selectedThread={selectedThread}
            onSelectThread={onSelectThread}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            onFetchThreads={onFetchThreads}
            isLoadingThreads={isLoadingThreads}
          />

          {/* Module 3: Main Chat Frame */}
          <ChatFrame
            thread={selectedThread}
            messages={messages}
            onSendMessage={onSendMessage}
            onToggleDetails={onToggleDetails}
            isEchoBotEnabled={isEchoBotEnabled}
            onToggleEchoBot={onToggleEchoBot}
            onSendVocabulary={onSendVocabulary}
            isSendingMessage={isSendingMessage}
            isSendingVocab={isSendingVocab}
            onSetError={onSetError}
            // THÊM MỚI (Lô Cache): Truyền cache xuống
            userCache={userCache}
          />

          {/* Module 4: Details Panel (Conditional) */}
          {isDetailsPanelOpen && (
            <DetailsPanel
              thread={threadForDetails}
              onClose={() => onToggleDetails()}
              // THÊM MỚI (GĐ 3.4): Truyền xuống Panel
              onRefreshThreads={onRefreshThreads}
              onClearSelectedThread={onClearSelectedThread}
            />
          )}
        </>
      ) : (
        // Chế độ Quản lý
        <ManagementPanel
          selectedThread={selectedThread}
          threads={threads}
          onRefreshThreads={onRefreshThreads}
          // THÊM MỚI (Lô Cache): Truyền props cache
          userCache={userCache}
          onStartManualScan={onStartManualScan}
          isScanningAll={isScanningAll}
          scanStatus={scanStatus}
        />
      )}

      {/* Hiển thị lỗi (nếu có) */}
      {errorMessage && (
        <div className="absolute bottom-4 right-4 z-50 max-w-sm rounded-lg bg-red-800 p-4 text-red-100 shadow-xl">
          <strong>Lỗi:</strong> {errorMessage}
          <button
            onClick={onClearError}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
