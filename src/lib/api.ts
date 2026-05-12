import { ApiSettings, JsonMap } from "@/types";

export function defaultSettings(): ApiSettings {
  return {
    baseUrl: localStorage.getItem("plystra.console.baseUrl") || import.meta.env.VITE_PLYSTRA_API_URL || "http://localhost:8080",
    accessToken: localStorage.getItem("plystra.console.accessToken") || "",
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

export function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function isAllowDecision(value: unknown) {
  const data = asMap(unwrapData(value));
  return data.allow === true || data.decision === "allow";
}
