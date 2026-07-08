"use client";

import { createClient } from "./client";

export const PROFILE_PICTURE_BUCKET = "profile_pictures";

function resolveFileExtension(file: File): string {
  const rawExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const sanitized = rawExtension.replace(/[^a-z0-9]/g, "");
  return sanitized || "png";
}

export async function uploadProfilePicture(userId: number | string, file: File): Promise<string> {
  const supabase = createClient();
  const fileExtension = resolveFileExtension(file);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  const ownerSegment =
    typeof user?.id === "string" && user.id.trim().length > 0 ? user.id.trim() : String(userId).trim();

  if (userError || !ownerSegment) {
    throw new Error("Unable to resolve the authenticated user for this profile picture upload.");
  }

  const filePath = `users/${ownerSegment}/avatar.${fileExtension}`;

  const { error: uploadError } = await supabase.storage.from(PROFILE_PICTURE_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(PROFILE_PICTURE_BUCKET).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("Unable to resolve the public URL for this profile picture.");
  }

  return data.publicUrl;
}
