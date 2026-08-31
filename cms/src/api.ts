export const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
export type Artwork = { kind: string; url: string };
export type Episode = {
  id: number;
  season_id: number;
  number: number;
  title: string;
  duration_seconds: number | null;
  language: string;
  content_group: string;
  status: string;
  artwork: Artwork[];
};
export type Season = {
  id: number;
  show_id: number;
  number: number;
  title: string;
  episodes?: Episode[];
};
export type Show = {
  id: number;
  title: string;
  slug: string;
  synopsis: string;
  section: string | null;
  categories: string[];
  status: string;
};
export type Issue = { message?: string; id?: number; content_group?: string };
export type Report = { blocking: boolean; issues: Record<string, Issue[]> };
export type Run = {
  id: number;
  actor: string;
  started_at: string;
  finished_at: string | null;
  outcome: string;
  show_count: number;
  episode_count: number;
  error?: string;
};
export type User = { name: string; role: "editor" | "admin" };
let token = localStorage.getItem("peblo-token") ?? "";
export const setToken = (value: string) => {
  token = value;
  localStorage.setItem("peblo-token", value);
};
export const getToken = () => token;
export const getCurrentUser = () => request<User>("/auth/me");
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (body.detail?.message) message = body.detail.message;
      else if (Array.isArray(body.detail))
        message =
          body.detail
            .map((item: { msg?: string }) => item.msg)
            .filter(Boolean)
            .join("; ") || message;
    } catch {
      /* non-json error */
    }
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const imageUrl = (url: string) =>
  url.startsWith("http") ? url : `${API}${url}`;
