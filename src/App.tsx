import {
  Activity,
  Ban,
  Braces,
  CheckCircle2,
  Database,
  FileClock,
  Layers3,
  LockKeyhole,
  LogIn,
  LogOut,
  Plug,
  RefreshCw,
  Server,
  ShieldCheck,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type JsonMap = Record<string, unknown>;

type ApiSettings = {
  baseUrl: string;
  accessToken: string;
};

type APIRequestInit = RequestInit & {
  skipAuth?: boolean;
};

type LoadState = {
  loading: boolean;
  error: string;
  data: unknown;
};

type EndpointConfig = {
  key: string;
  label: string;
  path: string;
  description: string;
  icon: ReactNode;
  columns: string[];
};

const baseEndpoints: EndpointConfig[] = [
  {
    key: "spaces",
    label: "Spaces",
    path: "/api/v1/spaces",
    description: "Business workspaces and tenant boundaries.",
    icon: <Layers3 className="h-4 w-4" />,
    columns: ["id", "name", "slug", "type", "status", "created_at"],
  },
  {
    key: "users",
    label: "Users",
    path: "/api/v1/users",
    description: "Login accounts. API responses must never expose password_hash.",
    icon: <Users className="h-4 w-4" />,
    columns: ["id", "email", "username", "phone", "status", "created_at"],
  },
  {
    key: "resourceTypes",
    label: "Resource Types",
    path: "/api/v1/resource-types",
    description: "Governed Resource Registry metadata.",
    icon: <Database className="h-4 w-4" />,
    columns: ["id", "key", "display_name", "status", "source", "created_at"],
  },
  {
    key: "permissions",
    label: "Permissions",
    path: "/api/v1/permissions",
    description: "Resource/action/scope permission definitions.",
    icon: <ShieldCheck className="h-4 w-4" />,
    columns: ["id", "resource", "action", "scope", "status", "created_at"],
  },
  {
    key: "auditLogs",
    label: "Audit Logs",
    path: "/api/v1/audit-logs?limit=25",
    description: "Recent allow and deny decisions with trace metadata.",
    icon: <FileClock className="h-4 w-4" />,
    columns: ["id", "created_at", "decision", "deny_code", "actor_user_id", "resource_type", "resource_id", "action"],
  },
  {
    key: "adminGrants",
    label: "Admin Grants",
    path: "/api/v1/admin/grants",
    description: "Instance, Space, and Group administrator grants for session-backed Core management.",
    icon: <UserCog className="h-4 w-4" />,
    columns: ["id", "user_id", "level", "permission_key", "space_id", "group_id", "status", "created_at"],
  },
  {
    key: "plugins",
    label: "Plugins",
    path: "/api/v1/plugins",
    description: "Installed first-party and custom plugin manifests.",
    icon: <Plug className="h-4 w-4" />,
    columns: ["id", "key", "name", "version", "status", "created_at"],
  },
  {
    key: "templates",
    label: "Templates",
    path: "/api/v1/templates",
    description: "Installable bootstrap templates.",
    icon: <Workflow className="h-4 w-4" />,
    columns: ["template_id", "id", "name", "version", "requires_core"],
  },
];

function endpointsForSpace(spaceID: string): EndpointConfig[] {
  const encodedSpaceID = encodeURIComponent(spaceID || "space_acme");
  return [
    {
      key: "groups",
      label: "Groups",
      path: `/api/v1/spaces/${encodedSpaceID}/groups`,
      description: "Groups in the active Space. Use these IDs for group_admin grants.",
      icon: <Workflow className="h-4 w-4" />,
      columns: ["id", "space_id", "path", "name", "parent_group_id", "status", "created_at"],
    },
    {
      key: "members",
      label: "Members",
      path: `/api/v1/spaces/${encodedSpaceID}/members`,
      description: "Business identities that Users can act through.",
      icon: <Users className="h-4 w-4" />,
      columns: ["id", "space_id", "display_name", "member_type", "status", "created_at"],
    },
    {
      key: "userMembers",
      label: "User Members",
      path: `/api/v1/spaces/${encodedSpaceID}/user-members`,
      description: "User-to-Member bindings for the active Space.",
      icon: <UserCog className="h-4 w-4" />,
      columns: ["id", "user_id", "email", "member_id", "member_display_name", "relation_type", "status"],
    },
    {
      key: "roles",
      label: "Roles",
      path: `/api/v1/spaces/${encodedSpaceID}/roles`,
      description: "Space-local roles used by the authz engine.",
      icon: <ShieldCheck className="h-4 w-4" />,
      columns: ["id", "space_id", "key", "name", "status", "created_at"],
    },
    {
      key: "memberRoles",
      label: "Member Roles",
      path: `/api/v1/spaces/${encodedSpaceID}/member-roles`,
      description: "Role grants with optional group-tree anchors.",
      icon: <Layers3 className="h-4 w-4" />,
      columns: ["id", "member_id", "role_id", "role_key", "scope_anchor_group_id", "scope_anchor_path", "status"],
    },
    {
      key: "spaceResources",
      label: "Space Resources",
      path: `/api/v1/spaces/${encodedSpaceID}/resources`,
      description: "Resources scoped to the active Space.",
      icon: <Database className="h-4 w-4" />,
      columns: ["id", "resource_type", "display_name", "group_id", "group_path", "owner_member_id", "status"],
    },
  ];
}

const initialAuthzRequest = JSON.stringify(
  {
    actor: {
      user_id: "user_alice",
      member_id: "member_finance_reviewer",
      user_member_id: "um_alice_finance_reviewer",
      space_id: "space_acme",
    },
    resource_type: "invoice",
    resource_id: "invoice_001",
    action: "approve",
    explain: true,
  },
  null,
  2,
);

function defaultSettings(): ApiSettings {
  return {
    baseUrl: localStorage.getItem("plystra.console.baseUrl") || "http://localhost:8080",
    accessToken: localStorage.getItem("plystra.console.accessToken") || "",
  };
}

function endpointUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function asMap(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonMap) : {};
}

function unwrapData(payload: unknown): unknown {
  const map = asMap(payload);
  return "data" in map ? map.data : payload;
}

function unwrapList(payload: unknown): JsonMap[] {
  const data = unwrapData(payload);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((item) => asMap(item));
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function isAllowDecision(value: unknown) {
  const data = asMap(unwrapData(value));
  return data.allow === true || data.decision === "allow";
}

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

  useEffect(() => {
    void loadSystem();
  }, []);

  useEffect(() => {
    if (settings.accessToken.trim() !== "") {
      void refreshAll();
    }
  }, [settings.accessToken]);

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
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border border-foreground bg-foreground text-background">
                <LockKeyhole className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Plystra Admin</h1>
                <p className="text-sm text-muted-foreground">Core operations console for v1.0 self-hosted deployments.</p>
              </div>
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
              <MiniForm title="Create Admin Grant" onSubmit={createAdminGrant}>
                <LabeledInput
                  label="User ID"
                  value={adminGrantDraft.user_id}
                  onChange={(user_id) => setAdminGrantDraft({ ...adminGrantDraft, user_id })}
                  required
                />
                <LabeledInput
                  label="Level"
                  value={adminGrantDraft.level}
                  onChange={(level) =>
                    setAdminGrantDraft({
                      ...adminGrantDraft,
                      level,
                      permission_key: defaultPermissionForLevel(level, adminGrantDraft.permission_key),
                    })
                  }
                  required
                  options={[
                    "instance_super_admin",
                    "instance_admin",
                    "space_admin",
                    "group_admin",
                  ]}
                />
                <LabeledInput
                  label="Permission key"
                  value={adminGrantDraft.permission_key}
                  onChange={(permission_key) => setAdminGrantDraft({ ...adminGrantDraft, permission_key })}
                  required
                  options={[
                    "*",
                    "users:read",
                    "users:manage",
                    "spaces:read",
                    "spaces:manage",
                    "groups:read",
                    "groups:manage",
                    "members:read",
                    "members:manage",
                    "admin_grants:read",
                    "admin_grants:manage",
                    "audit:read",
                    "authz:check",
                    "metrics:read",
                  ]}
                />
                <LabeledInput
                  label="Space ID"
                  value={adminGrantDraft.space_id}
                  onChange={(space_id) => setAdminGrantDraft({ ...adminGrantDraft, space_id })}
                />
                <LabeledInput
                  label="Group ID"
                  value={adminGrantDraft.group_id}
                  onChange={(group_id) => setAdminGrantDraft({ ...adminGrantDraft, group_id })}
                />
              </MiniForm>
            </Panel>
          </aside>

          <section className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {endpoints.map((endpoint) => (
                <Button
                  key={endpoint.key}
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

            <Panel
              title={activeConfig.label}
              description={activeConfig.description}
              action={
                <Button variant="outline" size="sm" onClick={() => void loadEndpoint(activeConfig)}>
                  <RefreshCw className="h-4 w-4" />
                  Reload
                </Button>
              }
            >
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
            </Panel>

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
          </section>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="grid gap-4 p-4">{children}</div>
    </section>
  );
}

function StatusBlock({ title, icon, state }: { title: string; icon: ReactNode; state: LoadState }) {
  const data = asMap(unwrapData(state.data));
  const ok = !state.error && state.data !== null;
  return (
    <section className="border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <Badge variant={ok ? "default" : state.loading ? "muted" : "danger"}>
          {state.loading ? "loading" : ok ? "ok" : "error"}
        </Badge>
      </div>
      {state.error ? <ErrorText>{state.error}</ErrorText> : null}
      <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
        {Object.entries(data)
          .slice(0, 4)
          .map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4">
              <span>{key}</span>
              <span className="truncate text-right text-foreground">{valueText(value)}</span>
            </div>
          ))}
      </div>
    </section>
  );
}

function AdminContextPreview({ state, hasToken }: { state: LoadState; hasToken: boolean }) {
  if (!hasToken) {
    return <div className="border border-dashed p-4 text-sm text-muted-foreground">Login with a user session to load admin grants.</div>;
  }
  if (state.loading) {
    return <div className="border border-dashed p-4 text-sm text-muted-foreground">Loading admin context...</div>;
  }
  const data = asMap(unwrapData(state.data));
  const grants = Array.isArray(data.grants) ? data.grants.map((grant) => asMap(grant)) : [];
  if (grants.length === 0) {
    return <div className="border border-dashed p-4 text-sm text-muted-foreground">No active admin grants loaded.</div>;
  }
  return (
    <div className="grid gap-2">
      <div className="text-xs text-muted-foreground">User {valueText(data.user_id)}</div>
      {grants.slice(0, 4).map((grant) => (
        <div key={valueText(grant.id)} className="border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{valueText(grant.level)}</span>
            <Badge>{valueText(grant.permission_key)}</Badge>
          </div>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
            <span>space: {valueText(grant.space_id)}</span>
            <span>group: {valueText(grant.group_id)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  columns,
  state,
  rowActions,
}: {
  columns: string[];
  state?: LoadState;
  rowActions?: (row: JsonMap) => ReactNode;
}) {
  if (!state || state.loading) {
    return <div className="border border-dashed p-8 text-center text-sm text-muted-foreground">Loading data...</div>;
  }
  if (state.error) {
    return <ErrorText>{state.error}</ErrorText>;
  }
  const rows = unwrapList(state.data);
  if (rows.length === 0) {
    return <div className="border border-dashed p-8 text-center text-sm text-muted-foreground">No rows loaded.</div>;
  }
  return (
    <div className="overflow-x-auto border">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b px-3 py-2 font-medium">
                {column.replaceAll("_", " ")}
              </th>
            ))}
            {rowActions ? <th className="border-b px-3 py-2 font-medium">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${valueText(row.id)}-${index}`} className="border-b last:border-b-0">
              {columns.map((column) => (
                <td key={column} className="max-w-[260px] truncate px-3 py-2">
                  {column === "decision" ? (
                    <Badge variant={row[column] === "allow" ? "default" : "danger"}>{valueText(row[column])}</Badge>
                  ) : (
                    valueText(row[column])
                  )}
                </td>
              ))}
              {rowActions ? <td className="px-3 py-2">{rowActions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionForms({
  userDraft,
  setUserDraft,
  createUser,
  spaceDraft,
  setSpaceDraft,
  createSpace,
  resourceTypeDraft,
  setResourceTypeDraft,
  createResourceType,
  permissionDraft,
  setPermissionDraft,
  createPermission,
}: {
  userDraft: { email: string; username: string; password: string };
  setUserDraft: (value: { email: string; username: string; password: string }) => void;
  createUser: (event: FormEvent) => Promise<void>;
  spaceDraft: { name: string; slug: string };
  setSpaceDraft: (value: { name: string; slug: string }) => void;
  createSpace: (event: FormEvent) => Promise<void>;
  resourceTypeDraft: { key: string; display_name: string };
  setResourceTypeDraft: (value: { key: string; display_name: string }) => void;
  createResourceType: (event: FormEvent) => Promise<void>;
  permissionDraft: { resource: string; action: string; scope: string };
  setPermissionDraft: (value: { resource: string; action: string; scope: string }) => void;
  createPermission: (event: FormEvent) => Promise<void>;
}) {
  return (
    <div className="grid gap-5">
      <MiniForm title="Create User" onSubmit={createUser}>
        <LabeledInput label="Email" value={userDraft.email} onChange={(email) => setUserDraft({ ...userDraft, email })} required />
        <LabeledInput label="Username" value={userDraft.username} onChange={(username) => setUserDraft({ ...userDraft, username })} />
        <LabeledInput
          label="Password"
          value={userDraft.password}
          onChange={(password) => setUserDraft({ ...userDraft, password })}
          type="password"
          required
        />
      </MiniForm>

      <MiniForm title="Create Space" onSubmit={createSpace}>
        <LabeledInput label="Name" value={spaceDraft.name} onChange={(name) => setSpaceDraft({ ...spaceDraft, name })} required />
        <LabeledInput label="Slug" value={spaceDraft.slug} onChange={(slug) => setSpaceDraft({ ...spaceDraft, slug })} />
      </MiniForm>

      <MiniForm title="Register Resource Type" onSubmit={createResourceType}>
        <LabeledInput
          label="Key"
          value={resourceTypeDraft.key}
          onChange={(key) => setResourceTypeDraft({ ...resourceTypeDraft, key })}
          required
        />
        <LabeledInput
          label="Display name"
          value={resourceTypeDraft.display_name}
          onChange={(display_name) => setResourceTypeDraft({ ...resourceTypeDraft, display_name })}
          required
        />
      </MiniForm>

      <MiniForm title="Create Permission" onSubmit={createPermission}>
        <LabeledInput
          label="Resource"
          value={permissionDraft.resource}
          onChange={(resource) => setPermissionDraft({ ...permissionDraft, resource })}
          required
        />
        <LabeledInput
          label="Action"
          value={permissionDraft.action}
          onChange={(action) => setPermissionDraft({ ...permissionDraft, action })}
          required
        />
        <LabeledInput
          label="Scope"
          value={permissionDraft.scope}
          onChange={(scope) => setPermissionDraft({ ...permissionDraft, scope })}
          required
        />
      </MiniForm>
    </div>
  );
}

function MiniForm({ title, onSubmit, children }: { title: string; onSubmit: (event: FormEvent) => Promise<void>; children: ReactNode }) {
  return (
    <form className="grid gap-2 border p-3" onSubmit={(event) => void onSubmit(event)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button size="sm" variant="outline" type="submit">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>
      <div className="grid gap-2">{children}</div>
    </form>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  required,
  type,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  options?: string[];
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      {options ? (
        <select
          className="h-9 w-full border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-foreground"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} required={required} type={type} />
      )}
    </div>
  );
}

function defaultPermissionForLevel(level: string, current: string) {
  if (level === "instance_super_admin") {
    return "*";
  }
  if (current === "*" || current === "") {
    return level === "group_admin" ? "groups:read" : "spaces:read";
  }
  return current;
}

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto border bg-muted p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return <div className={cn("border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive")}>{children}</div>;
}
