import { defineConfig } from "vite";

function normalizeBasePath(basePath?: string): string {
  if (!basePath || basePath === "/") {
    return "/";
  }

  return `/${basePath.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  base: normalizeBasePath(process.env.BASE_PATH),
});
