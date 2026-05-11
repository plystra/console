import { Database, FileClock, Layers3, Plug, ShieldCheck, UserCog, Users, Workflow } from "lucide-react";

import { EndpointConfig } from "@/types";

export const baseEndpoints: EndpointConfig[] = [
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

export function endpointsForSpace(spaceID: string): EndpointConfig[] {
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

export const initialAuthzRequest = JSON.stringify(
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
