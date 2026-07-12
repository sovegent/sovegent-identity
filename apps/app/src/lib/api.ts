const API_URL = import.meta.env.VITE_API_URL ?? "https://api.identity.sovegent.com";

function getToken(): string | null { return localStorage.getItem("sovegent_token"); }
function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
  return res.json() as Promise<T>;
}

export { API_URL, getToken };
