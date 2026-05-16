export type JsonMap = Record<string, unknown>;

export type ApiSettings = {
  baseUrl: string;
  apiKey: string;
};

export type APIRequestInit = RequestInit & {
  skipAuth?: boolean;
};

export type LoadState = {
  loading: boolean;
  error: string;
  data: unknown;
};
