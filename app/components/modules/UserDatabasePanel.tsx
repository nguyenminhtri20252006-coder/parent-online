"use client";

/**
 * app/components/modules/UserDatabasePanel.tsx
 *
 * (TỆP MỚI - Lô 4)
 * Component con cho ManagementPanel.
 * Cung cấp UI để quét thủ công và hiển thị User Cache.
 */
import { useMemo, useState } from "react";
import { UserCacheEntry, ThreadInfo } from "@/lib/types/zalo.types";
import { Avatar } from "@/app/components/ui/Avatar";
import {
  IconUsers,
  IconRefresh,
  IconPhone,
  IconCheck,
  IconClose,
} from "@/app/components/ui/Icons";

// Hàm trợ giúp tra cứu tên nhóm từ cache
const getGroupNames = (groupIds: Set<string>, threads: ThreadInfo[]) => {
  const threadMap = new Map(threads.map((t) => [t.id, t.name]));
  return Array.from(groupIds)
    .map((id) => threadMap.get(id) || "Nhóm không xác định")
    .join(", ");
};

export function UserDatabasePanel({
  userCache,
  threads,
  onStartManualScan,
  isScanningAll,
  scanStatus,
}: {
  userCache: Record<string, UserCacheEntry>;
  threads: ThreadInfo[];
  onStartManualScan: () => void;
  isScanningAll: boolean;
  scanStatus: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  // Lọc cache dựa trên thanh tìm kiếm
  const cachedUsers = useMemo(() => {
    const users = Object.values(userCache);
    if (!searchTerm) return users;
    const lowerSearch = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(lowerSearch) ||
        u.id.includes(lowerSearch) ||
        u.phoneNumber?.includes(searchTerm),
    );
  }, [userCache, searchTerm]);

  // Lấy danh sách nhóm (để đếm và tra cứu tên)
  const groupThreads = useMemo(
    () => threads.filter((t) => t.type === 1),
    [threads],
  );

  return (
    // SỬA ĐỔI: Thêm md:col-span-2 để component này chiếm toàn bộ chiều rộng
    <div className="rounded-lg bg-gray-800 p-4 shadow-lg md:col-span-2">
      <h2 className="mb-3 text-xl font-semibold text-white">
        Cơ sở dữ liệu Người dùng
      </h2>

      {/* 1. Phần Quét Thủ công */}
      <div className="mb-4 rounded-lg bg-gray-900/50 p-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-200">
          <IconRefresh className="h-5 w-5" />
          Quét Dữ liệu
        </h3>
        <p className="my-2 text-sm text-gray-400">
          Quét tuần tự tất cả các nhóm để xây dựng cache (có độ trễ 2 giây/nhóm
          để đảm bảo an toàn).
        </p>
        <button
          onClick={onStartManualScan}
          disabled={isScanningAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50"
        >
          <IconRefresh
            className={`h-5 w-5 ${isScanningAll ? "animate-spin" : ""}`}
          />
          {isScanningAll
            ? "Đang quét..."
            : `Quét thủ công toàn bộ (${groupThreads.length} nhóm)`}
        </button>
        {scanStatus && (
          <p className="mt-2 text-center text-sm text-yellow-400">
            {scanStatus}
          </p>
        )}
      </div>

      {/* 2. Phần Bảng Thống kê Cache */}
      <h3 className="text-base font-semibold text-gray-200">
        Danh sách Đã Cache ({cachedUsers.length} /{" "}
        {Object.keys(userCache).length})
      </h3>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Tìm theo tên, UID, SĐT..."
        className="my-3 w-full rounded-lg border border-gray-600 bg-gray-700 py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="h-96 max-h-96 space-y-2 overflow-y-auto pr-2">
        {cachedUsers.length === 0 && (
          <p className="pt-4 text-center text-gray-500">
            {Object.keys(userCache).length > 0
              ? "Không tìm thấy kết quả."
              : "Chưa có dữ liệu cache. Hãy quét nhóm."}
          </p>
        )}
        {cachedUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-3 rounded-lg bg-gray-700/50 p-2"
          >
            <Avatar src={user.avatar} alt={user.name} />
            <div className="w-1/3 flex-1 overflow-hidden">
              <h4
                className="truncate font-semibold text-white"
                title={user.name}
              >
                {user.name}
              </h4>
              <p
                className="truncate font-mono text-xs text-gray-400"
                title={user.id}
              >
                ID: {user.id}
              </p>
            </div>
            <div
              className="flex w-28 flex-shrink-0 items-center gap-1 text-sm text-gray-300"
              title={user.phoneNumber || "Không có SĐT"}
            >
              <IconPhone className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{user.phoneNumber || "Không có"}</span>
            </div>
            <div className="w-20 flex-shrink-0 text-sm">
              {user.isFriend ? (
                <span
                  className="flex items-center gap-1 text-green-400"
                  title="Bạn bè"
                >
                  <IconCheck className="h-4 w-4" /> Bạn bè
                </span>
              ) : (
                <span
                  className="flex items-center gap-1 text-gray-400"
                  title="Người lạ"
                >
                  <IconClose className="h-4 w-4" /> Người lạ
                </span>
              )}
            </div>
            <div
              className="flex w-28 flex-shrink-0 items-center gap-1 text-sm text-blue-300"
              title={getGroupNames(user.commonGroups, threads)}
            >
              <IconUsers className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {user.commonGroups.size} nhóm chung
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
