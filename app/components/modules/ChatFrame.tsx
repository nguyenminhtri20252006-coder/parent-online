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
  ZaloAttachmentContent,
  ZaloStickerContent,
  ZaloVoiceContent,
  ZaloVideoContent, // <--- THÊM MỚI
  ThreadType,
} from "@/lib/types/zalo.types";
import { Avatar } from "@/app/components/ui/Avatar";
// THÊM MỚI: Import IconBookOpen
import {
  IconInfo,
  IconSend,
  IconBookOpen,
  IconCog,
} from "@/app/components/ui/Icons";
// Import Action Test Mới
import {
  testMediaAction,
  testVocabularyAction,
} from "@/lib/actions/test.actions";

/** 1. Hiển thị Ảnh */
const PhotoMessage = ({ content }: { content: ZaloAttachmentContent }) => {
  // Ưu tiên ảnh thumb để load nhanh, click vào href (HD) nếu cần (ở đây hiển thị đơn giản)
  const imgSrc = content.thumb || content.href;
  return (
    <div className="overflow-hidden rounded-lg bg-black/20">
      <img
        src={imgSrc}
        alt="Photo"
        className="max-h-64 w-auto object-contain"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {content.title && (
        <p className="p-2 text-xs text-gray-300">{content.title}</p>
      )}
    </div>
  );
};

/** 2. Hiển thị Sticker */
const StickerMessage = ({ content }: { content: ZaloStickerContent }) => {
  return (
    <div className="flex flex-col items-center rounded-lg bg-yellow-100/10 p-3">
      <span className="text-2xl">🐱</span>
      <span className="text-xs text-yellow-200 font-mono">
        [Sticker ID: {content.id}]
      </span>
    </div>
  );
};

/** 3. Hiển thị Voice */
const VoiceMessage = ({ content }: { content: ZaloVoiceContent }) => {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-600 p-2">
      <span className="text-xl">🎤</span>
      <div className="flex flex-col">
        <span className="text-xs text-gray-300">Tin nhắn thoại</span>
        {/* Dùng thẻ audio mặc định của trình duyệt */}
        <audio controls src={content.href} className="h-8 w-48" />
      </div>
    </div>
  );
};

/** 4. THÊM MỚI: Hiển thị Video */
const VideoMessage = ({ content }: { content: ZaloVideoContent }) => {
  return (
    <div className="overflow-hidden rounded-lg bg-black">
      <video
        controls
        poster={content.thumb}
        className="max-h-64 w-full max-w-xs object-contain"
      >
        <source src={content.href} type="video/mp4" />
        Trình duyệt của bạn không hỗ trợ thẻ video.
      </video>
      {content.duration && (
        <div className="p-2 text-xs text-gray-400">
          Thời lượng: {(content.duration / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
};

/** 5. Hiển thị Link Preview */
const LinkMessage = ({ content }: { content: ZaloAttachmentContent }) => {
  return (
    <a
      href={content.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-lg bg-gray-900 hover:bg-gray-950 transition-colors border border-gray-700"
    >
      {content.thumb && (
        <img
          src={content.thumb}
          alt="Link Thumb"
          className="h-32 w-full object-cover"
        />
      )}
      <div className="p-2">
        <h4 className="font-bold text-blue-400 truncate">
          {content.title || content.href}
        </h4>
        <p className="text-xs text-gray-400 truncate">{content.description}</p>
      </div>
    </a>
  );
};

/** 5. Hiển thị Reply Block (Trích dẫn) */
const ReplyBlock = ({
  quote,
}: {
  quote: NonNullable<ZaloMessage["data"]["quote"]>;
}) => {
  return (
    <div className="mb-1 flex flex-col border-l-4 border-gray-500 bg-gray-800/50 pl-2 p-1 rounded-r text-xs text-gray-400">
      <span className="font-bold text-gray-300">{quote.fromD}</span>
      <span className="truncate italic">
        {quote.msg || "[Nội dung đính kèm]"}
      </span>
    </div>
  );
};

// --- COMPONENT MENU DEBUG (MỚI) ---
function DebugMenu({
  onRunTest,
  isTesting,
}: {
  onRunTest: (type: string, subType?: string) => void;
  isTesting: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
        title="Menu Kiểm thử (Debug)"
      >
        <IconCog
          className={`h-6 w-6 ${
            isTesting ? "animate-spin text-yellow-500" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-lg border border-gray-600 bg-gray-900 p-2 shadow-xl z-50">
          <h4 className="mb-2 border-b border-gray-700 pb-1 text-xs font-bold uppercase text-gray-400">
            Test Suites
          </h4>

          {/* Suite: Media */}
          <div className="mb-2 flex flex-col gap-1">
            <span className="text-xs text-blue-400">Media & Format</span>
            <button
              onClick={() => onRunTest("media", "style")}
              className="text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800 px-2 py-1 rounded"
            >
              📝 Styled Text (Bold/Color)
            </button>
            <button
              onClick={() => onRunTest("media", "image")}
              className="text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800 px-2 py-1 rounded"
            >
              🖼️ Image (Buffer)
            </button>
            <button
              onClick={() => onRunTest("media", "voice")}
              className="text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800 px-2 py-1 rounded"
            >
              🎤 Voice (URL)
            </button>
          </div>

          {/* Suite: Vocab */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-green-400">Business Logic</span>
            <button
              onClick={() => onRunTest("vocab")}
              className="text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800 px-2 py-1 rounded"
            >
              📚 Vocab Templates (Full)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- COMPONENT CHÍNH ---

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
  onSendVocabulary: (topic: string, type: 0 | 1) => Promise<void>;
  isSendingMessage: boolean;
  isSendingVocab: boolean;
  onSetError: (message: string | null) => void;
  // THÊM MỚI (Lô 3)
  userCache: Record<string, UserCacheEntry>;
}) {
  const [messageContent, setMessageContent] = useState("");
  const [isTesting, setIsTesting] = useState(false);
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
    if (!thread || isSendingMessage || isSendingVocab) return;
    const topic = window.prompt("Gửi Từ Vựng\n\nVui lòng nhập Chủ đề (Topic):");
    if (topic && topic.trim()) {
      onSetError(null);
      onSendVocabulary(topic.trim(), thread.type);
    }
  };

  // --- HÀM XỬ LÝ TEST TẬP TRUNG ---
  const handleRunTest = async (category: string, subType?: string) => {
    if (!thread || isTesting) return;
    setIsTesting(true);
    onSetError(null);

    try {
      // Fix 1: Ép kiểu an toàn từ number sang Enum (thông qua number trung gian)
      const threadType = thread.type as number as ThreadType;

      if (category === "media" && subType) {
        // Fix 2: Định nghĩa kiểu MediaFeature để ép kiểu string
        type MediaFeature = "style" | "image" | "voice" | "link";
        const feature = subType as MediaFeature;
        await testMediaAction(thread.id, threadType, feature);
      } else if (category === "vocab") {
        await testVocabularyAction(thread.id, threadType);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi khi chạy test";
      onSetError(msg);
    } finally {
      setIsTesting(false);
    }
  };

  // Hàm Render Content Thông minh
  const renderMessageBody = (msg: ZaloMessage) => {
    const { msgType, content, quote } = msg.data;
    const renderContent = () => {
      if (msgType === "webchat" && typeof content === "string") {
        return (
          <p className="whitespace-pre-wrap break-words text-white">
            {content}
          </p>
        );
      }
      if (msgType === "chat.photo")
        return <PhotoMessage content={content as ZaloAttachmentContent} />;
      if (msgType === "chat.sticker")
        return <StickerMessage content={content as ZaloStickerContent} />;
      if (msgType === "chat.voice")
        return <VoiceMessage content={content as ZaloVoiceContent} />;
      if (msgType === "chat.recommended")
        return <LinkMessage content={content as ZaloAttachmentContent} />;

      return (
        <div className="rounded border border-dashed border-gray-500 p-2 text-xs text-gray-400">
          [Chưa hỗ trợ: {msgType}]
          <br />
          {typeof content === "object"
            ? JSON.stringify(content).slice(0, 50) + "..."
            : content}
        </div>
      );
    };

    return (
      <div className="flex flex-col">
        {/* Hiển thị Reply nếu có */}
        {quote && <ReplyBlock quote={quote} />}
        {/* Hiển thị Nội dung chính */}
        {renderContent()}
      </div>
    );
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

        {/* MENU DEBUG (Thay thế nút Info cũ hoặc thêm bên cạnh) */}
        <div className="flex items-center gap-2">
          <DebugMenu onRunTest={handleRunTest} isTesting={isTesting} />

          <button
            onClick={onToggleDetails}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            <IconInfo className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Khung Log Tin nhắn */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg, index) => {
          const senderInfo = userCache[msg.data.uidFrom];
          const senderName = senderInfo?.name || msg.data.dName;
          const senderAvatar = senderInfo?.avatar || "";

          const avatarToShow = thread.type === 0 ? thread.avatar : senderAvatar;
          const nameToShow = thread.type === 0 ? thread.name : senderName;

          return (
            <div
              key={msg.data.msgId + index}
              className={`flex max-w-lg items-start gap-3 ${
                msg.isSelf ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              {/* SỬA ĐỔI (Lô 3.5): Hiển thị avatar cho MỌI tin nhắn đến, không chỉ nhóm */}
              {!msg.isSelf ? (
                <div className="flex-shrink-0">
                  <Avatar src={avatarToShow} alt={senderName} isGroup={false} />
                </div>
              ) : (
                // Tin nhắn của mình (isSelf) không cần avatar, nhưng cần placeholder để căn lề
                <div className="w-10 flex-shrink-0"></div>
              )}

              <div
                className={`flex flex-col ${
                  msg.isSelf ? "items-end" : "items-start"
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
                  {renderMessageBody(msg)}
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
            disabled={isSendingMessage || isSendingVocab || isTesting}
            className="rounded-lg bg-purple-600 p-3 text-white hover:bg-purple-700 disabled:bg-gray-600"
            title="Gửi Từ vựng (API)"
          >
            {isSendingVocab ? "⏳" : <IconBookOpen className="h-6 w-6" />}
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
            className="rounded-lg bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSendingMessage ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <IconSend className="h-6 w-6" />
            )}
          </button>
        </form>
        {/* Công tắc Bot Nhại */}
        <div className="border-t border-gray-700 pt-3 mt-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-gray-300">
              Bot Nhại Lại (Echo Bot)
            </span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isEchoBotEnabled}
                onChange={onToggleEchoBot}
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-600 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </div>
          </label>
        </div>
      </footer>
    </div>
  );
}
