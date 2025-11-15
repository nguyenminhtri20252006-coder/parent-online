"use server";

/**
 * lib/actions/group.actions.ts
 *
 * Lớp Logic (Server Actions - Lớp 2) - Nghiệp vụ Quản lý Nhóm.
 */
import { ZaloSingletonService } from "@/lib/runtime-service";
// SỬA ĐỔI (GĐ 3.8): Import thêm types
import {
  CreateGroupOptions,
  GetGroupLinkDetailResponse,
  GetPendingGroupMembersResponse,
  ReviewPendingMemberRequestPayload,
  ReviewPendingMemberRequestStatus,
  UpdateGroupSettingsOptions,
  // THÊM MỚI (GĐ 3.10)
  GroupInfoResponse,
  GetGroupMembersInfoResponse,
} from "@/lib/types/zalo.types";

/**
 * [API] Tạo nhóm mới
 */
export async function createGroupAction(options: CreateGroupOptions) {
  console.log(`[Action] Yêu cầu createGroupAction: ${options.name}`);
  try {
    return await ZaloSingletonService.getInstance().createGroup(options);
  } catch (error: unknown) {
    console.error("[Action Error] createGroupAction:", error);
    throw new Error(error instanceof Error ? error.message : "Lỗi tạo nhóm");
  }
}

/**
 * [API] Lấy thông tin chi tiết (Info) của nhóm
 */
export async function getGroupInfoAction(
  groupId: string | string[],
): Promise<GroupInfoResponse> {
  console.log(`[Action] Yêu cầu getGroupInfoAction cho nhóm: ${groupId}`);
  try {
    return await ZaloSingletonService.getInstance().getGroupInfo(groupId);
  } catch (error: unknown) {
    console.error("[Action Error] getGroupInfoAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi lấy thông tin nhóm",
    );
  }
}

/**
 * [API] Lấy thông tin (Profile) của thành viên nhóm
 */
export async function getGroupMembersInfoAction(
  memberId: string | string[],
): Promise<GetGroupMembersInfoResponse> {
  console.log(`[Action] Yêu cầu getGroupMembersInfoAction cho: ${memberId}`);
  try {
    return await ZaloSingletonService.getInstance().getGroupMembersInfo(
      memberId,
    );
  } catch (error: unknown) {
    console.error("[Action Error] getGroupMembersInfoAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi lấy thông tin thành viên",
    );
  }
}

/**
 * [API] Rời khỏi nhóm
 */
export async function leaveGroupAction(
  groupId: string,
  silent?: boolean,
): Promise<void> {
  console.log(`[Action] Yêu cầu leaveGroupAction: ${groupId}`);
  try {
    await ZaloSingletonService.getInstance().leaveGroup(groupId, silent);
  } catch (error: unknown) {
    console.error("[Action Error] leaveGroupAction:", error);
    throw new Error(error instanceof Error ? error.message : "Lỗi rời nhóm");
  }
}

/**
 * [API] Giải tán nhóm
 */
export async function disperseGroupAction(groupId: string): Promise<void> {
  console.log(`[Action] Yêu cầu disperseGroupAction: ${groupId}`);
  try {
    await ZaloSingletonService.getInstance().disperseGroup(groupId);
  } catch (error: unknown) {
    console.error("[Action Error] disperseGroupAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi giải tán nhóm",
    );
  }
}

/**
 * [API] Thêm thành viên vào nhóm
 */
export async function addUserToGroupAction(
  memberId: string | string[],
  groupId: string,
) {
  console.log(`[Action] Yêu cầu addUserToGroupAction: thêm vào ${groupId}`);
  try {
    return await ZaloSingletonService.getInstance().addUserToGroup(
      memberId,
      groupId,
    );
  } catch (error: unknown) {
    console.error("[Action Error] addUserToGroupAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi thêm thành viên",
    );
  }
}

/**
 * [API] Xóa thành viên khỏi nhóm
 */
export async function removeUserFromGroupAction(
  memberId: string | string[],
  groupId: string,
) {
  console.log(
    `[Action] Yêu cầu removeUserFromGroupAction: xóa khỏi ${groupId}`,
  );
  try {
    return await ZaloSingletonService.getInstance().removeUserFromGroup(
      memberId,
      groupId,
    );
  } catch (error: unknown) {
    console.error("[Action Error] removeUserFromGroupAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi xóa thành viên",
    );
  }
}

/**
 * [API] Lấy danh sách lời mời vào nhóm (chờ duyệt)
 */
export async function getGroupInviteBoxListAction(payload?: {
  mpage?: number;
  page?: number;
  invPerPage?: number;
  mcount?: number;
}) {
  console.log(`[Action] Yêu cầu getGroupInviteBoxListAction`);
  try {
    return await ZaloSingletonService.getInstance().getGroupInviteBoxList(
      payload,
    );
  } catch (error: unknown) {
    console.error("[Action Error] getGroupInviteBoxListAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi lấy danh sách lời mời",
    );
  }
}

/**
 * [API] Lấy danh sách thành viên chờ duyệt
 */
export async function getPendingGroupMembersAction(groupId: string) {
  console.log(
    `[Action] Yêu cầu getPendingGroupMembersAction cho nhóm: ${groupId}`,
  );
  try {
    return await ZaloSingletonService.getInstance().getPendingGroupMembers(
      groupId,
    );
  } catch (error: unknown) {
    console.error("[Action Error] getPendingGroupMembersAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi lấy danh sách chờ",
    );
  }
}

/**
 * [API] Duyệt thành viên
 */
export async function reviewPendingMemberRequestAction(
  payload: ReviewPendingMemberRequestPayload,
  groupId: string,
): Promise<Record<string, ReviewPendingMemberRequestStatus>> {
  console.log(
    `[Action] Yêu cầu reviewPendingMemberRequestAction cho nhóm: ${groupId}`,
  );
  try {
    return await ZaloSingletonService.getInstance().reviewPendingMemberRequest(
      payload,
      groupId,
    );
  } catch (error: unknown) {
    console.error("[Action Error] reviewPendingMemberRequestAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi duyệt thành viên",
    );
  }
}

/**
 * [API] Cập nhật cài đặt nhóm
 */
export async function updateGroupSettingsAction(
  options: UpdateGroupSettingsOptions,
  groupId: string,
) {
  console.log(
    `[Action] Yêu cầu updateGroupSettingsAction cho nhóm: ${groupId}`,
  );
  try {
    return await ZaloSingletonService.getInstance().updateGroupSettings(
      options,
      groupId,
    );
  } catch (error: unknown) {
    console.error("[Action Error] updateGroupSettingsAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi cập nhật cài đặt nhóm",
    );
  }
}

/**
 * [API] Lấy chi tiết link mời
 */
export async function getGroupLinkDetailAction(
  groupId: string,
): Promise<GetGroupLinkDetailResponse> {
  console.log(`[Action] Yêu cầu getGroupLinkDetailAction cho nhóm: ${groupId}`);
  try {
    return await ZaloSingletonService.getInstance().getGroupLinkDetail(groupId);
  } catch (error: unknown) {
    console.error("[Action Error] getGroupLinkDetailAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi lấy chi tiết link",
    );
  }
}

/**
 * [API] Bật link mời nhóm
 */
export async function enableGroupLinkAction(groupId: string) {
  console.log(`[Action] Yêu cầu enableGroupLinkAction: ${groupId}`);
  try {
    return await ZaloSingletonService.getInstance().enableGroupLink(groupId);
  } catch (error: unknown) {
    console.error("[Action Error] enableGroupLinkAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi bật link nhóm",
    );
  }
}

/**
 * [API] Tắt link mời nhóm
 */
export async function disableGroupLinkAction(groupId: string): Promise<void> {
  console.log(`[Action] Yêu cầu disableGroupLinkAction: ${groupId}`);
  try {
    await ZaloSingletonService.getInstance().disableGroupLink(groupId);
  } catch (error: unknown) {
    console.error("[Action Error] disableGroupLinkAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi tắt link nhóm",
    );
  }
}

/**
 * [API] Chấp nhận lời mời vào nhóm
 */
export async function joinGroupInviteBoxAction(groupId: string): Promise<void> {
  console.log(`[Action] Yêu cầu joinGroupInviteBoxAction: ${groupId}`);
  try {
    await ZaloSingletonService.getInstance().joinGroupInviteBox(groupId);
  } catch (error: unknown) {
    console.error("[Action Error] joinGroupInviteBoxAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi chấp nhận lời mời nhóm",
    );
  }
}

/**
 * [API] Từ chối/Xóa lời mời vào nhóm
 */
export async function deleteGroupInviteBoxAction(
  groupId: string | string[],
  blockFutureInvite?: boolean,
) {
  console.log(`[Action] Yêu cầu deleteGroupInviteBoxAction: ${groupId}`);
  try {
    return await ZaloSingletonService.getInstance().deleteGroupInviteBox(
      groupId,
      blockFutureInvite,
    );
  } catch (error: unknown) {
    console.error("[Action Error] deleteGroupInviteBoxAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi từ chối lời mời nhóm",
    );
  }
}

/**
 * [API] Lấy thông tin từ link mời (cho người ngoài nhóm)
 */
export async function getGroupLinkInfoAction(link: string) {
  console.log(`[Action] Yêu cầu getGroupLinkInfoAction: ${link}`);
  try {
    return await ZaloSingletonService.getInstance().getGroupLinkInfo(link);
  } catch (error: unknown) {
    console.error("[Action Error] getGroupLinkInfoAction:", error);
    throw new Error(
      error instanceof Error ? error.message : "Lỗi lấy thông tin link",
    );
  }
}
