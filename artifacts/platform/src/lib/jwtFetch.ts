export function jwtFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("pro_token");
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}
