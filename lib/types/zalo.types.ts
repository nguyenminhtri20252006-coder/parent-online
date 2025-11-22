/**
 * lib/types/zalo.types.ts
 * Nguồn sự thật duy nhất (SSOT).
 * Đã loại bỏ hoàn toàn 'any' và thay thế bằng Strict Types.
 */

import type {
  User,
  GroupInfo,
  MessageContent as ZcaMessageContent, // Import gốc
  FindUserResponse,
  GetFriendRecommendationsResponse,
  GetSentFriendRequestResponse,
  CreateGroupOptions,
  GroupInfoResponse,
  GetGroupMembersInfoResponse,
  GroupMemberProfile,
  // Import API để mở rộng type nếu cần
  API,
  // Import các Response Types từ zca-js để re-export
  ReviewPendingMemberRequestResponse,
  GetGroupLinkDetailResponse,
} from "zca-js";

// =============================================================================
// 1. FIX LỖI THIẾU TYPE CỦA THƯ VIỆN (Type Augmentation/Workaround)
// =============================================================================

// Type cho API Gửi Media (Proxy)
export interface SendVoiceOptions {
  voiceUrl: string;
  ttl?: number;
}

export interface SendVideoOptions {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
  msg?: string;
  ttl?: number;
}

export interface SendLinkOptions {
  link: string;
  msg?: string;
  ttl?: number;
}

// Type cho Group Actions
export interface ReviewPendingMemberRequestPayload {
  members: string[];
  isApprove: boolean;
}

export interface ReviewPendingMemberRequestStatus {
  uid: string;
  status: number; // 0: Failed, 1: Success
  error?: string;
}

export interface UpdateGroupSettingsOptions {
  blockName?: boolean;
  signAdminMsg?: boolean;
  setTopicOnly?: boolean;
  enableMsgHistory?: boolean;
  joinAppr?: boolean;
  lockCreatePost?: boolean;
  lockCreatePoll?: boolean;
  lockSendMsg?: boolean;
  lockViewMember?: boolean;
}

// Định nghĩa lại interface mở rộng cho API nếu thư viện thiếu type sendImage
export interface ExtendedAPI extends API {
  sendImage(
    buffer: Buffer,
    threadId: string,
    type: number, // 0: User, 1: Group
    caption?: string,
  ): Promise<void>;
}

// Type cho tham số getGroupInviteBoxList (Fix lỗi any trong hình 1)
export interface GroupInviteBoxParams {
  mpage?: number;
  page?: number;
  invPerPage?: number;
  mcount?: number;
}

// Type cho QR Callback Data
export type QRCallbackData =
  | string
  | {
      data?: {
        image?: string;
      };
    };

// =============================================================================
// 2. RAW TYPES (Dữ liệu thô từ ZCA Listener)
// =============================================================================

export interface RawZaloMessageData {
  msgId: string;
  cliMsgId: string;
  msgType: string;
  uidFrom: string;
  dName: string;
  ts: string;
  content: unknown;
  quote?: {
    ownerId: string;
    msg: string;
    attach?: string;
    fromD: string;
  };
  mentions?: Array<{
    uid: string;
    pos: number;
    len: number;
  }>;
}

export interface RawZaloMessage {
  type: number; // 0: User, 1: Group
  threadId: string;
  isSelf: boolean;
  data: RawZaloMessageData;
}

// =============================================================================
// 3. NORMALIZED CONTENT TYPES (Nội dung đã làm sạch)
// =============================================================================

export interface StandardSticker {
  id: number;
  cateId: number;
  type: number;
  url?: string;
}

export interface StandardPhoto {
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  size?: number;
}

export interface StandardVideo {
  url: string;
  thumbnail: string;
  duration: number;
  width: number;
  height: number;
}

export interface StandardVoice {
  url: string;
  duration: number;
}

export interface StandardLink {
  url: string;
  title: string;
  description: string;
  thumbnail?: string;
}

export type NormalizedContent =
  | { type: "text"; text: string; mentions?: unknown[] }
  | { type: "sticker"; data: StandardSticker }
  | { type: "photo"; data: StandardPhoto }
  | { type: "video"; data: StandardVideo }
  | { type: "voice"; data: StandardVoice }
  | { type: "link"; data: StandardLink }
  | { type: "unknown"; raw: unknown };

// =============================================================================
// 4. STANDARD MESSAGE OBJECT
// =============================================================================

export interface StandardMessage {
  msgId: string;
  threadId: string;
  isGroup: boolean;
  type: number; // Giữ lại raw type (0/1)
  isSelf: boolean;
  sender: {
    uid: string;
    name: string;
    avatar?: string;
  };
  timestamp: number;
  content: NormalizedContent;
  quote?: {
    text: string;
    senderId: string;
    attach?: string;
  };
}

// =============================================================================
// 5. CONSTANTS & ENUMS
// =============================================================================

export const ZALO_EVENTS = {
  QR_GENERATED: "qr_generated",
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILURE: "login_failure",
  NEW_MESSAGE: "new_message",
  STATUS_UPDATE: "status_update",
  SESSION_GENERATED: "session_generated",
} as const;

export enum ThreadType {
  User = 0,
  Group = 1,
}

export type LoginState = "IDLE" | "LOGGING_IN" | "LOGGED_IN" | "ERROR";
export type ViewState = "chat" | "manage";

export type UserCacheEntry = {
  id: string;
  name: string;
  avatar: string;
  isFriend: boolean;
  phoneNumber: string | null;
  commonGroups: Set<string>;
};

// Legacy aliases
export type ZaloMessage = RawZaloMessage;
export type AccountInfo = {
  userId: string;
  displayName: string;
  avatar: string;
};
export type ThreadInfo = {
  id: string;
  name: string;
  avatar: string;
  type: 0 | 1;
};

// FIX QUAN TRỌNG: Export Alias để các file cũ không bị lỗi import MessageContent
export type MessageContent = ZcaMessageContent;

export type {
  User,
  ZcaMessageContent,
  GroupInfo,
  FindUserResponse,
  GetFriendRecommendationsResponse,
  GetSentFriendRequestResponse,
  CreateGroupOptions,
  GroupInfoResponse,
  GetGroupMembersInfoResponse,
  GroupMemberProfile,
  API,
  ReviewPendingMemberRequestResponse,
  GetGroupLinkDetailResponse,
};
