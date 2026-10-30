import { useSyncExternalStore } from "react";

export type AppRoute =
  | { page: "home" }
  | { page: "products" }
  | { page: "product"; slug: string }
  | { page: "settings" }
  | { page: "auth" }
  | { page: "not-found" };

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function getSnapshot() { return window.location.hash.slice(1) || "/"; }
function getServerSnapshot() { return "/"; }

export function useHashPath() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
export function navigate(path: string) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}
export function routeFromPath(path: string): AppRoute {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (clean === "/") return { page: "home" };
  if (clean === "/products") return { page: "products" };
  if (clean === "/settings") return { page: "settings" };
  if (clean === "/auth") return { page: "auth" };
  const match = clean.match(/^\/products\/([a-z0-9-]+)$/);
  if (match) return { page: "product", slug: match[1] };
  return { page: "not-found" };
}
