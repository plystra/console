import {
  Activity,
  Braces,
  Boxes,
  Database,
  FileClock,
  KeyRound,
  Layers3,
  Lock,
  PackageCheck,
  RefreshCw,
  Server,
  ShieldCheck,
  ShieldPlus,
  Users,
  Workflow,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  AdminContextPreview,
  DataTable,
  ErrorText,
  JsonPreview,
  LabeledInput,
  MiniForm,
  Panel,
  StatusBlock,
} from "@/components/admin-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialAuthzRequest } from "@/config/endpoints";
import {
  apiErrorText,
  asMap,
  defaultSettings,
  endpointUrl,
  isAllowDecision,
  unwrapData,
  unwrapDataMap,
  valueText,
} from "@/lib/api";
import { APIRequestInit, ApiSettings, JsonMap, LoadState } from "@/types";

type LoadKey =
  | "overview"
  | "adminMe"
  | "actor"
  | "capabilities"
  | "users"
  | "spaces"
  | "groups"
  | "members"
  | "userMembers"
  | "roles"
  | "memberRoles"
  | "resourceTypes"
  | "resourceActions"
  | "resourceMapping"
  | "resources"
  | "spaceResources"
  | "permissions"
  | "rolePermissions"
  | "apiKeys"
  | "adminGrants"
  | "plugins"
  | "pluginResources"
  | "pluginPermissions"
  | "pluginAuditEvents"
  | "pluginAdminMenus"
  | "pluginSettings"
  | "templates"
  | "dataTables"
  | "dataRows"
  | "audit"
  | "spaceAudit";

type ConsolePage = "system" | "identity" | "authorization" | "apiKeys" | "extensions" | "audit";

const consolePages: Array<{ id: ConsolePage; label: string; description: string; icon: ReactNode }> = [
  { id: "system", label: "System", description: "Health, readiness, session, overview, and loaded capabilities.", icon: <Activity className="h-4 w-4" /> },
  { id: "identity", label: "Identity", description: "Users, spaces, members, roles, actor switching, and admin grants.", icon: <Users className="h-4 w-4" /> },
  { id: "authorization", label: "Authorization", description: "Resource registry, permissions, role bindings, and Context Mode explain.", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "apiKeys", label: "API Keys", description: "Scoped API keys for trusted server-side calls.", icon: <KeyRound className="h-4 w-4" /> },
  { id: "extensions", label: "Extensions", description: "Business plugins, templates, and the governed Data Console.", icon: <PackageCheck className="h-4 w-4" /> },
  { id: "audit", label: "Audit", description: "Global and space-scoped explainable audit logs.", icon: <FileClock className="h-4 w-4" /> },
];

const emptyState = (): LoadState => ({ loading: false, error: "", data: null });
const allLoadKeys: LoadKey[] = [
  "overview",
  "adminMe",
  "actor",
  "capabilities",
  "users",
  "spaces",
  "groups",
  "members",
  "userMembers",
  "roles",
  "memberRoles",
  "resourceTypes",
  "resourceActions",
  "resourceMapping",
  "resources",
  "spaceResources",
  "permissions",
  "rolePermissions",
  "apiKeys",
  "adminGrants",
  "plugins",
  "pluginResources",
  "pluginPermissions",
  "pluginAuditEvents",
  "pluginAdminMenus",
  "pluginSettings",
  "templates",
  "dataTables",
  "dataRows",
  "audit",
  "spaceAudit",
];

const defaultRegisterDraft = {
  email: "",
  password: "",
  username: "",
  space_name: "",
  space_slug: "",
  member_display_name: "",
  registration_token: "",
};
const defaultLoginDraft = { email: "alice@example.com", password: "plystra-demo" };
const defaultSwitchDraft = { member_id: "", user_member_id: "" };
const defaultUserDraft = { email: "", username: "", password: "" };
const defaultSpaceDraft = { name: "", slug: "" };
const defaultSpaceScopeDraft = { space_id: "space_acme", plugin_key: "demo.console" };
const defaultGroupDraft = { path: "finance", name: "Finance", parent_group_id: "" };
const defaultMemberDraft = { display_name: "", member_type: "human" };
const defaultUserMemberDraft = { user_id: "", member_id: "", relation_type: "self" };
const defaultRoleDraft = { key: "finance_reviewer", name: "Finance Reviewer" };
const defaultMemberRoleDraft = { member_id: "", role_id: "", scope_anchor_group_id: "" };
const defaultResourceTypeDraft = { key: "invoice", display_name: "Invoice" };
const defaultResourceActionDraft = { resource_type: "invoice", key: "approve", display_name: "Approve", risk_level: "normal" };
const defaultResourceMappingDraft = {
  resource_type: "invoice",
  storage_kind: "internal_table",
  table_name: "",
  id_field: "id",
  space_field: "space_id",
  group_field: "group_id",
  owner_member_field: "owner_member_id",
  visibility_field: "visibility",
  metadata_field: "metadata",
};
const defaultResourceDraft = {
  resource_type: "invoice",
  id: "",
  external_id: "",
  group_id: "",
  owner_member_id: "",
  display_name: "",
  visibility: "private",
};
const defaultPermissionDraft = { resource: "invoice", action: "approve", scope: "space" };
const defaultRolePermissionDraft = { role_id: "", permission_id: "" };
const defaultAdminGrantDraft = {
  user_id: "",
  member_id: "",
  level: "space_admin",
  permission_key: "spaces:read",
  space_id: "space_acme",
  group_id: "",
};
const defaultAPIKeyDraft = {
  name: "Console scoped key",
  level: "space",
  space_id: "space_acme",
  group_id: "",
  permission_keys: "authz:check",
};
const defaultDataDraft = { resource_type: "invoice", space_id: "space_acme" };
const defaultDataRowBody = JSON.stringify(
  {
    space_id: "space_acme",
    display_name: "Console sample row",
    visibility: "private",
    metadata: {},
  },
  null,
  2,
);
const defaultPluginManifest = JSON.stringify(
  {
    id: "demo.console",
    name: "Console Demo",
    description: "Demo plugin installed from the Plystra Console.",
    version: "0.0.1",
    source: "console",
    status: "installed",
    manifest_version: "1.0",
    plugin_api_version: "1.0",
    requires_core: ">=0.0.1 <0.1.0",
    resources: [
      {
        key: "ticket",
        display_name: "Ticket",
        actions: [{ key: "read", risk_level: "low" }],
      },
    ],
    permissions: [{ resource: "ticket", action: "read", scopes: ["space"] }],
    audit_events: [{ key: "ticket.read", risk_level: "low" }],
    admin_menu: [{ label: "Tickets", path: "/plugins/demo.console/tickets", required_permission: "plugins:read" }],
    settings: [{ key: "mode", type: "string", scope: "space", description: "Execution mode" }],
  },
  null,
  2,
);

export default function App() {
  const [settings, setSettings] = useState<ApiSettings>(() => defaultSettings());
  const [message, setMessage] = useState("");
  const [activePage, setActivePage] = useState<ConsolePage>(() => pageFromHash());
  const [system, setSystem] = useState<Record<string, LoadState>>({
    health: emptyState(),
    ready: emptyState(),
    version: emptyState(),
  });
  const [loads, setLoads] = useState<Record<LoadKey, LoadState>>(() =>
    Object.fromEntries(allLoadKeys.map((key) => [key, emptyState()])) as Record<LoadKey, LoadState>,
  );
  const [registerDraft, setRegisterDraft] = useState(defaultRegisterDraft);
  const [loginDraft, setLoginDraft] = useState(defaultLoginDraft);
  const [switchDraft, setSwitchDraft] = useState(defaultSwitchDraft);
  const [userDraft, setUserDraft] = useState(defaultUserDraft);
  const [spaceDraft, setSpaceDraft] = useState(defaultSpaceDraft);
  const [spaceScopeDraft, setSpaceScopeDraft] = useState(defaultSpaceScopeDraft);
  const [groupDraft, setGroupDraft] = useState(defaultGroupDraft);
  const [memberDraft, setMemberDraft] = useState(defaultMemberDraft);
  const [userMemberDraft, setUserMemberDraft] = useState(defaultUserMemberDraft);
  const [roleDraft, setRoleDraft] = useState(defaultRoleDraft);
  const [memberRoleDraft, setMemberRoleDraft] = useState(defaultMemberRoleDraft);
  const [resourceTypeDraft, setResourceTypeDraft] = useState(defaultResourceTypeDraft);
  const [resourceActionDraft, setResourceActionDraft] = useState(defaultResourceActionDraft);
  const [resourceMappingDraft, setResourceMappingDraft] = useState(defaultResourceMappingDraft);
  const [resourceDraft, setResourceDraft] = useState(defaultResourceDraft);
  const [permissionDraft, setPermissionDraft] = useState(defaultPermissionDraft);
  const [rolePermissionDraft, setRolePermissionDraft] = useState(defaultRolePermissionDraft);
  const [adminGrantDraft, setAdminGrantDraft] = useState(defaultAdminGrantDraft);
  const [apiKeyDraft, setAPIKeyDraft] = useState(defaultAPIKeyDraft);
  const [dataDraft, setDataDraft] = useState(defaultDataDraft);
  const [dataRowBody, setDataRowBody] = useState(defaultDataRowBody);
  const [pluginManifest, setPluginManifest] = useState(defaultPluginManifest);
  const [authzBody, setAuthzBody] = useState(initialAuthzRequest);
  const [authzResult, setAuthzResult] = useState<LoadState>(emptyState());
  const [pluginValidation, setPluginValidation] = useState<LoadState>(emptyState());

  useEffect(() => {
    localStorage.setItem("plystra.console.baseUrl", settings.baseUrl);
    localStorage.removeItem("plystra.console.accessToken");
    localStorage.removeItem("plystra.console.apiKey");
    writeSessionStorage("plystra.console.apiKey", settings.apiKey);
    writeSessionStorage("plystra.console.accessToken", settings.accessToken);
    writeSessionStorage("plystra.console.refreshToken", settings.refreshToken);
  }, [settings]);

  useEffect(() => {
    void loadSystem();
  }, []);

  useEffect(() => {
    const syncPage = () => setActivePage(pageFromHash());
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  const adminMe = unwrapDataMap(loads.adminMe.data);
  const actorEnvelope = unwrapDataMap(loads.actor.data);
  const currentActor = asMap(actorEnvelope.actor);
  const overview = unwrapDataMap(loads.overview.data);
  const counts = asMap(overview.counts);
  const authzData = unwrapDataMap(authzResult.data);
  const activeSpace = firstText(currentActor.space_id, adminMe.active_space, spaceScopeDraft.space_id);
  const canUseSession = settings.accessToken.trim() !== "";
  const canUseAPIKey = settings.apiKey.trim() !== "";
  const activePageMeta = consolePages.find((page) => page.id === activePage) || consolePages[0];

  const summaryCards = useMemo(
    () => [
      { label: "Users", value: valueText(counts.users), icon: <Users className="h-4 w-4" /> },
      { label: "Spaces", value: valueText(counts.spaces), icon: <Layers3 className="h-4 w-4" /> },
      { label: "Resources", value: valueText(counts.resources), icon: <Boxes className="h-4 w-4" /> },
      { label: "Audit Logs", value: valueText(counts.audit_logs), icon: <FileClock className="h-4 w-4" /> },
    ],
    [counts],
  );

  async function request(path: string, options: APIRequestInit = {}) {
    const { skipAuth, auth = skipAuth ? "none" : "session", ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);
    headers.set("Accept", "application/json");
    if (fetchOptions.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const trimmedAPIKey = settings.apiKey.trim();
    const trimmedToken = settings.accessToken.trim();
    if (auth === "apiKey") {
      if (trimmedAPIKey) headers.set("X-Plystra-API-Key", trimmedAPIKey);
    } else if (auth === "session") {
      if (trimmedToken) headers.set("Authorization", `Bearer ${trimmedToken}`);
    } else if (auth === "any") {
      if (trimmedToken) {
        headers.set("Authorization", `Bearer ${trimmedToken}`);
      } else if (trimmedAPIKey) {
        headers.set("X-Plystra-API-Key", trimmedAPIKey);
      }
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

  async function loadState(key: LoadKey, path: string, auth: APIRequestInit["auth"] = "session") {
    setLoads((current) => ({ ...current, [key]: { ...current[key], loading: true, error: "" } }));
    try {
      const data = await request(path, { auth });
      setLoads((current) => ({ ...current, [key]: { loading: false, error: "", data } }));
      return data;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Request failed";
      setLoads((current) => ({ ...current, [key]: { loading: false, error: messageText, data: null } }));
      return null;
    }
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
          const data = await request(path, { auth: "none" });
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

  async function runCommand(label: string, work: () => Promise<void>) {
    setMessage(`${label}...`);
    try {
      await work();
      setMessage(`${label} complete.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
    }
  }

  async function refreshConsole() {
    setMessage("Refreshing console state...");
    await loadSystem();
    await Promise.all([
      loadState("overview", "/api/v1/console/overview", "session"),
      loadState("adminMe", "/api/v1/admin/me", "session"),
      loadState("actor", "/api/v1/actor/context", "session"),
      loadState("capabilities", "/api/v1/capabilities", "session"),
      loadState("users", "/api/v1/users?limit=50", "session"),
      loadState("spaces", "/api/v1/spaces?limit=50", "session"),
      loadState("resourceTypes", "/api/v1/resource-types?limit=50", "session"),
      loadState("resources", "/api/v1/resources?limit=50", "session"),
      loadState("permissions", "/api/v1/permissions?limit=50", "session"),
      loadState("rolePermissions", "/api/v1/role-permissions?limit=50", "session"),
      loadState("apiKeys", "/api/v1/api-keys?limit=50", "session"),
      loadState("adminGrants", "/api/v1/admin/grants?limit=50", "session"),
      loadState("plugins", "/api/v1/plugins?limit=50", "session"),
      loadState("templates", "/api/v1/templates?limit=50", "session"),
      loadState("dataTables", "/api/v1/data/tables?limit=50", "session"),
      loadState("audit", "/api/v1/audit/logs?limit=25", "session"),
    ]);
    setMessage("Refresh complete.");
  }

  async function refreshCurrentPage() {
    setMessage(`Refreshing ${activePageMeta.label}...`);
    await loadSystem();
    switch (activePage) {
      case "system":
        await Promise.all([
          loadState("overview", "/api/v1/console/overview", "session"),
          loadState("adminMe", "/api/v1/admin/me", "session"),
          loadState("actor", "/api/v1/actor/context", "session"),
          loadState("capabilities", "/api/v1/capabilities", "session"),
        ]);
        break;
      case "identity":
        await Promise.all([
          loadState("adminMe", "/api/v1/admin/me", "session"),
          loadState("actor", "/api/v1/actor/context", "session"),
          loadState("users", "/api/v1/users?limit=50", "session"),
          loadState("spaces", "/api/v1/spaces?limit=50", "session"),
          loadScopedSpaceData("groups"),
          loadScopedSpaceData("members"),
          loadScopedSpaceData("userMembers"),
          loadScopedSpaceData("roles"),
          loadScopedSpaceData("memberRoles"),
          loadState("adminGrants", "/api/v1/admin/grants?limit=50", "session"),
        ]);
        break;
      case "authorization":
        await Promise.all([
          loadState("resourceTypes", "/api/v1/resource-types?limit=50", "session"),
          loadResourceActions(),
          loadResourceMapping(),
          loadState("resources", "/api/v1/resources?limit=50", "session"),
          loadScopedSpaceData("spaceResources"),
          loadState("permissions", "/api/v1/permissions?limit=50", "session"),
          loadState("rolePermissions", "/api/v1/role-permissions?limit=50", "session"),
        ]);
        break;
      case "apiKeys":
        await Promise.all([
          loadState("apiKeys", "/api/v1/api-keys?limit=50", "session"),
          loadState("adminMe", "/api/v1/admin/me", "session"),
        ]);
        break;
      case "extensions":
        await Promise.all([
          loadState("plugins", "/api/v1/plugins?limit=50", "session"),
          loadState("templates", "/api/v1/templates?limit=50", "session"),
          loadState("dataTables", "/api/v1/data/tables?limit=50", "session"),
        ]);
        break;
      case "audit":
        await Promise.all([
          loadState("audit", "/api/v1/audit/logs?limit=25", "session"),
          loadScopedSpaceData("spaceAudit"),
        ]);
        break;
    }
    setMessage(`${activePageMeta.label} refresh complete.`);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    await runCommand("Signing in", async () => {
      const payload = await request("/api/v1/auth/login", {
        auth: "none",
        method: "POST",
        body: JSON.stringify(loginDraft),
      });
      loadSessionFromPayload(payload);
      await refreshConsole();
    });
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    await runCommand("Registering user", async () => {
      const payload = await request("/api/v1/auth/register", {
        auth: "none",
        method: "POST",
        body: JSON.stringify(compactObject(registerDraft)),
      });
      loadSessionFromPayload(payload);
      setRegisterDraft(defaultRegisterDraft);
      await refreshConsole();
    });
  }

  function loadSessionFromPayload(payload: unknown) {
    const data = unwrapDataMap(payload);
    setSettings((current) => ({
      ...current,
      accessToken: valueText(data.access_token) === "-" ? "" : String(data.access_token),
      refreshToken: valueText(data.refresh_token) === "-" ? "" : String(data.refresh_token),
    }));
  }

  async function refreshSession() {
    if (!settings.refreshToken.trim()) {
      setMessage("No refresh token is loaded.");
      return;
    }
    await runCommand("Refreshing session", async () => {
      const payload = await request("/api/v1/auth/refresh", {
        auth: "none",
        method: "POST",
        body: JSON.stringify({ refresh_token: settings.refreshToken.trim() }),
      });
      loadSessionFromPayload(payload);
    });
  }

  async function clearCredentials() {
    try {
      if (settings.refreshToken.trim()) {
        await request("/api/v1/auth/logout", {
          auth: "none",
          method: "POST",
          body: JSON.stringify({ refresh_token: settings.refreshToken.trim() }),
        });
      }
    } catch {
      // Local credential clearing still matters even if the server session is already gone.
    }
    setSettings((current) => ({ ...current, apiKey: "", accessToken: "", refreshToken: "" }));
    setLoads((current) => ({
      ...current,
      adminMe: emptyState(),
      actor: emptyState(),
      apiKeys: emptyState(),
      adminGrants: emptyState(),
    }));
    setMessage("Browser session credentials cleared.");
  }

  async function switchActor(event: FormEvent) {
    event.preventDefault();
    await runCommand("Switching actor", async () => {
      await submitJSON("/api/v1/actor/switch-member", compactObject(switchDraft), "session");
      setSwitchDraft(defaultSwitchDraft);
      await Promise.all([loadState("actor", "/api/v1/actor/context", "session"), loadState("adminMe", "/api/v1/admin/me", "session")]);
    });
  }

  async function runAuthz(event: FormEvent) {
    event.preventDefault();
    setAuthzResult((current) => ({ ...current, loading: true, error: "" }));
    try {
      const body = JSON.parse(authzBody) as Record<string, unknown>;
      const data = await request("/api/v1/authz/explain", { auth: "apiKey", method: "POST", body: JSON.stringify(body) });
      setAuthzResult({ loading: false, error: "", data });
      await loadState("audit", "/api/v1/audit/logs?limit=25", "session");
    } catch (error) {
      setAuthzResult({ loading: false, error: error instanceof Error ? error.message : "Request failed", data: null });
    }
  }

  async function submitJSON(path: string, body: JsonMap, auth: APIRequestInit["auth"] = "session", method = "POST") {
    return request(path, { auth, method, body: JSON.stringify(body) });
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating user", async () => {
      await submitJSON("/api/v1/users", compactObject(userDraft), "session");
      setUserDraft(defaultUserDraft);
      await loadState("users", "/api/v1/users?limit=50", "session");
    });
  }

  async function createSpace(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating space", async () => {
      await submitJSON("/api/v1/spaces", compactObject(spaceDraft), "session");
      setSpaceDraft(defaultSpaceDraft);
      await Promise.all([loadState("spaces", "/api/v1/spaces?limit=50", "session"), loadState("overview", "/api/v1/console/overview", "session")]);
    });
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating group", async () => {
      await submitJSON(`/api/v1/spaces/${encodeURIComponent(spaceScopeDraft.space_id)}/groups`, compactObject(groupDraft), "session");
      setGroupDraft(defaultGroupDraft);
      await loadScopedSpaceData("groups");
    });
  }

  async function createMember(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating member", async () => {
      await submitJSON(`/api/v1/spaces/${encodeURIComponent(spaceScopeDraft.space_id)}/members`, compactObject(memberDraft), "session");
      setMemberDraft(defaultMemberDraft);
      await loadScopedSpaceData("members");
    });
  }

  async function createUserMember(event: FormEvent) {
    event.preventDefault();
    await runCommand("Linking user member", async () => {
      await submitJSON(`/api/v1/spaces/${encodeURIComponent(spaceScopeDraft.space_id)}/user-members`, compactObject(userMemberDraft), "session");
      setUserMemberDraft(defaultUserMemberDraft);
      await loadScopedSpaceData("userMembers");
    });
  }

  async function createRole(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating role", async () => {
      await submitJSON(`/api/v1/spaces/${encodeURIComponent(spaceScopeDraft.space_id)}/roles`, compactObject(roleDraft), "session");
      setRoleDraft(defaultRoleDraft);
      await loadScopedSpaceData("roles");
    });
  }

  async function createMemberRole(event: FormEvent) {
    event.preventDefault();
    await runCommand("Granting member role", async () => {
      await submitJSON(`/api/v1/spaces/${encodeURIComponent(spaceScopeDraft.space_id)}/member-roles`, compactObject(memberRoleDraft), "session");
      setMemberRoleDraft(defaultMemberRoleDraft);
      await loadScopedSpaceData("memberRoles");
    });
  }

  async function createResourceType(event: FormEvent) {
    event.preventDefault();
    await runCommand("Registering resource type", async () => {
      await submitJSON("/api/v1/resource-types", compactObject(resourceTypeDraft), "session");
      setResourceTypeDraft(defaultResourceTypeDraft);
      await loadState("resourceTypes", "/api/v1/resource-types?limit=50", "session");
    });
  }

  async function createResourceAction(event: FormEvent) {
    event.preventDefault();
    await runCommand("Registering resource action", async () => {
      const resourceType = resourceActionDraft.resource_type.trim();
      await submitJSON(
        `/api/v1/resource-types/${encodeURIComponent(resourceType)}/actions`,
        compactObject({
          key: resourceActionDraft.key,
          display_name: resourceActionDraft.display_name,
          risk_level: resourceActionDraft.risk_level,
        }),
        "session",
      );
      await loadResourceActions();
    });
  }

  async function upsertResourceMapping(event: FormEvent) {
    event.preventDefault();
    await runCommand("Saving resource mapping", async () => {
      const resourceType = resourceMappingDraft.resource_type.trim();
      await submitJSON(
        `/api/v1/resource-types/${encodeURIComponent(resourceType)}/mapping`,
        compactObject({
          storage_kind: resourceMappingDraft.storage_kind,
          table_name: resourceMappingDraft.table_name,
          id_field: resourceMappingDraft.id_field,
          space_field: resourceMappingDraft.space_field,
          group_field: resourceMappingDraft.group_field,
          owner_member_field: resourceMappingDraft.owner_member_field,
          visibility_field: resourceMappingDraft.visibility_field,
          metadata_field: resourceMappingDraft.metadata_field,
        }),
        "session",
      );
      await loadResourceMapping();
    });
  }

  async function createSpaceResource(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating resource", async () => {
      await submitJSON(
        `/api/v1/spaces/${encodeURIComponent(spaceScopeDraft.space_id)}/resources`,
        compactObject(resourceDraft),
        "session",
      );
      setResourceDraft(defaultResourceDraft);
      await Promise.all([
        loadScopedSpaceData("spaceResources"),
        loadState("resources", "/api/v1/resources?limit=50", "session"),
      ]);
    });
  }

  async function createPermission(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating permission", async () => {
      await submitJSON("/api/v1/permissions", compactObject(permissionDraft), "session");
      setPermissionDraft(defaultPermissionDraft);
      await loadState("permissions", "/api/v1/permissions?limit=50", "session");
    });
  }

  async function createRolePermission(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating role permission", async () => {
      await submitJSON("/api/v1/role-permissions", compactObject(rolePermissionDraft), "session");
      setRolePermissionDraft(defaultRolePermissionDraft);
      await loadState("rolePermissions", "/api/v1/role-permissions?limit=50", "session");
    });
  }

  async function createAdminGrant(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating admin grant", async () => {
      await submitJSON("/api/v1/admin/grants", compactObject(adminGrantDraft), "session");
      setAdminGrantDraft(defaultAdminGrantDraft);
      await Promise.all([loadState("adminGrants", "/api/v1/admin/grants?limit=50", "session"), loadState("adminMe", "/api/v1/admin/me", "session")]);
    });
  }

  async function createAPIKey(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating API key", async () => {
      const body = compactObject({
        ...apiKeyDraft,
        permission_keys: apiKeyDraft.permission_keys
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      const payload = await submitJSON("/api/v1/api-keys", body, "session");
      const apiKey = unwrapDataMap(payload).api_key;
      if (typeof apiKey === "string" && apiKey !== "") {
        setSettings((current) => ({ ...current, apiKey }));
      }
      await loadState("apiKeys", "/api/v1/api-keys?limit=50", "session");
    });
  }

  async function loadScopedSpaceData(key: Extract<LoadKey, "groups" | "members" | "userMembers" | "roles" | "memberRoles" | "spaceResources" | "spaceAudit">) {
    const spaceID = spaceScopeDraft.space_id.trim();
    if (!spaceID) {
      setMessage("Set a Space ID first.");
      return null;
    }
    const routes: Record<typeof key, string> = {
      groups: `/api/v1/spaces/${encodeURIComponent(spaceID)}/groups?limit=50`,
      members: `/api/v1/spaces/${encodeURIComponent(spaceID)}/members?limit=50`,
      userMembers: `/api/v1/spaces/${encodeURIComponent(spaceID)}/user-members?limit=50`,
      roles: `/api/v1/spaces/${encodeURIComponent(spaceID)}/roles?limit=50`,
      memberRoles: `/api/v1/spaces/${encodeURIComponent(spaceID)}/member-roles?limit=50`,
      spaceResources: `/api/v1/spaces/${encodeURIComponent(spaceID)}/resources?limit=50`,
      spaceAudit: `/api/v1/spaces/${encodeURIComponent(spaceID)}/audit-logs?limit=25`,
    };
    return loadState(key, routes[key], "session");
  }

  async function loadResourceActions() {
    const resourceType = resourceActionDraft.resource_type.trim();
    if (!resourceType) {
      setMessage("Set a resource type first.");
      return null;
    }
    return loadState("resourceActions", `/api/v1/resource-types/${encodeURIComponent(resourceType)}/actions?limit=50`, "session");
  }

  async function loadResourceMapping() {
    const resourceType = resourceMappingDraft.resource_type.trim();
    if (!resourceType) {
      setMessage("Set a resource type first.");
      return null;
    }
    return loadState("resourceMapping", `/api/v1/resource-types/${encodeURIComponent(resourceType)}/mapping`, "session");
  }

  async function loadDataRows(event?: FormEvent) {
    event?.preventDefault();
    const resourceType = dataDraft.resource_type.trim();
    if (!resourceType) {
      setMessage("Choose a resource type before loading data rows.");
      return;
    }
    const query = dataDraft.space_id.trim() ? `?space_id=${encodeURIComponent(dataDraft.space_id.trim())}&limit=50` : "?limit=50";
    await loadState("dataRows", `/api/v1/data/rows/${encodeURIComponent(resourceType)}${query}`, "session");
  }

  async function createDataRow(event: FormEvent) {
    event.preventDefault();
    await runCommand("Creating data row", async () => {
      const body = JSON.parse(dataRowBody) as JsonMap;
      await submitJSON(`/api/v1/data/rows/${encodeURIComponent(dataDraft.resource_type.trim())}`, body, "session");
      await loadDataRows();
    });
  }

  async function validatePluginManifest(event: FormEvent) {
    event.preventDefault();
    setPluginValidation((current) => ({ ...current, loading: true, error: "" }));
    try {
      const body = JSON.parse(pluginManifest) as JsonMap;
      const data = await request("/api/v1/plugins/validate-manifest", { auth: "session", method: "POST", body: JSON.stringify(body) });
      setPluginValidation({ loading: false, error: "", data });
      setMessage("Plugin manifest validation complete.");
    } catch (error) {
      setPluginValidation({ loading: false, error: error instanceof Error ? error.message : "Validation failed", data: null });
    }
  }

  async function installPlugin() {
    await runCommand("Installing plugin", async () => {
      const manifest = JSON.parse(pluginManifest) as JsonMap;
      await submitJSON("/api/v1/plugins/install", { manifest, source: "console" }, "session");
      await loadState("plugins", "/api/v1/plugins?limit=50", "session");
    });
  }

  async function loadPluginSurface(key: Extract<LoadKey, "pluginResources" | "pluginPermissions" | "pluginAuditEvents" | "pluginAdminMenus" | "pluginSettings">) {
    const pluginKey = spaceScopeDraft.plugin_key.trim();
    if (!pluginKey) {
      setMessage("Set a plugin key first.");
      return null;
    }
    const suffixes: Record<typeof key, string> = {
      pluginResources: "resources?limit=50",
      pluginPermissions: "permissions?limit=50",
      pluginAuditEvents: "audit-events?limit=50",
      pluginAdminMenus: "admin-menus?limit=50",
      pluginSettings: `settings?space_id=${encodeURIComponent(spaceScopeDraft.space_id)}&limit=50`,
    };
    return loadState(key, `/api/v1/plugins/${encodeURIComponent(pluginKey)}/${suffixes[key]}`, "session");
  }

  async function updatePluginLifecycle(action: "enable" | "disable" | "uninstall") {
    await runCommand(`${titleFromKey(action)} plugin`, async () => {
      await submitJSON(`/api/v1/plugins/${encodeURIComponent(spaceScopeDraft.plugin_key)}/${action}`, {}, "session");
      await loadState("plugins", "/api/v1/plugins?limit=50", "session");
    });
  }

  async function installTemplate(templateID: string, preview: boolean) {
    await runCommand(preview ? "Previewing template" : "Installing template", async () => {
      const actor = asMap(unwrapDataMap(loads.actor.data).actor);
      const body = compactObject({
        space_id: activeSpace === "-" ? "" : activeSpace,
        allow_missing_plugins: true,
        allow_existing_resources: true,
        actor_user_id: actor.user_id,
        actor_member_id: actor.member_id,
        actor_user_member_id: actor.user_member_id,
      });
      await submitJSON(`/api/v1/templates/${encodeURIComponent(templateID)}/${preview ? "preview-install" : "install"}`, body, "session");
      await refreshConsole();
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 xl:grid-cols-[1fr_780px] xl:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-foreground bg-foreground text-background">
              <Workflow className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Plystra Console</h1>
              <p className="text-sm text-muted-foreground">Kernel-managed system capabilities, admin, identity, resources, plugins, and audit.</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_auto_auto]">
            <Input
              aria-label="API base URL"
              value={settings.baseUrl}
              onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="http://localhost:8080"
            />
            <Input
              aria-label="Scoped API key"
              value={settings.apiKey}
              onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder="Scoped API key"
              type="password"
            />
            <Button onClick={() => void refreshCurrentPage()}>
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </Button>
            <Button variant={canUseSession || canUseAPIKey ? "outline" : "ghost"} onClick={() => void clearCredentials()} disabled={!canUseSession && !canUseAPIKey}>
              <Lock className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        {message ? <div className="border bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</div> : null}

        {activePage === "system" ? (
          <>
            <section className="grid gap-3 lg:grid-cols-3">
              <StatusBlock title="Health" icon={<Activity className="h-4 w-4" />} state={system.health} />
              <StatusBlock title="Readiness" icon={<Server className="h-4 w-4" />} state={system.ready} />
              <StatusBlock title="Version" icon={<Braces className="h-4 w-4" />} state={system.version} />
            </section>

            <section className="grid gap-3 md:grid-cols-4">
              {summaryCards.map((card) => (
                <SummaryCard key={card.label} {...card} />
              ))}
            </section>
          </>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="grid content-start gap-4">
            <ConsoleNavigation activePage={activePage} />

            <Panel title="Session" description="User/admin management uses bearer sessions. Tokens stay in sessionStorage.">
              <MiniForm title="Login" onSubmit={login}>
                <LabeledInput label="Email" value={loginDraft.email} onChange={(email) => setLoginDraft({ ...loginDraft, email })} required />
                <LabeledInput
                  label="Password"
                  value={loginDraft.password}
                  onChange={(password) => setLoginDraft({ ...loginDraft, password })}
                  type="password"
                  required
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void refreshSession()} disabled={!settings.refreshToken.trim()}>
                    Refresh Session
                  </Button>
                </div>
              </MiniForm>

              <MiniForm title="Register" onSubmit={register}>
                <LabeledInput label="Email" value={registerDraft.email} onChange={(email) => setRegisterDraft({ ...registerDraft, email })} required />
                <LabeledInput
                  label="Password"
                  value={registerDraft.password}
                  onChange={(password) => setRegisterDraft({ ...registerDraft, password })}
                  type="password"
                  required
                />
                <LabeledInput label="Username" value={registerDraft.username} onChange={(username) => setRegisterDraft({ ...registerDraft, username })} />
                <LabeledInput label="Space Name" value={registerDraft.space_name} onChange={(space_name) => setRegisterDraft({ ...registerDraft, space_name })} />
                <LabeledInput label="Space Slug" value={registerDraft.space_slug} onChange={(space_slug) => setRegisterDraft({ ...registerDraft, space_slug })} />
                <LabeledInput
                  label="Member Display Name"
                  value={registerDraft.member_display_name}
                  onChange={(member_display_name) => setRegisterDraft({ ...registerDraft, member_display_name })}
                />
                <LabeledInput
                  label="Registration Token"
                  value={registerDraft.registration_token}
                  onChange={(registration_token) => setRegisterDraft({ ...registerDraft, registration_token })}
                  type="password"
                />
              </MiniForm>

              <AdminContextPreview state={loads.adminMe} hasToken={canUseSession} />
            </Panel>

            {activePage === "system" ? (
            <Panel
              title="System Capabilities"
              action={
                <Button size="sm" variant="outline" onClick={() => void loadState("capabilities", "/api/v1/capabilities", "session")}>
                  Load
                </Button>
              }
            >
              <CapabilityList state={loads.capabilities} />
            </Panel>
            ) : null}

            <Panel title="Workspace Scope" description="Scoped endpoints use this Space ID and plugin key.">
              <LabeledInput label="Space ID" value={spaceScopeDraft.space_id} onChange={(space_id) => setSpaceScopeDraft({ ...spaceScopeDraft, space_id })} />
              <LabeledInput label="Plugin Key" value={spaceScopeDraft.plugin_key} onChange={(plugin_key) => setSpaceScopeDraft({ ...spaceScopeDraft, plugin_key })} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void loadScopedSpaceData("groups")}>
                  Groups
                </Button>
                <Button variant="outline" size="sm" onClick={() => void loadScopedSpaceData("members")}>
                  Members
                </Button>
                <Button variant="outline" size="sm" onClick={() => void loadScopedSpaceData("roles")}>
                  Roles
                </Button>
                <Button variant="outline" size="sm" onClick={() => void loadScopedSpaceData("spaceResources")}>
                  Resources
                </Button>
              </div>
            </Panel>
          </aside>

          <section className="grid content-start gap-4">
            {activePage === "system" ? (
            <Panel
              title="Control Plane Overview"
              action={
                <Button size="sm" variant="outline" onClick={() => void loadState("overview", "/api/v1/console/overview", "session")}>
                  Load
                </Button>
              }
            >
              {loads.overview.error ? <ErrorText>{loads.overview.error}</ErrorText> : null}
              <DataTable
                columns={["id", "decision", "actor_user_id", "resource_type", "resource_id", "action", "created_at"]}
                state={{ ...loads.overview, data: { data: asList(overview.recent_audit_logs) } }}
              />
            </Panel>
            ) : null}

            {activePage === "identity" ? (
            <Panel title="Identity and Admin" description="Authn, actor context, spaces, users, admin grants, and scoped identity objects.">
              <div className="grid gap-5 lg:grid-cols-2">
                <MiniForm title="Create User" onSubmit={createUser}>
                  <LabeledInput label="Email" value={userDraft.email} onChange={(email) => setUserDraft({ ...userDraft, email })} required />
                  <LabeledInput label="Username" value={userDraft.username} onChange={(username) => setUserDraft({ ...userDraft, username })} />
                  <LabeledInput label="Password" value={userDraft.password} onChange={(password) => setUserDraft({ ...userDraft, password })} type="password" required />
                </MiniForm>
                <MiniForm title="Create Space" onSubmit={createSpace}>
                  <LabeledInput label="Name" value={spaceDraft.name} onChange={(name) => setSpaceDraft({ ...spaceDraft, name })} required />
                  <LabeledInput label="Slug" value={spaceDraft.slug} onChange={(slug) => setSpaceDraft({ ...spaceDraft, slug })} />
                </MiniForm>
                <MiniForm title="Switch Actor" onSubmit={switchActor}>
                  <LabeledInput label="Member ID" value={switchDraft.member_id} onChange={(member_id) => setSwitchDraft({ ...switchDraft, member_id })} />
                  <LabeledInput
                    label="UserMember ID"
                    value={switchDraft.user_member_id}
                    onChange={(user_member_id) => setSwitchDraft({ ...switchDraft, user_member_id })}
                  />
                </MiniForm>
                <MiniForm title="Create Admin Grant" onSubmit={createAdminGrant}>
                  <LabeledInput label="User ID" value={adminGrantDraft.user_id} onChange={(user_id) => setAdminGrantDraft({ ...adminGrantDraft, user_id })} required />
                  <LabeledInput label="Member ID" value={adminGrantDraft.member_id} onChange={(member_id) => setAdminGrantDraft({ ...adminGrantDraft, member_id })} />
                  <LabeledInput
                    label="Level"
                    value={adminGrantDraft.level}
                    onChange={(level) => setAdminGrantDraft({ ...adminGrantDraft, level, permission_key: defaultPermissionForLevel(level, adminGrantDraft.permission_key) })}
                    options={["instance_super_admin", "instance_admin", "space_admin", "group_admin"]}
                    required
                  />
                  <LabeledInput
                    label="Permission Key"
                    value={adminGrantDraft.permission_key}
                    onChange={(permission_key) => setAdminGrantDraft({ ...adminGrantDraft, permission_key })}
                    options={adminPermissionOptions}
                    required
                  />
                  <LabeledInput label="Space ID" value={adminGrantDraft.space_id} onChange={(space_id) => setAdminGrantDraft({ ...adminGrantDraft, space_id })} />
                  <LabeledInput label="Group ID" value={adminGrantDraft.group_id} onChange={(group_id) => setAdminGrantDraft({ ...adminGrantDraft, group_id })} />
                </MiniForm>
              </div>

              <SectionBlock title="Space Identity Objects">
                <div className="grid gap-5 lg:grid-cols-2">
                  <MiniForm title="Create Group" onSubmit={createGroup}>
                    <LabeledInput label="Path" value={groupDraft.path} onChange={(path) => setGroupDraft({ ...groupDraft, path })} required />
                    <LabeledInput label="Name" value={groupDraft.name} onChange={(name) => setGroupDraft({ ...groupDraft, name })} />
                    <LabeledInput label="Parent Group ID" value={groupDraft.parent_group_id} onChange={(parent_group_id) => setGroupDraft({ ...groupDraft, parent_group_id })} />
                  </MiniForm>
                  <MiniForm title="Create Member" onSubmit={createMember}>
                    <LabeledInput label="Display Name" value={memberDraft.display_name} onChange={(display_name) => setMemberDraft({ ...memberDraft, display_name })} required />
                    <LabeledInput label="Member Type" value={memberDraft.member_type} onChange={(member_type) => setMemberDraft({ ...memberDraft, member_type })} options={["human", "service"]} />
                  </MiniForm>
                  <MiniForm title="Link User Member" onSubmit={createUserMember}>
                    <LabeledInput label="User ID" value={userMemberDraft.user_id} onChange={(user_id) => setUserMemberDraft({ ...userMemberDraft, user_id })} required />
                    <LabeledInput label="Member ID" value={userMemberDraft.member_id} onChange={(member_id) => setUserMemberDraft({ ...userMemberDraft, member_id })} required />
                    <LabeledInput
                      label="Relation Type"
                      value={userMemberDraft.relation_type}
                      onChange={(relation_type) => setUserMemberDraft({ ...userMemberDraft, relation_type })}
                      options={["self", "delegated", "service"]}
                      required
                    />
                  </MiniForm>
                  <MiniForm title="Create Role" onSubmit={createRole}>
                    <LabeledInput label="Key" value={roleDraft.key} onChange={(key) => setRoleDraft({ ...roleDraft, key })} required />
                    <LabeledInput label="Name" value={roleDraft.name} onChange={(name) => setRoleDraft({ ...roleDraft, name })} />
                  </MiniForm>
                  <MiniForm title="Grant Member Role" onSubmit={createMemberRole}>
                    <LabeledInput label="Member ID" value={memberRoleDraft.member_id} onChange={(member_id) => setMemberRoleDraft({ ...memberRoleDraft, member_id })} required />
                    <LabeledInput label="Role ID" value={memberRoleDraft.role_id} onChange={(role_id) => setMemberRoleDraft({ ...memberRoleDraft, role_id })} required />
                    <LabeledInput
                      label="Scope Anchor Group ID"
                      value={memberRoleDraft.scope_anchor_group_id}
                      onChange={(scope_anchor_group_id) => setMemberRoleDraft({ ...memberRoleDraft, scope_anchor_group_id })}
                    />
                  </MiniForm>
                </div>
              </SectionBlock>

              <SectionBlock title="Identity Tables">
                <div className="grid gap-4">
                  <DataCluster
                    title="Users"
                    action={() => void loadState("users", "/api/v1/users?limit=50", "session")}
                    columns={["id", "email", "status", "created_at"]}
                    state={loads.users}
                  />
                  <DataCluster
                    title="Spaces"
                    action={() => void loadState("spaces", "/api/v1/spaces?limit=50", "session")}
                    columns={["id", "name", "slug", "type", "status"]}
                    state={loads.spaces}
                  />
                  <DataCluster title="Groups" action={() => void loadScopedSpaceData("groups")} columns={["id", "path", "name", "parent_group_id", "status"]} state={loads.groups} />
                  <DataCluster title="Members" action={() => void loadScopedSpaceData("members")} columns={["id", "display_name", "member_type", "status"]} state={loads.members} />
                  <DataCluster
                    title="User Members"
                    action={() => void loadScopedSpaceData("userMembers")}
                    columns={["id", "user_id", "email", "member_id", "member_display_name", "relation_type", "status"]}
                    state={loads.userMembers}
                  />
                  <DataCluster title="Roles" action={() => void loadScopedSpaceData("roles")} columns={["id", "key", "name", "status"]} state={loads.roles} />
                  <DataCluster
                    title="Member Roles"
                    action={() => void loadScopedSpaceData("memberRoles")}
                    columns={["id", "member_id", "member_display_name", "role_id", "role_key", "scope_anchor_group_id", "status"]}
                    state={loads.memberRoles}
                  />
                  <DataCluster
                    title="Admin Grants"
                    action={() => void loadState("adminGrants", "/api/v1/admin/grants?limit=50", "session")}
                    columns={["id", "user_id", "member_id", "level", "permission_key", "space_id", "status"]}
                    state={loads.adminGrants}
                  />
                  <DataCluster title="Actor Context" action={() => void loadState("actor", "/api/v1/actor/context", "session")} state={loads.actor} json />
                </div>
              </SectionBlock>
            </Panel>
            ) : null}

            {activePage === "authorization" ? (
            <Panel title="Resource Registry and Authorization" description="Resource types, actions, mappings, resources, RBAC grants, and trusted Context Mode checks.">
              <div className="grid gap-5 lg:grid-cols-2">
                <MiniForm title="Register Resource Type" onSubmit={createResourceType}>
                  <LabeledInput label="Key" value={resourceTypeDraft.key} onChange={(key) => setResourceTypeDraft({ ...resourceTypeDraft, key })} required />
                  <LabeledInput
                    label="Display Name"
                    value={resourceTypeDraft.display_name}
                    onChange={(display_name) => setResourceTypeDraft({ ...resourceTypeDraft, display_name })}
                    required
                  />
                </MiniForm>
                <MiniForm title="Register Resource Action" onSubmit={createResourceAction}>
                  <LabeledInput label="Resource Type" value={resourceActionDraft.resource_type} onChange={(resource_type) => setResourceActionDraft({ ...resourceActionDraft, resource_type })} required />
                  <LabeledInput label="Key" value={resourceActionDraft.key} onChange={(key) => setResourceActionDraft({ ...resourceActionDraft, key })} required />
                  <LabeledInput
                    label="Display Name"
                    value={resourceActionDraft.display_name}
                    onChange={(display_name) => setResourceActionDraft({ ...resourceActionDraft, display_name })}
                    required
                  />
                  <LabeledInput
                    label="Risk Level"
                    value={resourceActionDraft.risk_level}
                    onChange={(risk_level) => setResourceActionDraft({ ...resourceActionDraft, risk_level })}
                    options={["low", "normal", "high", "critical"]}
                  />
                </MiniForm>
                <MiniForm title="Save Resource Mapping" onSubmit={upsertResourceMapping}>
                  <LabeledInput label="Resource Type" value={resourceMappingDraft.resource_type} onChange={(resource_type) => setResourceMappingDraft({ ...resourceMappingDraft, resource_type })} required />
                  <LabeledInput
                    label="Storage Kind"
                    value={resourceMappingDraft.storage_kind}
                    onChange={(storage_kind) => setResourceMappingDraft({ ...resourceMappingDraft, storage_kind })}
                    options={["internal_table", "plugin_managed"]}
                  />
                  <LabeledInput label="Table Name" value={resourceMappingDraft.table_name} onChange={(table_name) => setResourceMappingDraft({ ...resourceMappingDraft, table_name })} />
                  <LabeledInput label="ID Field" value={resourceMappingDraft.id_field} onChange={(id_field) => setResourceMappingDraft({ ...resourceMappingDraft, id_field })} />
                  <LabeledInput label="Space Field" value={resourceMappingDraft.space_field} onChange={(space_field) => setResourceMappingDraft({ ...resourceMappingDraft, space_field })} />
                </MiniForm>
                <MiniForm title="Create Space Resource" onSubmit={createSpaceResource}>
                  <LabeledInput label="Resource Type" value={resourceDraft.resource_type} onChange={(resource_type) => setResourceDraft({ ...resourceDraft, resource_type })} required />
                  <LabeledInput label="ID" value={resourceDraft.id} onChange={(id) => setResourceDraft({ ...resourceDraft, id })} />
                  <LabeledInput label="External ID" value={resourceDraft.external_id} onChange={(external_id) => setResourceDraft({ ...resourceDraft, external_id })} />
                  <LabeledInput label="Display Name" value={resourceDraft.display_name} onChange={(display_name) => setResourceDraft({ ...resourceDraft, display_name })} />
                  <LabeledInput label="Group ID" value={resourceDraft.group_id} onChange={(group_id) => setResourceDraft({ ...resourceDraft, group_id })} />
                  <LabeledInput label="Owner Member ID" value={resourceDraft.owner_member_id} onChange={(owner_member_id) => setResourceDraft({ ...resourceDraft, owner_member_id })} />
                  <LabeledInput label="Visibility" value={resourceDraft.visibility} onChange={(visibility) => setResourceDraft({ ...resourceDraft, visibility })} options={["private", "space", "public"]} />
                </MiniForm>
                <MiniForm title="Create Permission" onSubmit={createPermission}>
                  <LabeledInput label="Resource" value={permissionDraft.resource} onChange={(resource) => setPermissionDraft({ ...permissionDraft, resource })} required />
                  <LabeledInput label="Action" value={permissionDraft.action} onChange={(action) => setPermissionDraft({ ...permissionDraft, action })} required />
                  <LabeledInput label="Scope" value={permissionDraft.scope} onChange={(scope) => setPermissionDraft({ ...permissionDraft, scope })} options={["self", "group", "group_tree", "space"]} required />
                </MiniForm>
                <MiniForm title="Create Role Permission" onSubmit={createRolePermission}>
                  <LabeledInput label="Role ID" value={rolePermissionDraft.role_id} onChange={(role_id) => setRolePermissionDraft({ ...rolePermissionDraft, role_id })} required />
                  <LabeledInput label="Permission ID" value={rolePermissionDraft.permission_id} onChange={(permission_id) => setRolePermissionDraft({ ...rolePermissionDraft, permission_id })} required />
                </MiniForm>
              </div>

              <SectionBlock title="Registry Tables">
                <div className="grid gap-4">
                  <DataCluster
                    title="Resource Types"
                    action={() => void loadState("resourceTypes", "/api/v1/resource-types?limit=50", "session")}
                    columns={["key", "display_name", "source", "status"]}
                    state={loads.resourceTypes}
                  />
                  <DataCluster
                    title="Resource Actions"
                    action={() => void loadResourceActions()}
                    columns={["id", "key", "display_name", "risk_level", "audit_default"]}
                    state={loads.resourceActions}
                  />
                  <DataCluster title="Resource Mapping" action={() => void loadResourceMapping()} state={loads.resourceMapping} json />
                  <DataCluster
                    title="Global Resources"
                    action={() => void loadState("resources", "/api/v1/resources?limit=50", "session")}
                    columns={["id", "resource_type", "space_id", "group_path", "status"]}
                    state={loads.resources}
                  />
                  <DataCluster
                    title="Space Resources"
                    action={() => void loadScopedSpaceData("spaceResources")}
                    columns={["id", "resource_type", "space_id", "group_path", "owner_member_id", "visibility", "status"]}
                    state={loads.spaceResources}
                  />
                  <DataCluster
                    title="Permissions"
                    action={() => void loadState("permissions", "/api/v1/permissions?limit=50", "session")}
                    columns={["id", "resource", "action", "scope", "status"]}
                    state={loads.permissions}
                  />
                  <DataCluster
                    title="Role Permissions"
                    action={() => void loadState("rolePermissions", "/api/v1/role-permissions?limit=50", "session")}
                    columns={["id", "space_id", "role_id", "role_key", "permission_id", "resource", "action", "scope"]}
                    state={loads.rolePermissions}
                  />
                </div>
              </SectionBlock>

              <SectionBlock title="Authorization Inspector">
                <form className="grid gap-3" onSubmit={(event) => void runAuthz(event)}>
                  <div className="grid gap-1">
                    <Label>Context Mode Request</Label>
                    <Textarea value={authzBody} onChange={(event) => setAuthzBody(event.target.value)} spellCheck={false} className="min-h-[360px]" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={!canUseAPIKey}>
                      <ShieldCheck className="h-4 w-4" />
                      Explain Decision
                    </Button>
                    {authzResult.data ? (
                      <Badge variant={isAllowDecision(authzResult.data) ? "default" : "danger"}>{valueText(authzData.decision)}</Badge>
                    ) : null}
                    {!canUseAPIKey ? <span className="text-sm text-muted-foreground">Create or paste a scoped API key first.</span> : null}
                    {authzResult.error ? <ErrorText>{authzResult.error}</ErrorText> : null}
                  </div>
                </form>
              </SectionBlock>

              <SectionBlock title="Decision Trace" action={<KeyRound className="h-4 w-4 text-muted-foreground" />}>
                {authzResult.data ? (
                  <div className="grid gap-3">
                    <div className="grid gap-2 md:grid-cols-4">
                      <Metric label="Decision" value={valueText(authzData.decision)} />
                      <Metric label="Deny Code" value={valueText(authzData.deny_code)} />
                      <Metric label="Trace" value={valueText(authzData.trace_id)} />
                      <Metric label="Audit" value={valueText(asMap(authzData.audit).audit_log_id || authzData.audit_log_id)} />
                    </div>
                    <JsonPreview value={unwrapData(authzResult.data)} />
                  </div>
                ) : (
                  <div className="border border-dashed p-4 text-sm text-muted-foreground">
                    <FileClock className="mb-3 h-4 w-4" />
                    Run a check to inspect the trace.
                  </div>
                )}
              </SectionBlock>
            </Panel>
            ) : null}

            {activePage === "apiKeys" ? (
            <Panel title="Scoped API Keys" description="Trusted inline Context Mode uses X-Plystra-API-Key, separate from bearer session management.">
              <MiniForm title="Create API Key" onSubmit={createAPIKey}>
                <LabeledInput label="Name" value={apiKeyDraft.name} onChange={(name) => setAPIKeyDraft({ ...apiKeyDraft, name })} required />
                <LabeledInput label="Level" value={apiKeyDraft.level} onChange={(level) => setAPIKeyDraft({ ...apiKeyDraft, level })} options={["instance", "space", "group"]} required />
                <LabeledInput label="Space ID" value={apiKeyDraft.space_id} onChange={(space_id) => setAPIKeyDraft({ ...apiKeyDraft, space_id })} />
                <LabeledInput label="Group ID" value={apiKeyDraft.group_id} onChange={(group_id) => setAPIKeyDraft({ ...apiKeyDraft, group_id })} />
                <LabeledInput label="Permissions" value={apiKeyDraft.permission_keys} onChange={(permission_keys) => setAPIKeyDraft({ ...apiKeyDraft, permission_keys })} placeholder="authz:check, audit:read" />
              </MiniForm>
              <DataTable columns={["id", "name", "level", "space_id", "group_id", "status", "created_at"]} state={loads.apiKeys} />
            </Panel>
            ) : null}

            {activePage === "extensions" ? (
            <Panel title="Plugins, Templates, and Data Console" description="Business plugin and data surfaces remain governed by system capabilities.">
              <SectionBlock title="Plugin Manifest">
                <form className="grid gap-3" onSubmit={(event) => void validatePluginManifest(event)}>
                  <div className="grid gap-1">
                    <Label>Manifest JSON</Label>
                    <Textarea value={pluginManifest} onChange={(event) => setPluginManifest(event.target.value)} spellCheck={false} className="min-h-[300px]" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">
                      <ShieldPlus className="h-4 w-4" />
                      Validate
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void installPlugin()}>
                      <PackageCheck className="h-4 w-4" />
                      Install
                    </Button>
                  </div>
                </form>
                {pluginValidation.error ? <ErrorText>{pluginValidation.error}</ErrorText> : null}
                {pluginValidation.data ? <JsonPreview value={unwrapData(pluginValidation.data)} /> : null}
              </SectionBlock>

              <SectionBlock title="Plugin Surfaces">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void updatePluginLifecycle("enable")}>
                    Enable
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void updatePluginLifecycle("disable")}>
                    Disable
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void updatePluginLifecycle("uninstall")}>
                    Uninstall
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void loadPluginSurface("pluginResources")}>
                    Resources
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void loadPluginSurface("pluginPermissions")}>
                    Permissions
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void loadPluginSurface("pluginAdminMenus")}>
                    Admin Menus
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void loadPluginSurface("pluginSettings")}>
                    Settings
                  </Button>
                </div>
                <div className="grid gap-4">
                  <DataCluster title="Plugins" action={() => void loadState("plugins", "/api/v1/plugins?limit=50", "session")} columns={["id", "key", "name", "version", "status", "resources_count", "permissions_count", "admin_menus_count"]} state={loads.plugins} />
                  <DataCluster title="Plugin Resources" action={() => void loadPluginSurface("pluginResources")} columns={["key", "display_name", "source", "status"]} state={loads.pluginResources} />
                  <DataCluster title="Plugin Permissions" action={() => void loadPluginSurface("pluginPermissions")} columns={["id", "resource", "action", "scope", "status"]} state={loads.pluginPermissions} />
                  <DataCluster title="Plugin Audit Events" action={() => void loadPluginSurface("pluginAuditEvents")} columns={["id", "key", "risk_level", "default_audit"]} state={loads.pluginAuditEvents} />
                  <DataCluster title="Plugin Admin Menus" action={() => void loadPluginSurface("pluginAdminMenus")} columns={["id", "label", "path", "required_permission", "sort_order"]} state={loads.pluginAdminMenus} />
                  <DataCluster title="Plugin Settings" action={() => void loadPluginSurface("pluginSettings")} columns={["id", "key", "value_type", "scope", "value"]} state={loads.pluginSettings} />
                </div>
              </SectionBlock>

              <SectionBlock title="Templates">
                <DataTable
                  columns={["id", "name", "version", "requires_core"]}
                  state={loads.templates}
                  rowActions={(row) => (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void installTemplate(valueText(row.id), true)}>
                        Preview
                      </Button>
                      <Button size="sm" onClick={() => void installTemplate(valueText(row.id), false)}>
                        Install
                      </Button>
                    </div>
                  )}
                />
                <Button variant="outline" size="sm" onClick={() => void loadState("templates", "/api/v1/templates?limit=50", "session")}>
                  Load Templates
                </Button>
              </SectionBlock>

              <SectionBlock title="Data Console">
                <div className="grid gap-5 lg:grid-cols-2">
                  <form className="grid gap-2 border-l pl-3" onSubmit={(event) => void loadDataRows(event)}>
                    <LabeledInput label="Resource Type" value={dataDraft.resource_type} onChange={(resource_type) => setDataDraft({ ...dataDraft, resource_type })} required />
                    <LabeledInput label="Space ID" value={dataDraft.space_id} onChange={(space_id) => setDataDraft({ ...dataDraft, space_id })} />
                    <Button type="submit" variant="outline">
                      <Database className="h-4 w-4" />
                      Load Rows
                    </Button>
                  </form>
                  <form className="grid gap-2 border-l pl-3" onSubmit={(event) => void createDataRow(event)}>
                    <Label>Data Row JSON</Label>
                    <Textarea value={dataRowBody} onChange={(event) => setDataRowBody(event.target.value)} spellCheck={false} className="min-h-[190px]" />
                    <Button type="submit" variant="outline">
                      Create Row
                    </Button>
                  </form>
                </div>
                <DataCluster title="Data Tables" action={() => void loadState("dataTables", "/api/v1/data/tables?limit=50", "session")} columns={["resource_type", "display_name", "storage_kind", "source", "status"]} state={loads.dataTables} />
                <DataCluster title="Data Rows" action={() => void loadDataRows()} columns={["id", "resource_type", "space_id", "group_path", "owner_member_id", "visibility", "status"]} state={loads.dataRows} />
              </SectionBlock>
            </Panel>
            ) : null}

            {activePage === "audit" ? (
            <Panel title="Audit">
              <div className="grid gap-4">
                <DataCluster
                  title="Global Audit"
                  action={() => void loadState("audit", "/api/v1/audit/logs?limit=25", "session")}
                  columns={["id", "decision", "actor_user_id", "resource_type", "resource_id", "action", "created_at"]}
                  state={loads.audit}
                />
                <DataCluster
                  title="Space Audit"
                  action={() => void loadScopedSpaceData("spaceAudit")}
                  columns={["id", "decision", "actor_user_id", "resource_type", "resource_id", "action", "created_at"]}
                  state={loads.spaceAudit}
                />
              </div>
            </Panel>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

function ConsoleNavigation({ activePage }: { activePage: ConsolePage }) {
  return (
    <nav className="border bg-card" aria-label="Console sections">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Pages</h2>
      </div>
      <div className="grid gap-1 p-2">
        {consolePages.map((page) => {
          const active = page.id === activePage;
          return (
            <a
              key={page.id}
              href={`#${page.id}`}
              aria-current={active ? "page" : undefined}
              className={`grid gap-1 border px-3 py-2 text-left transition-colors ${
                active ? "border-foreground bg-foreground text-background" : "border-transparent hover:border-border hover:bg-muted"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {page.icon}
                {page.label}
              </span>
              <span className={`text-xs ${active ? "text-background/75" : "text-muted-foreground"}`}>{page.description}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <section className="border bg-card p-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </section>
  );
}

function SectionBlock({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function DataCluster({
  title,
  action,
  columns,
  state,
  json,
}: {
  title: string;
  action: () => void;
  columns?: string[];
  state: LoadState;
  json?: boolean;
}) {
  return (
    <section className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">{title}</h4>
        <Button size="sm" variant="outline" onClick={action}>
          Load
        </Button>
      </div>
      {json ? (
        <>
          {state.error ? <ErrorText>{state.error}</ErrorText> : null}
          <JsonPreview value={unwrapData(state.data) || {}} />
        </>
      ) : (
        <DataTable columns={columns || []} state={state} />
      )}
    </section>
  );
}

function CapabilityList({ state }: { state: LoadState }) {
  if (state.loading) {
    return <div className="border border-dashed p-4 text-sm text-muted-foreground">Loading capabilities...</div>;
  }
  if (state.error) {
    return <ErrorText>{state.error}</ErrorText>;
  }
  const data = unwrapDataMap(state.data);
  const states = asMap(data.states);
  const services = Array.isArray(data.services) ? data.services.map((service) => asMap(service)) : [];
  if (Object.keys(states).length === 0 && services.length === 0) {
    return <div className="border border-dashed p-4 text-sm text-muted-foreground">No capabilities loaded.</div>;
  }
  return (
    <div className="grid gap-3">
      {Object.entries(states).map(([id, status]) => (
        <div key={id} className="flex items-center justify-between gap-3 border p-3 text-sm">
          <span className="truncate">{id}</span>
          <Badge variant={status === "ready" ? "default" : "danger"}>{valueText(status)}</Badge>
        </div>
      ))}
      <div className="grid gap-1 text-xs text-muted-foreground">
        {services.slice(0, 8).map((service) => (
          <div key={valueText(service.name)} className="flex justify-between gap-3">
            <span>{valueText(service.name)}</span>
            <span>{valueText(service.capability_id)}</span>
          </div>
        ))}
      </div>
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

const adminPermissionOptions = [
  "*",
  "instance:read",
  "instance:manage",
  "users:read",
  "users:manage",
  "spaces:read",
  "spaces:manage",
  "groups:read",
  "groups:manage",
  "members:read",
  "members:manage",
  "user_members:read",
  "user_members:manage",
  "roles:read",
  "roles:manage",
  "permissions:read",
  "permissions:manage",
  "registry:read",
  "registry:manage",
  "resources:read",
  "resources:manage",
  "data:read",
  "data:manage",
  "admin_grants:read",
  "admin_grants:manage",
  "api_keys:read",
  "api_keys:create",
  "api_keys:revoke",
  "plugins:read",
  "plugins:manage",
  "templates:read",
  "templates:manage",
  "audit:read",
  "authz:check",
  "metrics:read",
];

function defaultPermissionForLevel(level: string, current: string) {
  if (level === "instance_super_admin") {
    return "*";
  }
  if (current === "*" || current === "") {
    return level === "group_admin" ? "groups:read" : "spaces:read";
  }
  return current;
}

function compactObject(value: Record<string, unknown>): JsonMap {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== undefined && item !== null));
}

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = valueText(value);
    if (text !== "-") {
      return text;
    }
  }
  return "-";
}

function titleFromKey(value: string) {
  return value
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pageFromHash(): ConsolePage {
  const raw = window.location.hash.replace(/^#/, "");
  return consolePages.some((page) => page.id === raw) ? (raw as ConsolePage) : "system";
}

function writeSessionStorage(key: string, value: string) {
  if (value.trim() === "") {
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, value);
  }
}
