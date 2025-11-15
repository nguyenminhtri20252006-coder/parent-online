"use client";

/**
 * app/components/modules/ChatFrame.tsx
 *
 * Module 3: Khung chat chính
 */
import { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
// SỬA ĐỔI (Lô 3): Import thêm UserCacheEntry
import {
  ThreadInfo,
  ZaloMessage,
  UserCacheEntry,
} from "@/lib/types/zalo.types";
import { Avatar } from "@/app/components/ui/Avatar";
// THÊM MỚI: Import IconBookOpen
import { IconInfo, IconSend, IconBookOpen } from "@/app/components/ui/Icons";

export function ChatFrame({
  thread,
  messages,
  onSendMessage,
  onToggleDetails,
  isEchoBotEnabled,
  onToggleEchoBot,
  // THÊM MỚI: Props cho Gửi Từ vựng
  onSendVocabulary,
  isSendingMessage,
  isSendingVocab,
  onSetError,
  // THÊM MỚI (Lô 3): Prop UserCache
  userCache,
}: {
  thread: ThreadInfo | null;
  messages: ZaloMessage[];
  onSendMessage: (content: string) => Promise<void>;
  onToggleDetails: () => void;
  isEchoBotEnabled: boolean;
  onToggleEchoBot: (e: ChangeEvent<HTMLInputElement>) => void;
  // THÊM MỚI
  onSendVocabulary: (topic: string, type: 0 | 1) => Promise<void>; // SỬA ĐỔI: Thêm type
  isSendingMessage: boolean;
  isSendingVocab: boolean;
  onSetError: (message: string | null) => void;
  // THÊM MỚI (Lô 3)
  userCache: Record<string, UserCacheEntry>;
}) {
  const [messageContent, setMessageContent] = useState("");
  // SỬA ĐỔI: Xóa state `isSending` cục bộ, sử dụng prop `isSendingMessage`
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự cuộn xuống khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Xử lý Gửi tin nhắn thường
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageContent || isSendingMessage || isSendingVocab || !thread)
      return;

    // Không cần setIsLoading(true)
    await onSendMessage(messageContent);
    setMessageContent("");
    // Không cần setIsLoading(false)
  };

  // THÊM MỚI: Xử lý Gửi Từ vựng
  const triggerSendVocabulary = () => {
    // SỬA ĐỔI: Xóa kiểm tra thread.type
    if (!thread || isSendingMessage || isSendingVocab) {
      return;
    }
    // Sử dụng window.prompt (theo yêu cầu)
    const topic = window.prompt(
      "Gửi Từ Vựng\n\nVui lòng nhập Chủ đề (Topic) bạn muốn tạo:", // SỬA ĐỔI: Bỏ "vào Nhóm"
    );
    if (topic && topic.trim()) {
      onSetError(null); // Xóa lỗi cũ
      onSendVocabulary(topic.trim(), thread.type); // SỬA ĐỔI: Truyền thread.type
    }
  };

  const renderMessageContent = (msg: ZaloMessage) => {
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
        {messages.map((msg, index) => {
          // SỬA ĐỔI (Lô 3): Lấy thông tin người gửi từ cache
          // uidFrom có thể không tồn tại trên cache nếu là nhóm (chưa quét)
          const senderInfo = userCache[msg.data.uidFrom];
          const senderName = senderInfo?.name || msg.data.dName;
          const senderAvatar = senderInfo?.avatar || ""; // Fallback về chuỗi rỗng

          // SỬA ĐỔI (Lô 3.5): Nếu là chat 1-1, dùng avatar của thread (người bạn)
          const avatarToShow = thread.type === 0 ? thread.avatar : senderAvatar;
          const nameToShow = thread.type === 0 ? thread.name : senderName;

          return (
            <div
              key={msg.data.ts + index}
              className={`flex max-w-lg items-start gap-3 ${
                // SỬA ĐỔI: Thêm items-start và gap-3
                msg.isSelf ? "ml-auto flex-row-reverse" : "mr-auto" // SỬA ĐỔI: flex-row-reverse cho tin nhắn tự gửi
              }`}
            >
              {/* SỬA ĐỔI (Lô 3.5): Hiển thị avatar cho MỌI tin nhắn đến, không chỉ nhóm */}
              {!msg.isSelf ? (
                <div className="flex-shrink-0">
                  <Avatar
                    src={avatarToShow}
                    alt={nameToShow}
                    isGroup={false} // Luôn là avatar của user
                  />
                </div>
              ) : (
                // Tin nhắn của mình (isSelf) không cần avatar, nhưng cần placeholder để căn lề
                <div className="w-10 flex-shrink-0"></div>
              )}

              <div
                className={`flex flex-col ${
                  msg.isSelf ? "items-end" : "items-start" // Căn lề nội dung bên trong
                }`}
              >
                {/* SỬA ĐỔI (Lô 3): Hiển thị tên (chỉ khi là nhóm VÀ không phải của mình) */}
                {thread.type === 1 && !msg.isSelf && (
                  <span className="text-xs text-gray-400">{senderName}</span>
                )}
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
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Form Gửi tin */}
      <footer className="border-t border-gray-700 p-4">
        <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
          {/* THÊM MỚI: Nút Gửi Từ vựng */}
          <button
            type="button"
            onClick={triggerSendVocabulary}
            disabled={
              isSendingMessage || isSendingVocab // SỬA LỖI LOGIC: Phải là !== 1 (chỉ bật khi là nhóm)
            }
            className="rounded-lg bg-purple-600 p-3 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-600"
            title="Gửi Từ vựng theo Chủ đề"
          >
            {isSendingVocab ? (
              <svg // Spinner
                className="h-6 w-6 animate-spin"
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
              <IconBookOpen className="h-6 w-6" />
            )}
          </button>

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
            disabled={isSendingMessage || isSendingVocab || !messageContent}
            className="rounded-lg bg-blue-600 p-3 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Gửi tin nhắn"
          >
            {isSendingMessage ? (
              <svg // Spinner
                className="h-6 w-6 animate-spin"
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
              <IconSend className="h-6 w-6" />
            )}
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
              <div className="peer h-6 w-11 rounded-full bg-gray-600 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:content[''] after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-blue-500"></div>
            </div>
          </label>
        </div>
      </footer>
    </div>
  );
}
