import type { MetadataRoute } from "next";

const baseUrl = "https://tcoin.me";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/ecosystem`,
      lastModified: new Date(),
    },
  ];
}
