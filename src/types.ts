export type JsonMap = Record<string, unknown>;

export type ApiSettings = {
  baseUrl: string;
  apiKey: string;
  accessToken: string;
  refreshToken: string;
};

export type APIRequestInit = RequestInit & {
  auth?: "none" | "session" | "apiKey" | "any";
  skipAuth?: boolean;
};

export type LoadState = {
  loading: boolean;
  error: string;
  data: unknown;
};
