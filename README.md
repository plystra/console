# Plystra Admin Console

React + shadcn/ui-style admin console for Plystra Core. It talks to Core through `/api/v1` and stores only the API base URL and the current Bearer access token in local browser storage.

## Run

Start Core first. With Docker:

```powershell
cd ..\plystra
docker compose up -d --build plystra-core
go run .\cmd\plystractl migrate up
```

Or run Core directly:

```powershell
cd ..\plystra
$env:PLYSTRA_DATABASE_URL = "postgres://plystra:plystra@localhost:5432/plystra?sslmode=disable"
go run .\cmd\plystrad
```

Start the Console:

```powershell
cd ..\console
npm install
npm run dev
```

Open `http://localhost:5173`, set:

```text
API base: http://localhost:8080
Email: alice@example.com
Password: plystra-demo
```

## Included Admin Surfaces

- System health, readiness, and version.
- Console overview counters.
- Users, Spaces, Resource Types, Permissions, Audit Logs, Admin Grants, Plugins, and Templates.
- Active Space context with Groups, Members, UserMembers, Roles, MemberRoles, and Space Resources.
- Create User, Space, Resource Type, and Permission.
- View, create, and revoke AdminGrants for instance, Space, and Group administrators.
- Authorization Inspector for `/api/v1/authz/explain`.

## Build

```powershell
npm run build
```
