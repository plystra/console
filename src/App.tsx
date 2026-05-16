import { Activity, Braces, FileClock, KeyRound, RefreshCw, Server, ShieldCheck, Workflow } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialAuthzRequest } from "@/config/endpoints";
import { apiErrorText, asMap, defaultSettings, endpointUrl, isAllowDecision, unwrapData, valueText } from "@/lib/api";
import { APIRequestInit, ApiSettings, LoadState } from "@/types";

export default function App() {
  const [settings, setSettings] = useState<ApiSettings>(() => defaultSettings());
  const [message, setMessage] = useState("");
  const [system, setSystem] = useState<Record<string, LoadState>>({
    health: { loading: false, error: "", data: null },
    ready: { loading: false, error: "", data: null },
    version: { loading: false, error: "", data: null },
  });
  const [capabilities, setCapabilities] = useState<LoadState>({ loading: false, error: "", data: null });
  const [registry, setRegistry] = useState<LoadState>({ loading: false, error: "", data: null });
  const [audit, setAudit] = useState<LoadState>({ loading: false, error: "", data: null });
  const [authzBody, setAuthzBody] = useState(initialAuthzRequest);
  const [authzResult, setAuthzResult] = useState<LoadState>({ loading: false, error: "", data: null });

  useEffect(() => {
    localStorage.setItem("plystra.console.baseUrl", settings.baseUrl);
    localStorage.removeItem("plystra.console.accessToken");
    localStorage.removeItem("plystra.console.apiKey");
    if (settings.apiKey.trim() === "") {
      sessionStorage.removeItem("plystra.console.apiKey");
    } else {
      sessionStorage.setItem("plystra.console.apiKey", settings.apiKey);
    }
  }, [settings]);

  useEffect(() => {
    void loadSystem();
  }, []);

  async function request(path: string, options: APIRequestInit = {}) {
    const { skipAuth, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);
    headers.set("Accept", "application/json");
    if (fetchOptions.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!skipAuth && settings.apiKey.trim() !== "") {
      headers.set("X-Plystra-API-Key", settings.apiKey.trim());
    }
    const response = await fetch(endpointUrl(settings.baseUrl, path), { ...fetchOptions, headers });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      payload = { error: { message: text || response.statusText } };
    }
    if (!response.ok) {
      throw new Error(apiErrorText(payload, response.statusText));
    }
    return payload;
  }

  async function loadSystem() {
    const endpoints = [
      ["health", "/api/v1/health"],
      ["ready", "/api/v1/ready"],
      ["version", "/api/v1/version"],
    ] as const;
    await Promise.all(
      endpoints.map(async ([key, path]) => {
        setSystem((current) => ({ ...current, [key]: { loading: true, error: "", data: current[key].data } }));
        try {
          const data = await request(path, { skipAuth: true });
          setSystem((current) => ({ ...current, [key]: { loading: false, error: "", data } }));
        } catch (error) {
          setSystem((current) => ({
            ...current,
            [key]: { loading: false, error: error instanceof Error ? error.message : "Request failed", data: null },
          }));
        }
      }),
    );
  }

  async function loadCapabilities() {
    setCapabilities((current) => ({ ...current, loading: true, error: "" }));
    try {
      setCapabilities({ loading: false, error: "", data: await request("/api/v1/capabilities") });
    } catch (error) {
      setCapabilities({ loading: false, error: error instanceof Error ? error.message : "Request failed", data: null });
    }
  }

  async function loadRegistry() {
    setRegistry((current) => ({ ...current, loading: true, error: "" }));
    try {
      setRegistry({ loading: false, error: "", data: await request("/api/v1/resource-types") });
    } catch (error) {
      setRegistry({ loading: false, error: error instanceof Error ? error.message : "Request failed", data: null });
    }
  }

  async function loadAudit() {
    setAudit((current) => ({ ...current, loading: true, error: "" }));
    try {
      setAudit({ loading: false, error: "", data: await request("/api/v1/audit/logs?limit=25") });
    } catch (error) {
      setAudit({ loading: false, error: error instanceof Error ? error.message : "Request failed", data: null });
    }
  }

  async function refreshProtected() {
    setMessage("Refreshing kernel state...");
    await loadSystem();
    if (settings.apiKey.trim() !== "") {
      await Promise.all([loadCapabilities(), loadRegistry(), loadAudit()]);
    }
    setMessage("Refresh complete.");
  }

  async function runAuthz(event: FormEvent) {
    event.preventDefault();
    setAuthzResult((current) => ({ ...current, loading: true, error: "" }));
    try {
      const body = JSON.parse(authzBody) as Record<string, unknown>;
      const data = await request("/api/v1/authz/explain", { method: "POST", body: JSON.stringify(body) });
      setAuthzResult({ loading: false, error: "", data });
      await loadAudit();
    } catch (error) {
      setAuthzResult({ loading: false, error: error instanceof Error ? error.message : "Request failed", data: null });
    }
  }

  const authzData = asMap(unwrapData(authzResult.data));

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[1fr_560px] lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-foreground bg-foreground text-background">
              <Workflow className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Plystra Kernel</h1>
              <p className="text-sm text-muted-foreground">Capability runtime and Context Mode authorization inspector.</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              aria-label="API base URL"
              value={settings.baseUrl}
              onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="http://localhost:8080"
            />
            <Input
              aria-label="API key"
              value={settings.apiKey}
              onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder="Server API key"
              type="password"
            />
            <Button onClick={() => void refreshProtected()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        {message ? <div className="border bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</div> : null}

        <section className="grid gap-3 md:grid-cols-3">
          <StatusBlock title="Health" icon={<Activity className="h-4 w-4" />} state={system.health} />
          <StatusBlock title="Readiness" icon={<Server className="h-4 w-4" />} state={system.ready} />
          <StatusBlock title="Version" icon={<Braces className="h-4 w-4" />} state={system.version} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="grid content-start gap-4">
            <Panel title="System Capabilities" action={<Button size="sm" variant="outline" onClick={() => void loadCapabilities()}>Load</Button>}>
              {capabilities.error ? <ErrorText>{capabilities.error}</ErrorText> : null}
              <JsonPreview value={unwrapData(capabilities.data) || []} />
            </Panel>

            <Panel title="Resource Registry" action={<Button size="sm" variant="outline" onClick={() => void loadRegistry()}>Load</Button>}>
              {registry.error ? <ErrorText>{registry.error}</ErrorText> : null}
              <JsonPreview value={unwrapData(registry.data) || []} />
            </Panel>

            <Panel title="Recent Audit" action={<Button size="sm" variant="outline" onClick={() => void loadAudit()}>Load</Button>}>
              {audit.error ? <ErrorText>{audit.error}</ErrorText> : null}
              <JsonPreview value={unwrapData(audit.data) || []} />
            </Panel>
          </aside>

          <section className="grid content-start gap-4">
            <Panel title="Authorization Inspector">
              <form className="grid gap-3" onSubmit={(event) => void runAuthz(event)}>
                <div className="grid gap-1">
                  <Label>Context Mode Request</Label>
                  <Textarea value={authzBody} onChange={(event) => setAuthzBody(event.target.value)} spellCheck={false} className="min-h-[420px]" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit">
                    <ShieldCheck className="h-4 w-4" />
                    Check Decision
                  </Button>
                  {authzResult.data ? (
                    <Badge variant={isAllowDecision(authzResult.data) ? "default" : "danger"}>
                      {valueText(authzData.decision)}
                    </Badge>
                  ) : null}
                  {authzResult.error ? <ErrorText>{authzResult.error}</ErrorText> : null}
                </div>
              </form>
            </Panel>

            <Panel title="Decision Trace" action={<KeyRound className="h-4 w-4 text-muted-foreground" />}>
              {authzResult.data ? (
                <div className="grid gap-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <Metric label="Decision" value={valueText(authzData.decision)} />
                    <Metric label="Deny Code" value={valueText(authzData.deny_code)} />
                    <Metric label="Trace" value={valueText(authzData.trace_id)} />
                    <Metric label="Audit" value={valueText(authzData.audit_log_id)} />
                  </div>
                  <JsonPreview value={unwrapData(authzResult.data)} />
                </div>
              ) : (
                <div className="border bg-muted p-4 text-sm text-muted-foreground">
                  <FileClock className="mb-3 h-4 w-4" />
                  Run a check to inspect the trace.
                </div>
              )}
            </Panel>
          </section>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="grid gap-3 p-4">{children}</div>
    </section>
  );
}

function StatusBlock({ title, icon, state }: { title: string; icon: ReactNode; state: LoadState }) {
  const data = asMap(unwrapData(state.data));
  return (
    <div className="border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <Badge variant={state.error ? "danger" : state.data ? "default" : "muted"}>
          {state.loading ? "loading" : state.error ? "error" : state.data ? "ok" : "idle"}
        </Badge>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{state.error || valueText(data.status || data.version)}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[520px] overflow-auto border bg-muted p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return <div className="border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</div>;
}
