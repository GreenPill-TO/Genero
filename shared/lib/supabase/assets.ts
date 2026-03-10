const TRANSPARENT_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function readPublicEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export const TCOIN_BANNER_LIGHT_URL =
  readPublicEnv("NEXT_PUBLIC_TCOIN_BANNER_LIGHT_URL") || TRANSPARENT_IMAGE_DATA_URL;

export const TCOIN_BANNER_DARK_URL =
  readPublicEnv("NEXT_PUBLIC_TCOIN_BANNER_DARK_URL") || TRANSPARENT_IMAGE_DATA_URL;

export const TCOIN_WELCOME_VIDEO_URL = readPublicEnv("NEXT_PUBLIC_TCOIN_WELCOME_VIDEO_URL");
