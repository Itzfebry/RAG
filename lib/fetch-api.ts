/**
 * Typed fetch helper untuk semua call ke backend FastAPI.
 *
 * - Menangani parsing JSON, error extraction (`detail`/`message`/`error`),
 *   dan network failure dengan pesan Indonesia yang konsisten.
 * - Semua call menyertakan credentials (cookie auth backend).
 *
 * Contoh:
 *   const me = await fetchApi<Me>("/api/python/user/me");
 *   // atau versi non-throw untuk handler UI:
 *   const { ok, data, error } = await tryFetch<LoginRes>("/api/python/user/login", { json: payload }, "Login gagal");
 */

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/** Ekstrak teks error dari berbagai bentuk body backend. */
function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["detail", "message", "error"]) {
      const v = d[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return fallback;
}

type FetchApiInit = RequestInit & { json?: unknown };

export async function fetchApi<T = unknown>(
  path: string,
  init: FetchApiInit = {},
  { fallbackError = "Gagal terhubung ke server" }: { fallbackError?: string } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      credentials: "include",
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : null),
        ...(headers ?? {}),
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : null),
    });
  } catch (e) {
    // Di dev, sertakan penyebab asli (mis. "Failed to fetch" / ERR_CONNECTION_REFUSED)
    // supaya masalah jaringan tidak disembunyikan generik message.
    const detail =
      process.env.NODE_ENV !== "production" && e instanceof Error && e.message
        ? `${fallbackError} (${e.message})`
        : fallbackError;
    throw new ApiError(detail, 0);
  }

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(extractMessage(data, `Request gagal (${res.status})`), res.status, data);
  }
  return (data ?? ({} as T)) as T;
}

/** Versi non-throw: mengembalikan hasil atau pesan error rapi untuk UI. */
export async function tryFetch<T = unknown>(
  path: string,
  init: FetchApiInit = {},
  fallbackError?: string,
): Promise<{ ok: true; data: T } | { ok: false; data: null; error: string }> {
  try {
    const data = await fetchApi<T>(path, init, fallbackError ? { fallbackError } : undefined);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, data: null, error: apiErrorMessage(e, fallbackError) };
  }
}

/** Pesan error manusiawi untuk ditampilkan di UI. */
export function apiErrorMessage(e: unknown, fallback = "Terjadi kesalahan. Coba lagi."): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
