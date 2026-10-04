import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@/lib/categories";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/admin/" },
    sitemap: getAbsoluteUrl("/sitemap.xml"),
  };
}