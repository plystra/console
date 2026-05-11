import { CheckCircle2 } from "lucide-react";
import { FormEvent, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { asMap, unwrapData, unwrapList, valueText } from "@/lib/api";
import { cn } from "@/lib/utils";
import { JsonMap, LoadState } from "@/types";

export function Panel({
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

export function StatusBlock({ title, icon, state }: { title: string; icon: ReactNode; state: LoadState }) {
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

export function AdminContextPreview({ state, hasToken }: { state: LoadState; hasToken: boolean }) {
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

export function DataTable({
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

export function ActionForms({
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

export function AdminGrantForm({
  draft,
  setDraft,
  onSubmit,
}: {
  draft: { user_id: string; level: string; permission_key: string; space_id: string; group_id: string };
  setDraft: (value: { user_id: string; level: string; permission_key: string; space_id: string; group_id: string }) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}) {
  return (
    <MiniForm title="Create Admin Grant" onSubmit={onSubmit}>
      <LabeledInput label="User ID" value={draft.user_id} onChange={(user_id) => setDraft({ ...draft, user_id })} required />
      <LabeledInput
        label="Level"
        value={draft.level}
        onChange={(level) => setDraft({ ...draft, level, permission_key: defaultPermissionForLevel(level, draft.permission_key) })}
        required
        options={["instance_super_admin", "instance_admin", "space_admin", "group_admin"]}
      />
      <LabeledInput
        label="Permission key"
        value={draft.permission_key}
        onChange={(permission_key) => setDraft({ ...draft, permission_key })}
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
      <LabeledInput label="Space ID" value={draft.space_id} onChange={(space_id) => setDraft({ ...draft, space_id })} />
      <LabeledInput label="Group ID" value={draft.group_id} onChange={(group_id) => setDraft({ ...draft, group_id })} />
    </MiniForm>
  );
}

export function MiniForm({ title, onSubmit, children }: { title: string; onSubmit: (event: FormEvent) => Promise<void>; children: ReactNode }) {
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

export function LabeledInput({
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

export function defaultPermissionForLevel(level: string, current: string) {
  if (level === "instance_super_admin") {
    return "*";
  }
  if (current === "*" || current === "") {
    return level === "group_admin" ? "groups:read" : "spaces:read";
  }
  return current;
}

export function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto border bg-muted p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <div className={cn("border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive")}>{children}</div>;
}
