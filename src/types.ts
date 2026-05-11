import type { ReactNode } from "react";

export type JsonMap = Record<string, unknown>;

export type ApiSettings = {
  baseUrl: string;
  accessToken: string;
};

export type APIRequestInit = RequestInit & {
  skipAuth?: boolean;
};

export type LoadState = {
  loading: boolean;
  error: string;
  data: unknown;
};

export type EndpointConfig = {
  key: string;
  label: string;
  path: string;
  description: string;
  icon: ReactNode;
  columns: string[];
};
