/**
 * lib/types/zalo.types.ts
 *
 * Nguồn sự thật duy nhất (SSOT) cho tất cả các kiểu dữ liệu (Types)
 * và hằng số (Constants) của Zalo trong toàn bộ dự án.
 *
 * CẬP NHẬT (GĐ 5 - Sửa lỗi Build):
 * - Thay đổi TẤT CẢ import từ 'zca-js' thành 'import type' để ngăn
 * Next.js/Turbopack kéo runtime code của 'zca-js' (chứa 'node:fs')
 * vào Client Component bundle.
 * - Xóa import 'ThreadType' (là enum, một giá trị runtime) từ 'zca-js'.
 * - Định nghĩa 'ThreadType' cục bộ (locally) để sử dụng an toàn trong cả client và server.
 * - Thay đổi TẤT CẢ re-export từ 'zca-js' thành 'export type'.
 */

// Import CHỈ CÁC TYPES từ 'zca-js'
import type {
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
  // --- NÂNG CẤP ĐA PHƯƠNG TIỆN ---
  MessageContent,
  SendVoiceOptions,
  SendVoiceResponse,
  SendVideoOptions,
  SendVideoResponse,
  SendLinkOptions,
  SendLinkResponse,
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

// --- SỬA LỖI BUILD: Định nghĩa ThreadType cục bộ ---
// Đây là một enum, là một giá trị runtime.
// Import nó từ 'zca-js' sẽ kéo toàn bộ thư viện vào client.
// Định nghĩa nó ở đây sẽ giúp client an toàn.
export enum ThreadType {
  User = 0,
  Group = 1,
}

// --- CÁC KIỂU DỮ LIỆU (TYPES) CƠ BẢN ---

export type LoginState = "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR";

/**
 * THÊM MỚI: Định nghĩa Content Đa phương tiện
 */

// 1. Sticker Content (từ Log thực tế)
export interface ZaloStickerContent {
  id: number;
  catId: number; // Log trả về catId
  type: number;
}

// 2. Attachment Content (Photo, Link, File)
export interface ZaloAttachmentContent {
  title: string;
  description: string;
  href: string; // Link ảnh gốc hoặc Link web
  thumb: string; // Link thumbnail
  params?: string; // JSON string chứa width, height, duration...
}

// 3. Voice Content
export interface ZaloVoiceContent {
  href: string;
  params?: string; // Chứa duration
}

// 4. THÊM MỚI: Video Content
export interface ZaloVideoContent {
  href: string; // Link video (mp4)
  thumb: string; // Link thumbnail
  duration?: number; // Thời lượng (ms)
  fileSize?: number; // Kích thước file
  width?: number;
  height?: number;
  params?: string; // JSON string bổ sung
}

/**
 * Payload tin nhắn Zalo (Cấu trúc Hợp nhất)
 */
export type ZaloMessage = {
  threadId: string;
  isSelf: boolean;
  type: number; // 0: User, 1: Group
  data: {
    msgId: string;
    cliMsgId: string;
    // Các loại tin nhắn phổ biến: "webchat", "chat.photo", "chat.sticker", "chat.voice", "chat.recommended"
    msgType: string;
    uidFrom: string;
    dName: string;
    ts: string;

    // Content đa hình
    content:
      | string
      | ZaloStickerContent
      | ZaloAttachmentContent
      | ZaloVoiceContent
      | ZaloVideoContent; // <--- THÊM MỚI

    // Thông tin Reply
    quote?: {
      ownerId: string;
      msg: string;
      attach?: string;
      fromD: string;
    };

    // Thông tin Mention
    mentions?: Array<{
      uid: string;
      pos: number;
      len: number;
    }>;
  };
};

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
  id: string;
  name: string;
  avatar: string;
  type: 0 | 1;
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

// --- THÊM MỚI (NÂNG CẤP ĐA PHƯƠNG TIỆN) ---
// SỬA LỖI BUILD: Chỉ re-export 'type'
export type {
  MessageContent,
  SendVoiceOptions,
  SendVoiceResponse,
  SendVideoOptions,
  SendVideoResponse,
  SendLinkOptions,
  SendLinkResponse,
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

// --- THÊM MỚI: TYPES CHO API TỪ VỰNG (BÊN NGOÀI) ---

/**
 * Kiểu dữ liệu cho phần giải nghĩa (explanation) trong API từ vựng
 */
export type VocabularyExplanation = {
  term: string;
  type: string;
  meaning_vi: string;
};

/**
 * Kiểu dữ liệu cho một từ (word) trong API từ vựng
 */
export type VocabularyWord = {
  word: string;
  type: string; // [NEW] Từ loại (Noun, Verb...)
  ipa: string;
  meaning: string; // Nghĩa tiếng Việt
  usage?: string; // [NEW] Cách dùng (Optional)
  example: string;
  explanation: VocabularyExplanation[]; // List giải thích con

  // Media
  wordVoice?: string; // URL âm thanh
  wordImage?: string; // URL hình ảnh
  exampleVoice?: string; // URL âm thanh
};

/**
 * Kiểu dữ liệu cho toàn bộ phản hồi (response) từ API từ vựng
 */
export type VocabularyApiResponse = {
  id: number;
  count: number;
  words: VocabularyWord[];
};

// --- THÊM MỚI (Lô Cache): TYPES CHO BỘ ĐỆM (CACHE) NGƯỜI DÙNG ---

/**
 * Kiểu dữ liệu cho một mục (entry) trong User Cache.
 * Lưu trữ thông tin hợp nhất về một người dùng.
 */
export type UserCacheEntry = {
  id: string;
  name: string;
  avatar: string;
  isFriend: boolean;
  phoneNumber: string | null;
  commonGroups: Set<string>;
};

// Type cho getAllFriendsAction (Mảng User)
export type GetAllFriendsResponse = User[];
