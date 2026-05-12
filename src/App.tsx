import { Activity, Ban, Braces, LockKeyhole, LogIn, LogOut, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  ActionForms,
  AdminGrantForm,
  AdminContextPreview,
  DataTable,
  ErrorText,
  JsonPreview,
  LabeledInput,
  Panel,
  StatusBlock,
} from "@/components/admin-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { baseEndpoints, endpointsForSpace, initialAuthzRequest } from "@/config/endpoints";
import { asMap, defaultSettings, endpointUrl, isAllowDecision, unwrapData, valueText } from "@/lib/api";
import { APIRequestInit, ApiSettings, EndpointConfig, JsonMap, LoadState } from "@/types";

export default function App() {
  const [settings, setSettings] = useState<ApiSettings>(() => defaultSettings());
  const [activeSpaceID, setActiveSpaceID] = useState(localStorage.getItem("plystra.console.activeSpaceID") || "space_acme");
  const [loginDraft, setLoginDraft] = useState({ email: "alice@example.com", password: "plystra-demo" });
  const [system, setSystem] = useState<Record<string, LoadState>>({
    health: { loading: false, error: "", data: null },
    ready: { loading: false, error: "", data: null },
    version: { loading: false, error: "", data: null },
  });
  const [overview, setOverview] = useState<LoadState>({ loading: false, error: "", data: null });
  const [adminMe, setAdminMe] = useState<LoadState>({ loading: false, error: "", data: null });
  const [lists, setLists] = useState<Record<string, LoadState>>(() =>
    Object.fromEntries(
      [...baseEndpoints, ...endpointsForSpace("space_acme")].map((endpoint) => [
        endpoint.key,
        { loading: false, error: "", data: null },
      ]),
    ),
  );
  const [activeEndpoint, setActiveEndpoint] = useState(baseEndpoints[0].key);
  const [message, setMessage] = useState("");
  const [userDraft, setUserDraft] = useState({ email: "", username: "", password: "" });
  const [spaceDraft, setSpaceDraft] = useState({ name: "", slug: "" });
  const [resourceTypeDraft, setResourceTypeDraft] = useState({ key: "", display_name: "" });
  const [permissionDraft, setPermissionDraft] = useState({ resource: "invoice", action: "read", scope: "space" });
  const [adminGrantDraft, setAdminGrantDraft] = useState({
    user_id: "",
    level: "space_admin",
    permission_key: "spaces:read",
    space_id: "",
    group_id: "",
  });
  const [authzBody, setAuthzBody] = useState(initialAuthzRequest);
  const [authzResult, setAuthzResult] = useState<LoadState>({ loading: false, error: "", data: null });

  const endpoints = useMemo(() => [...baseEndpoints, ...endpointsForSpace(activeSpaceID)], [activeSpaceID]);
  const activeConfig = useMemo(
    () => endpoints.find((endpoint) => endpoint.key === activeEndpoint) || endpoints[0],
    [activeEndpoint, endpoints],
  );

  useEffect(() => {
    localStorage.setItem("plystra.console.baseUrl", settings.baseUrl);
    localStorage.setItem("plystra.console.accessToken", settings.accessToken);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("plystra.console.activeSpaceID", activeSpaceID);
  }, [activeSpaceID]);

  useEffect(() => {
    void loadSystem();
  }, []);

  useEffect(() => {
    if (settings.accessToken.trim() !== "") {
      void refreshAll();
    }
  }, [settings.accessToken]);

  async function request(path: string, options: APIRequestInit = {}) {
    const { skipAuth, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);
    headers.set("Accept", "application/json");
    if (fetchOptions.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!skipAuth && settings.accessToken.trim() !== "") {
      headers.set("Authorization", `Bearer ${settings.accessToken.trim()}`);
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
      const errorMap = asMap(asMap(payload).error);
      throw new Error(valueText(errorMap.message || response.statusText));
    }
    return payload;
  }

  async function loadSystem() {
    const systemEndpoints = [
      ["health", "/api/v1/health"],
      ["ready", "/api/v1/ready"],
      ["version", "/api/v1/version"],
    ] as const;
    await Promise.all(
      systemEndpoints.map(async ([key, path]) => {
        setSystem((current) => ({ ...current, [key]: { loading: true, error: "", data: current[key].data } }));
        try {
          const data = await request(path);
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

  async function loadOverview() {
    setOverview((current) => ({ ...current, loading: true, error: "" }));
    try {
      setOverview({ loading: false, error: "", data: await request("/api/v1/console/overview") });
    } catch (error) {
      setOverview({ loading: false, error: error instanceof Error ? error.message : "Request failed", data: null });
    }
  }

  async function loadAdminMe() {
    setAdminMe((current) => ({ ...current, loading: true, error: "" }));
    try {
      setAdminMe({ loading: false, error: "", data: await request("/api/v1/admin/me") });
    } catch (error) {
      setAdminMe({ loading: false, error: error instanceof Error ? error.message : "Request failed", data: null });
    }
  }

  async function loadEndpoint(endpoint: EndpointConfig) {
    setLists((current) => ({
      ...current,
      [endpoint.key]: { loading: true, error: "", data: current[endpoint.key]?.data || null },
    }));
    try {
      const data = await request(endpoint.path);
      setLists((current) => ({ ...current, [endpoint.key]: { loading: false, error: "", data } }));
    } catch (error) {
      setLists((current) => ({
        ...current,
        [endpoint.key]: { loading: false, error: error instanceof Error ? error.message : "Request failed", data: null },
      }));
    }
  }

  async function refreshAll() {
    setMessage("Refreshing Core state...");
    await loadSystem();
    if (settings.accessToken.trim() !== "") {
      await Promise.all([loadAdminMe(), loadOverview(), ...endpoints.map((endpoint) => loadEndpoint(endpoint))]);
    }
    setMessage("Refresh complete.");
  }

  async function submitCreate(path: string, body: JsonMap, after: () => Promise<void>) {
    setMessage("Saving...");
    await request(path, { method: "POST", body: JSON.stringify(body) });
    await after();
    setMessage("Saved.");
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("Signing in...");
    const payload = await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: loginDraft.email, password: loginDraft.password }),
      skipAuth: true,
    });
    const data = asMap(unwrapData(payload));
    setSettings((current) => ({ ...current, accessToken: valueText(data.access_token) }));
    setMessage("Signed in.");
  }

  async function logout() {
    if (settings.accessToken.trim() !== "") {
      try {
        await request("/api/v1/auth/logout", { method: "POST", body: "{}" });
      } catch {
        // Local token cleanup still matters if the remote session already expired.
      }
    }
    setSettings((current) => ({ ...current, accessToken: "" }));
    setAdminMe({ loading: false, error: "", data: null });
    setMessage("Signed out.");
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await submitCreate(
      "/api/v1/users",
      {
        email: userDraft.email,
        username: userDraft.username || undefined,
        password: userDraft.password || undefined,
        status: "active",
      },
      async () => {
        setUserDraft({ email: "", username: "", password: "" });
        await loadEndpoint(endpoints[1]);
      },
    );
  }

  async function createSpace(event: FormEvent) {
    event.preventDefault();
    await submitCreate(
      "/api/v1/spaces",
      { name: spaceDraft.name, slug: spaceDraft.slug || undefined, type: "custom", status: "active" },
      async () => {
        setSpaceDraft({ name: "", slug: "" });
        await Promise.all([loadEndpoint(endpoints[0]), loadOverview()]);
      },
    );
  }

  async function createResourceType(event: FormEvent) {
    event.preventDefault();
    await submitCreate(
      "/api/v1/resource-types",
      {
        key: resourceTypeDraft.key,
        display_name: resourceTypeDraft.display_name,
        status: "active",
        source: "admin_console",
      },
      async () => {
        setResourceTypeDraft({ key: "", display_name: "" });
        await loadEndpoint(endpoints[2]);
      },
    );
  }

  async function createPermission(event: FormEvent) {
    event.preventDefault();
    await submitCreate(
      "/api/v1/permissions",
      {
        resource: permissionDraft.resource,
        action: permissionDraft.action,
        scope: permissionDraft.scope,
        status: "active",
      },
      async () => {
        setPermissionDraft({ resource: "invoice", action: "read", scope: "space" });
        await loadEndpoint(endpoints[3]);
      },
    );
  }

  async function createAdminGrant(event: FormEvent) {
    event.preventDefault();
    await submitCreate(
      "/api/v1/admin/grants",
      {
        user_id: adminGrantDraft.user_id,
        level: adminGrantDraft.level,
        permission_key: adminGrantDraft.permission_key,
        space_id: adminGrantDraft.space_id || undefined,
        group_id: adminGrantDraft.group_id || undefined,
      },
      async () => {
        setAdminGrantDraft({
          user_id: "",
          level: "space_admin",
          permission_key: "spaces:read",
          space_id: "",
          group_id: "",
        });
        const adminEndpoint = endpoints.find((endpoint) => endpoint.key === "adminGrants");
        if (adminEndpoint) {
          await Promise.all([loadAdminMe(), loadEndpoint(adminEndpoint)]);
        }
      },
    );
  }

  async function revokeAdminGrant(id: string) {
    if (!id) {
      return;
    }
    setMessage(`Revoking ${id}...`);
    await request(`/api/v1/admin/grants/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
      body: JSON.stringify({ revoked_reason: "revoked from Plystra Admin" }),
    });
    const adminEndpoint = endpoints.find((endpoint) => endpoint.key === "adminGrants");
    if (adminEndpoint) {
      await Promise.all([loadAdminMe(), loadEndpoint(adminEndpoint)]);
    }
    setMessage("Admin grant revoked.");
  }

  async function runAuthz(event: FormEvent) {
    event.preventDefault();
    setAuthzResult((current) => ({ ...current, loading: true, error: "" }));
    try {
      const body = JSON.parse(authzBody) as JsonMap;
      const data = await request("/api/v1/authz/explain", { method: "POST", body: JSON.stringify(body) });
      setAuthzResult({ loading: false, error: "", data });
    } catch (error) {
      setAuthzResult({ loading: false, error: error instanceof Error ? error.message : "Request failed", data: null });
    }
  }

  const overviewData = asMap(unwrapData(overview.data));
  const counts = asMap(overviewData.counts);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-foreground bg-foreground text-background">
              <LockKeyhole className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Plystra Admin</h1>
              <p className="text-sm text-muted-foreground">Core operations console for v1.0 self-hosted deployments.</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[220px_220px_180px_auto_auto_auto]">
            <Input
              aria-label="API base URL"
              value={settings.baseUrl}
              onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="http://localhost:8080"
            />
            <form className="contents" onSubmit={(event) => void login(event)}>
              <Input
                aria-label="Login email"
                value={loginDraft.email}
                onChange={(event) => setLoginDraft((current) => ({ ...current, email: event.target.value }))}
                placeholder="alice@example.com"
              />
              <Input
                aria-label="Login password"
                type="password"
                value={loginDraft.password}
                onChange={(event) => setLoginDraft((current) => ({ ...current, password: event.target.value }))}
                placeholder="Password"
              />
              <Button type="submit">
                <LogIn className="h-4 w-4" />
                Login
              </Button>
            </form>
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
            <Button onClick={() => void refreshAll()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        {message && <div className="border bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</div>}

        <section className="grid gap-3 md:grid-cols-3">
          <StatusBlock title="Health" icon={<Activity className="h-4 w-4" />} state={system.health} />
          <StatusBlock title="Readiness" icon={<Server className="h-4 w-4" />} state={system.ready} />
          <StatusBlock title="Version" icon={<Braces className="h-4 w-4" />} state={system.version} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="grid content-start gap-3">
            <Panel title="Overview" action={<Button variant="outline" size="sm" onClick={() => void loadOverview()}>Load</Button>}>
              {overview.error ? <ErrorText>{overview.error}</ErrorText> : null}
              <div className="grid grid-cols-2 gap-2">
                {["spaces", "users", "members", "resources", "permissions", "audit_logs"].map((key) => (
                  <div key={key} className="border p-3">
                    <div className="text-xs uppercase text-muted-foreground">{key.replaceAll("_", " ")}</div>
                    <div className="mt-1 text-2xl font-semibold">{valueText(counts[key])}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Space Context">
              <LabeledInput label="Active Space ID" value={activeSpaceID} onChange={setActiveSpaceID} required />
            </Panel>

            <Panel title="Admin Context" action={<Button variant="outline" size="sm" onClick={() => void loadAdminMe()}>Load</Button>}>
              {adminMe.error ? <ErrorText>{adminMe.error}</ErrorText> : null}
              <AdminContextPreview state={adminMe} hasToken={settings.accessToken.trim() !== ""} />
            </Panel>

            <Panel title="Admin Actions">
              <ActionForms
                userDraft={userDraft}
                setUserDraft={setUserDraft}
                createUser={createUser}
                spaceDraft={spaceDraft}
                setSpaceDraft={setSpaceDraft}
                createSpace={createSpace}
                resourceTypeDraft={resourceTypeDraft}
                setResourceTypeDraft={setResourceTypeDraft}
                createResourceType={createResourceType}
                permissionDraft={permissionDraft}
                setPermissionDraft={setPermissionDraft}
                createPermission={createPermission}
              />
              <AdminGrantForm draft={adminGrantDraft} setDraft={setAdminGrantDraft} onSubmit={createAdminGrant} />
            </Panel>
          </aside>

          <section className="min-w-0">
            <div className="border bg-card">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-muted/40 p-2">
                {endpoints.map((endpoint) => (
                  <Button
                    key={endpoint.key}
                    size="sm"
                    variant={activeEndpoint === endpoint.key ? "default" : "outline"}
                    onClick={() => {
                      setActiveEndpoint(endpoint.key);
                      void loadEndpoint(endpoint);
                    }}
                  >
                    {endpoint.icon}
                    {endpoint.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">{activeConfig.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{activeConfig.description}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadEndpoint(activeConfig)}>
                  <RefreshCw className="h-4 w-4" />
                  Reload
                </Button>
              </div>
              <div className="p-4">
                <DataTable
                  columns={activeConfig.columns}
                  state={lists[activeConfig.key]}
                  rowActions={
                    activeConfig.key === "adminGrants"
                      ? (row) => (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={row.status !== "active"}
                            onClick={() => void revokeAdminGrant(valueText(row.id))}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Revoke
                          </Button>
                        )
                      : undefined
                  }
                />
              </div>
            </div>

            <div className="mt-6">
              <Panel title="Authorization Inspector" description="Run authz/explain with the same admin-protected Core API path.">
                <form className="grid gap-3" onSubmit={(event) => void runAuthz(event)}>
                  <Textarea value={authzBody} onChange={(event) => setAuthzBody(event.target.value)} spellCheck={false} />
                  <div className="flex items-center gap-2">
                    <Button type="submit">
                      <ShieldCheck className="h-4 w-4" />
                      Check decision
                    </Button>
                    {authzResult.data ? (
                      <Badge variant={isAllowDecision(authzResult.data) ? "default" : "danger"}>
                        {isAllowDecision(authzResult.data) ? "allow" : "deny"}
                      </Badge>
                    ) : null}
                    {authzResult.error ? <ErrorText>{authzResult.error}</ErrorText> : null}
                  </div>
                </form>
                {authzResult.data ? <JsonPreview value={unwrapData(authzResult.data)} /> : null}
              </Panel>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
