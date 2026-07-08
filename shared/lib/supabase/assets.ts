const DEFAULT_TCOIN_BANNER_LIGHT_URL =
  "https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-light-mode.png";
const DEFAULT_TCOIN_BANNER_DARK_URL =
  "https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-dark-mode-2.jpeg";

export const TCOIN_BANNER_LIGHT_URL =
  process.env.NEXT_PUBLIC_TCOIN_BANNER_LIGHT_URL?.trim() || DEFAULT_TCOIN_BANNER_LIGHT_URL;

export const TCOIN_BANNER_DARK_URL =
  process.env.NEXT_PUBLIC_TCOIN_BANNER_DARK_URL?.trim() || DEFAULT_TCOIN_BANNER_DARK_URL;

export const TCOIN_WELCOME_VIDEO_URL = process.env.NEXT_PUBLIC_TCOIN_WELCOME_VIDEO_URL?.trim() || "";
