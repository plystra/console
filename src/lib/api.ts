import { ApiSettings, JsonMap } from "@/types";

export function defaultSettings(): ApiSettings {
  const legacyAccessToken = localStorage.getItem("plystra.console.accessToken") || "";
  if (legacyAccessToken) {
    localStorage.removeItem("plystra.console.accessToken");
  }
  const legacyAPIKey = localStorage.getItem("plystra.console.apiKey") || "";
  if (legacyAPIKey) {
    sessionStorage.setItem("plystra.console.apiKey", legacyAPIKey);
    localStorage.removeItem("plystra.console.apiKey");
  }
  return {
    baseUrl: localStorage.getItem("plystra.console.baseUrl") || import.meta.env.VITE_PLYSTRA_API_URL || "http://localhost:8080",
    apiKey: sessionStorage.getItem("plystra.console.apiKey") || "",
    accessToken: sessionStorage.getItem("plystra.console.accessToken") || "",
    refreshToken: sessionStorage.getItem("plystra.console.refreshToken") || "",
  };
}

export function endpointUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function asMap(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonMap) : {};
}

export function unwrapData(payload: unknown): unknown {
  const map = asMap(payload);
  return "data" in map ? map.data : payload;
}

export function unwrapList(payload: unknown): JsonMap[] {
  const data = unwrapData(payload);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((item) => asMap(item));
}

export function unwrapDataMap(payload: unknown): JsonMap {
  return asMap(unwrapData(payload));
}

export function envelopeCount(payload: unknown) {
  const map = asMap(payload);
  const pagination = asMap(map.pagination);
  const total = pagination.total;
  if (typeof total === "number") {
    return total;
  }
  return unwrapList(payload).length;
}

export function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function apiErrorText(payload: unknown, fallback: string) {
  const errorMap = asMap(asMap(payload).error);
  const message = valueText(errorMap.message || fallback);
  const code = valueText(errorMap.code);
  const requestID = valueText(errorMap.request_id || asMap(payload).request_id);
  const suffix = [
    code !== "-" ? code : "",
    requestID !== "-" ? `request_id=${requestID}` : "",
  ].filter(Boolean);
  return suffix.length > 0 ? `${message} (${suffix.join(", ")})` : message;
}

export function isAllowDecision(value: unknown) {
  const data = asMap(unwrapData(value));
  return data.allow === true || data.decision === "allow";
}
