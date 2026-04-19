import { setAuthTokenGetter } from "@workspace/api-client-react";

// The generated API hooks already include /api prefix in their URLs
// (from openapi.yaml servers[0].url = /api), so we don't need setBaseUrl here.
// We only need to attach the JWT token to protected requests.
setAuthTokenGetter(() => {
  return localStorage.getItem("pro_token");
});

export function getApiBaseUrl(): string {
  return "/api";
}

export const BASE_URL = "/api";
