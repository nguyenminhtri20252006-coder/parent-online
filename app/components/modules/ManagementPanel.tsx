"use client";

/**
 * app/components/modules/ManagementPanel.tsx
 * Giao diện chính cho Tab "Quản lý".
 * CẬP NHẬT (GĐ 3.5): Thêm component con AddFriendPanel.
 */

import { useState, useEffect } from "react"; // SỬA ĐỔI: Thêm useEffect
// SỬA ĐỔI (GĐ 3.6): Import thêm actions và types
import {
  findUserAction,
  sendFriendRequestAction,
  getFriendRecommendationsAction,
  getSentFriendRequestAction,
  acceptFriendRequestAction,
  undoFriendRequestAction,
} from "@/lib/actions/friend.actions";
import { createGroupAction } from "@/lib/actions/group.actions";
import {
  FindUserResponse,
  GetFriendRecommendationsResponse,
  FriendRecommendationsRecommItem,
  GetSentFriendRequestResponse,
  SentFriendRequestInfo,
  ThreadInfo, // <--- THÊM MỚI (GĐ 3.7)
  UserCacheEntry, // THÊM MỚI (Lô 4)
} from "@/lib/types/zalo.types";
import { Avatar } from "@/app/components/ui/Avatar";
// SỬA ĐỔI (GĐ 3.6): Import thêm icons
import {
  IconSearch,
  IconUserPlus,
  IconRefresh,
  IconCheck,
  IconClose,
  IconUsers,
} from "@/app/components/ui/Icons";
// THÊM MỚI (GĐ 3.9): Import component Quản lý Nâng cao
import { AdvancedGroupManager } from "./AdvancedGroupManager";
// THÊM MỚI (Lô 4): Import component Cache
import { UserDatabasePanel } from "./UserDatabasePanel";

/**
 * Component con (GĐ 3.5): Bảng điều khiển Kết bạn
 */
function AddFriendPanel() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [friendRequestMessage, setFriendRequestMessage] = useState("");
  const [foundUser, setFoundUser] = useState<FindUserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSearchUser = async () => {
    if (!phoneNumber) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setFoundUser(null);
    setFriendRequestMessage(""); // Reset lời nhắn cũ

    try {
      const result = await findUserAction(phoneNumber);
      if (!result || !result.uid) {
        throw new Error("Không tìm thấy người dùng với số điện thoại này.");
      }
      setFoundUser(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(`Lỗi tìm kiếm: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!foundUser || !friendRequestMessage) {
      setError("Vui lòng nhập lời nhắn kết bạn.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await sendFriendRequestAction(friendRequestMessage, foundUser.uid);
      setSuccess(`Đã gửi lời mời kết bạn đến ${foundUser.display_name}.`);
      // Reset
      setFoundUser(null);
      setPhoneNumber("");
      setFriendRequestMessage("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(`Lỗi gửi lời mời: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-gray-800 p-4 shadow-lg">
      <h2 className="mb-3 text-xl font-semibold text-white">
        Kết bạn (Qua SĐT)
      </h2>
      <div className="flex flex-col gap-3">
        {/* --- Form Tìm kiếm --- */}
        <div className="flex gap-2">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Nhập SĐT người dùng..."
            className="flex-1 rounded-lg border border-gray-600 bg-gray-700 py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSearchUser}
            disabled={isLoading || !phoneNumber}
            className="flex items-center justify-center rounded-lg bg-blue-600 px-4 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconSearch className="h-5 w-5" />
          </button>
        </div>

        {/* --- Hiển thị Lỗi/Thành công (Tìm kiếm) --- */}
        {isLoading && !foundUser && (
          <p className="text-sm text-yellow-400">Đang tìm kiếm...</p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">{success}</p>}

        {/* --- Kết quả tìm kiếm & Form Gửi Lời mời --- */}
        {foundUser && (
          <div className="mt-4 animate-fadeIn rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <div className="flex items-center gap-3">
              <Avatar src={foundUser.avatar} alt={foundUser.display_name} />
              <div className="flex-1">
                <h3 className="font-semibold text-white">
                  {foundUser.display_name}
                </h3>
                <p className="font-mono text-xs text-gray-400">
                  ID: {foundUser.uid}
                </p>
              </div>
            </div>
            <textarea
              value={friendRequestMessage}
              onChange={(e) => setFriendRequestMessage(e.target.value)}
              placeholder="Nhập lời nhắn kết bạn..."
              rows={3}
              className="mt-3 w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSendRequest}
              disabled={isLoading || !friendRequestMessage}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-wait disabled:opacity-50"
            >
              <IconUserPlus className="h-5 w-5" />
              {isLoading ? "Đang gửi..." : "Gửi lời mời kết bạn"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
/**
 * THÊM MỚI (GĐ 3.6): Component con Quản lý Lời mời
 */
function FriendRequestManager() {
  const [tab, setTab] = useState<"recommended" | "sent">("recommended");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State giữ data
  const [recommendations, setRecommendations] = useState<
    FriendRecommendationsRecommItem[]
  >([]);
  const [sentRequests, setSentRequests] = useState<SentFriendRequestInfo[]>([]);
  // State loading cho từng item
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  const handleFetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Gọi cả hai API song song
      const [recommResult, sentResult] = await Promise.all([
        getFriendRecommendationsAction() as Promise<GetFriendRecommendationsResponse>,
        getSentFriendRequestAction() as Promise<GetSentFriendRequestResponse>,
      ]);

      setRecommendations(recommResult.recommItems || []);
      // API đã gửi trả về 1 object, cần chuyển thành array
      setSentRequests(Object.values(sentResult || {}));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(`Lỗi tải danh sách: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Tự động tải data khi component được mount
  useEffect(() => {
    handleFetchData();
  }, []);

  const handleAcceptRequest = async (userId: string) => {
    if (loadingActionId) return;
    setLoadingActionId(userId);
    setError(null);
    try {
      await acceptFriendRequestAction(userId);
      // Tải lại data sau khi thành công
      handleFetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(`Lỗi chấp nhận: ${msg}`);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleUndoRequest = async (userId: string) => {
    if (loadingActionId) return;
    setLoadingActionId(userId);
    setError(null);
    try {
      await undoFriendRequestAction(userId);
      // Tải lại data sau khi thành công
      handleFetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(`Lỗi thu hồi: ${msg}`);
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div className="rounded-lg bg-gray-800 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="mb-3 text-xl font-semibold text-white">
          Quản lý Lời mời
        </h2>
        <button
          onClick={handleFetchData}
          disabled={isLoading}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
          title="Tải lại"
        >
          <IconRefresh
            className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* --- Tabs --- */}
      <div className="mb-3 flex rounded-lg bg-gray-700 p-1">
        <button
          onClick={() => setTab("recommended")}
          className={`w-1/2 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "recommended"
              ? "bg-blue-600 text-white shadow"
              : "text-gray-300 hover:bg-gray-600"
          }`}
        >
          Gợi ý cho bạn ({recommendations.length})
        </button>
        <button
          onClick={() => setTab("sent")}
          className={`w-1/2 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "sent"
              ? "bg-blue-600 text-white shadow"
              : "text-gray-300 hover:bg-gray-600"
          }`}
        >
          Đã gửi ({sentRequests.length})
        </button>
      </div>

      {/* --- Hiển thị Lỗi --- */}
      {error && (
        <p className="my-2 text-center text-sm text-red-400">{error}</p>
      )}

      {/* --- Container Danh sách --- */}
      <div className="flex h-64 flex-col gap-3 overflow-y-auto pr-2">
        {/* Tab: Gợi ý cho bạn */}
        {tab === "recommended" && (
          <>
            {recommendations.length === 0 && !isLoading && (
              <p className="pt-4 text-center text-sm text-gray-500">
                Không có gợi ý kết bạn nào.
              </p>
            )}
            {recommendations.map((item) => (
              <div
                key={item.dataInfo.userId}
                className="flex items-center gap-3 rounded-lg bg-gray-700/50 p-2"
              >
                <Avatar
                  src={item.dataInfo.avatar}
                  alt={item.dataInfo.displayName}
                />
                <div className="flex-1 overflow-hidden">
                  <h4 className="truncate font-medium text-white">
                    {item.dataInfo.displayName}
                  </h4>
                  <p className="truncate text-xs text-gray-400">
                    {item.dataInfo.recommInfo.message}
                  </p>
                </div>
                <button
                  onClick={() => handleAcceptRequest(item.dataInfo.userId)}
                  disabled={loadingActionId === item.dataInfo.userId}
                  className="flex flex-shrink-0 items-center justify-center rounded-lg bg-green-600 p-2 text-white transition-colors hover:bg-green-700 disabled:cursor-wait disabled:opacity-50"
                  title="Chấp nhận"
                >
                  <IconCheck className="h-5 w-5" />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Tab: Đã gửi */}
        {tab === "sent" && (
          <>
            {sentRequests.length === 0 && !isLoading && (
              <p className="pt-4 text-center text-sm text-gray-500">
                Không có lời mời đã gửi nào.
              </p>
            )}
            {sentRequests.map((req) => (
              <div
                key={req.userId}
                className="flex items-center gap-3 rounded-lg bg-gray-700/50 p-2"
              >
                <Avatar src={req.avatar} alt={req.displayName} />
                <div className="flex-1 overflow-hidden">
                  <h4 className="truncate font-medium text-white">
                    {req.displayName}
                  </h4>
                  <p className="truncate text-xs text-gray-400 italic">
                    &quot;{req.fReqInfo.message}&quot;
                  </p>
                </div>
                <button
                  onClick={() => handleUndoRequest(req.userId)}
                  disabled={loadingActionId === req.userId}
                  className="flex flex-shrink-0 items-center justify-center rounded-lg bg-gray-600 p-2 text-white transition-colors hover:bg-gray-500 disabled:cursor-wait disabled:opacity-50"
                  title="Thu hồi lời mời"
                >
                  <IconClose className="h-5 w-5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
/**
 * THÊM MỚI (GĐ 3.7): Component con Tạo Nhóm
 */
function CreateGroupPanel({
  friendsList,
  onGroupCreated,
}: {
  friendsList: ThreadInfo[];
  onGroupCreated: () => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleToggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (!groupName || selectedMemberIds.length === 0 || isLoading) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await createGroupAction({
        name: groupName,
        members: selectedMemberIds,
        // avatarSource: Tạm thời bỏ qua, sẽ thêm ở GĐ sau
      });
      setSuccess(`Tạo nhóm "${groupName}" thành công!`);
      // Reset form
      setGroupName("");
      setSelectedMemberIds([]);
      // Làm mới danh sách hội thoại (Module 2)
      onGroupCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(`Lỗi tạo nhóm: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="rounded-lg bg-gray-800 p-4 shadow-lg">
      <h2 className="mb-3 text-xl font-semibold text-white">Tạo nhóm mới</h2>
      <div className="flex flex-col gap-4">
        {/* Tên nhóm */}
        <div>
          <label
            htmlFor="group-name"
            className="mb-1 block text-sm font-medium text-gray-300"
          >
            Tên nhóm
          </label>
          <input
            id="group-name"
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ví dụ: Nhóm gia đình..."
            className="w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Danh sách bạn bè */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">
            Chọn thành viên (Đã chọn: {selectedMemberIds.length})
          </label>
          <div className="h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/50 p-2">
            {friendsList.length === 0 && (
              <p className="pt-4 text-center text-sm text-gray-500">
                Không tìm thấy bạn bè (Hãy tải lại danh sách chat).
              </p>
            )}
            {friendsList.map((friend) => (
              <button
                key={friend.id}
                onClick={() => handleToggleMember(friend.id)}
                className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                  selectedMemberIds.includes(friend.id)
                    ? "bg-blue-800"
                    : "hover:bg-gray-700"
                }`}
              >
                <Avatar src={friend.avatar} alt={friend.name} />
                <span className="flex-1 truncate text-white">
                  {friend.name}
                </span>
                {selectedMemberIds.includes(friend.id) && (
                  <IconCheck className="h-5 w-5 flex-shrink-0 text-blue-300" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Nút Tạo nhóm */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !groupName || selectedMemberIds.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-wait disabled:opacity-50"
        >
          <IconUsers className="h-5 w-5" />
          {isLoading ? "Đang tạo..." : "Tạo nhóm"}
        </button>

        {/* Kết quả */}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        {success && (
          <p className="text-center text-sm text-green-400">{success}</p>
        )}
      </div>
    </div>
  );
}

// SỬA ĐỔI (GĐ 3.7): Nhận props và lọc danh sách bạn bè
export function ManagementPanel({
  selectedThread,
  threads,
  onRefreshThreads,
  // THÊM MỚI (Lô 4): Props cho User Cache
  userCache,
  onStartManualScan,
  isScanningAll,
  scanStatus,
}: {
  selectedThread: ThreadInfo | null;
  threads: ThreadInfo[];
  onRefreshThreads: () => void;
  // THÊM MỚI (Lô 4)
  userCache: Record<string, UserCacheEntry>;
  onStartManualScan: () => void;
  isScanningAll: boolean;
  scanStatus: string;
}) {
  // Lọc danh sách chỉ lấy Bạn bè (type 0)
  const friendsList = threads.filter((t) => t.type === 0);

  return (
    <div className="flex-1 flex-col overflow-y-auto bg-gray-850 p-6">
      <h1 className="mb-6 text-3xl font-bold text-white">
        Bảng điều khiển Quản lý
      </h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* --- Tính năng 1: Kết bạn --- */}
        <AddFriendPanel />

        {/* SỬA ĐỔI (GĐ 3.6): Thay thế placeholder */}
        {/* --- Tính năng 2: Quản lý Lời mời --- */}
        <FriendRequestManager />

        {/* SỬA ĐỔI (GĐ 3.7): Thay thế placeholder */}
        {/* --- Tính năng 3: Tạo nhóm --- */}
        <CreateGroupPanel
          friendsList={friendsList}
          onGroupCreated={onRefreshThreads}
        />

        <AdvancedGroupManager
          selectedThread={selectedThread}
          threads={threads}
        />

        {/* THÊM MỚI (Lô 4): Bảng Thống kê Cache */}
        <UserDatabasePanel
          userCache={userCache}
          threads={threads}
          onStartManualScan={onStartManualScan}
          isScanningAll={isScanningAll}
          scanStatus={scanStatus}
        />
      </div>
    </div>
  );
}

// THÊM MỚI (GĐ 3.5): CSS cho animation (nếu cần)
// (Tailwind đã xử lý, nhưng nếu cần custom keyframes, chúng ta sẽ thêm vào globals.css)
// Ví dụ:
// @keyframes fadeIn {
//   from { opacity: 0; transform: translateY(-10px); }
//   to { opacity: 1; transform: translateY(0); }
// }
// .animate-fadeIn {
//   animation: fadeIn 0.3s ease-out;
// }
// (Tôi sẽ dùng class `animate-fadeIn` giả định, bạn có thể thêm CSS này vào globals.css nếu muốn)
