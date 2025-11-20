/**
 * lib/models/profile.model.ts
 *
 * (TỆP MỚI)
 * Tầng Model (Repository) cho bảng 'profiles'.
 * Cung cấp các hàm CRUD để thao tác với dữ liệu người dùng Zalo.
 */
import supabase from "@/lib/supabaseClient";

// Định nghĩa kiểu dữ liệu (match với SQL schema)
export type Profile = {
  id: string; // Zalo User ID
  name: string;
  avatar?: string;
  is_friend?: boolean;
  phone_number?: string;
};

/**
 * Lấy một profile bằng Zalo User ID
 * @param id Zalo User ID
 */
export async function getProfileById(id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = "No rows found" (Không tìm thấy)
    console.error("[Profile Model] Lỗi getProfileById:", error);
    throw error;
  }
  return data;
}

/**
 * Lấy tất cả profiles
 */
export async function getAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) {
    console.error("[Profile Model] Lỗi getAllProfiles:", error);
    throw error;
  }
  return data;
}

/**
 * Thêm mới hoặc Cập nhật (Upsert) một profile
 * @param profile Dữ liệu profile (phải chứa 'id')
 */
export async function upsertProfile(profile: Profile) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        ...profile,
        updated_at: new Date().toISOString(), // Cập nhật thời gian
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[Profile Model] Lỗi upsertProfile:", error);
    throw error;
  }
  return data;
}

/**
 * Xóa một profile
 * @param id Zalo User ID
 */
export async function deleteProfile(id: string) {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) {
    console.error("[Profile Model] Lỗi deleteProfile:", error);
    throw error;
  }
  return true;
}
