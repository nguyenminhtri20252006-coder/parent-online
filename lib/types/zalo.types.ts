/**
 * lib/types/zalo.types.ts
 *
 * Nguồn sự thật duy nhất (SSOT) cho tất cả các kiểu dữ liệu (Types)
 * và hằng số (Constants) của Zalo trong toàn bộ dự án.
 */

// Import các kiểu gốc từ 'zca-js' mà chúng ta muốn mở rộng hoặc tham chiếu
import {
  User,
  GroupInfo,
  ZBusinessPackage,
  Gender,
  AttachmentSource,
  GroupTopic,
  GroupSetting,
  FindUserResponse,
  GetSentFriendRequestResponse,
  GetFriendRecommendationsResponse,
  CreateGroupOptions,
  CreateGroupResponse,
  GetAllGroupsResponse,
  GroupInfoResponse,
  GetGroupMembersInfoResponse,
  AddUserToGroupResponse,
  RemoveUserFromGroupResponse,
  GetGroupBlockedMemberResponse,
  GetGroupInviteBoxListResponse,
  GetPendingGroupMembersResponse,
  ReviewPendingMemberRequestResponse,
  UpdateGroupSettingsResponse,
  GetGroupLinkDetailResponse,
  FriendRecommendationsRecommItem,
  SentFriendRequestInfo,
  GetPendingGroupMembersUserInfo,
  ReviewPendingMemberRequestStatus,
  GroupMemberProfile,
} from "zca-js";

// --- CÁC HẰNG SỐ (CONSTANTS) ---

export const ZALO_EVENTS = {
  // Sự kiện khi QR được tạo (gửi QR base64)
  QR_GENERATED: "qr_generated",
  // Sự kiện khi đăng nhập thành công
  LOGIN_SUCCESS: "login_success",
  // Sự kiện khi đăng nhập thất bại
  LOGIN_FAILURE: "login_failure",
  // Sự kiện khi có tin nhắn mới (gửi payload tin nhắn)
  NEW_MESSAGE: "new_message",
  // Báo cáo trạng thái chung
  STATUS_UPDATE: "status_update",
  // THÊM MỚI: Sự kiện khi session (token) được tạo/sẵn sàng
  SESSION_GENERATED: "session_generated",
};

// --- CÁC KIỂU DỮ LIỆU (TYPES) CƠ BẢN ---

/**
 * Trạng thái đăng nhập của Ứng dụng
 */
export type LoginState = "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR";

/**
 * Payload tin nhắn Zalo (từ zca-js)
 */
export type ZaloMessage = {
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

/**
 * Thông tin tài khoản (Bot) đã đăng nhập.
 * (Trích xuất từ 'User' của zca-js)
 */
export type AccountInfo = {
  userId: string;
  displayName: string;
  avatar: string;
};

/**
 * Thông tin hội thoại (đã hợp nhất).
 * (Trích xuất từ 'User' hoặc 'GroupInfo' của zca-js)
 */
export type ThreadInfo = {
  id: string; // userId (bạn bè) hoặc groupId (nhóm)
  name: string; // displayName (bạn bè) hoặc name (nhóm)
  avatar: string; // avatar (cả hai)
  type: 0 | 1; // 0 = User, 1 = Group
};

/**
 * Định nghĩa kiểu dữ liệu cho Credentials/Session
 */
export type ZaloCredentials = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cookie: any;
  imei: string;
  userAgent: string;
};

/**
 * Định nghĩa kiểu dữ liệu 'ZaloUser' (Linh hoạt)
 * (Dùng riêng cho getAccountInfo vì cấu trúc trả về là { profile: ... })
 */
export type ZaloUser = {
  userId: string;
  displayName: string;
  zaloName: string;
  avatar: string;
};

// --- TYPES CHO API (Dựa trên tài liệu) ---
// (Đây là các kiểu dữ liệu placeholder để Lớp Action và Service có thể biên dịch)
// (Chúng ta sẽ định nghĩa chúng đầy đủ hơn khi cần)

// PHẦN 1: QUẢN LÝ BẠN BÈ
export type {
  User,
  FindUserResponse,
  GetSentFriendRequestResponse,
  GetFriendRecommendationsResponse,
};

// PHẦN 2: QUẢN LÝ NHÓM
export type {
  GroupInfo,
  CreateGroupOptions,
  CreateGroupResponse,
  GetAllGroupsResponse,
  GroupInfoResponse,
  GetGroupMembersInfoResponse,
  AddUserToGroupResponse,
  RemoveUserFromGroupResponse,
  GetGroupBlockedMemberResponse,
  GetGroupInviteBoxListResponse,
  GetPendingGroupMembersResponse,
  ReviewPendingMemberRequestResponse,
  UpdateGroupSettingsResponse,
  GetGroupLinkDetailResponse,
  FriendRecommendationsRecommItem,
  SentFriendRequestInfo,
  GetPendingGroupMembersUserInfo,
  ReviewPendingMemberRequestStatus,
  GroupMemberProfile,
};

// Placeholder cho các kiểu phức tạp hơn (nếu zca-js không export)
export type ReviewPendingMemberRequestPayload = {
  members: string | string[];
  isApprove: boolean;
};

export type UpdateGroupSettingsOptions = {
  blockName?: boolean;
  signAdminMsg?: boolean;
  setTopicOnly?: boolean;
  enableMsgHistory?: boolean;
  joinAppr?: boolean;
  lockCreatePost?: boolean;
  lockCreatePoll?: boolean;
  lockSendMsg?: boolean;
  lockViewMember?: boolean;
};

export type ViewState = "chat" | "manage";
