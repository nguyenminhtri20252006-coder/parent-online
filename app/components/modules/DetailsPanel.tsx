/**
 * app/components/modules/DetailsPanel.tsx
 *
 * Module 4: Cột chi tiết hội thoại (Sidebar phải)
 */
import { useState } from "react"; // THÊM MỚI
import { ThreadInfo } from "@/lib/types/zalo.types";
import { Avatar } from "@/app/components/ui/Avatar";
// THÊM MỚI: Icons và Actions
import {
  IconClose,
  IconUserMinus,
  IconLogout,
} from "@/app/components/ui/Icons";
import { removeFriendAction } from "@/lib/actions/friend.actions";
import { leaveGroupAction } from "@/lib/actions/group.actions";

export function DetailsPanel({
  thread,
  onClose,
  // THÊM MỚI (GĐ 3.4): Props từ BotInterface
  onRefreshThreads,
  onClearSelectedThread,
}: {
  thread: ThreadInfo | null;
  onClose: () => void;
  // THÊM MỚI (GĐ 3.4)
  onRefreshThreads: () => void;
  onClearSelectedThread: () => void;
}) {
  // THÊM MỚI (GĐ 3.4): State cho các nút hành động
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!thread) return null;

  // --- THÊM MỚI (GĐ 3.4): Hàm xử lý hành động ---

  const handleRemoveFriend = async () => {
    if (!thread || thread.type !== 0 || isActionLoading) return;
    if (
      !window.confirm(`Bạn có chắc chắn muốn HỦY KẾT BẠN với "${thread.name}"?`)
    )
      return;

    setIsActionLoading(true);
    setActionError(null);
    try {
      await removeFriendAction(thread.id);
      // Thành công: Đóng panel và làm mới danh sách
      onClearSelectedThread();
      onRefreshThreads();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định";
      setActionError(`Lỗi hủy kết bạn: ${msg}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!thread || thread.type !== 1 || isActionLoading) return;
    if (
      !window.confirm(`Bạn có chắc chắn muốn RỜI KHỎI NHÓM "${thread.name}"?`)
    )
      return;

    setIsActionLoading(true);
    setActionError(null);
    try {
      await leaveGroupAction(thread.id);
      // Thành công: Đóng panel và làm mới danh sách
      onClearSelectedThread();
      onRefreshThreads();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định";
      setActionError(`Lỗi rời nhóm: ${msg}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Kết thúc hàm xử lý ---

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

          {/* --- THÊM MỚI: Hiển thị ID để sao chép --- */}
          <div className="mt-2 w-full px-2">
            <label className="text-xs font-medium text-gray-500">
              {thread.type === 1 ? "Group ID" : "User ID"} (click để copy)
            </label>
            <input
              type="text"
              readOnly
              value={thread.id}
              className="w-full select-all rounded-md border border-gray-600 bg-gray-700 p-1.5 text-center font-mono text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => (e.target as HTMLInputElement).select()}
              title="Click để chọn và sao chép"
            />
          </div>
          {/* --- KẾT THÚC THÊM MỚI --- */}
        </div>

        {/* THÊM MỚI (GĐ 3.4): Khu vực Hành động (Actions) */}
        <div className="mt-6 border-t border-gray-700 pt-4">
          <h4 className="mb-3 font-semibold text-gray-300">Hành động</h4>

          {/* Nút Rời Nhóm (Chỉ hiển thị khi là Nhóm) */}
          {thread.type === 1 && (
            <button
              onClick={handleLeaveGroup}
              disabled={isActionLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-50"
            >
              <IconLogout className="h-5 w-5" />
              {isActionLoading ? "Đang xử lý..." : "Rời khỏi nhóm"}
            </button>
          )}

          {/* Nút Hủy Kết Bạn (Chỉ hiển thị khi là Bạn bè) */}
          {thread.type === 0 && (
            <button
              onClick={handleRemoveFriend}
              disabled={isActionLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-50"
            >
              <IconUserMinus className="h-5 w-5" />
              {isActionLoading ? "Đang xử lý..." : "Hủy kết bạn"}
            </button>
          )}

          {/* Hiển thị lỗi (nếu có) */}
          {actionError && (
            <p className="mt-3 text-center text-xs text-red-400">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
