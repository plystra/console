# Plystra Console

React inspector for the Plystra Kernel Phase 1 API. It connects to `/api/v1`, stores only the API base URL in `localStorage`, and keeps the scoped server API key in `sessionStorage`.

## Run

Start PostgreSQL, then run the kernel from the `kernel` repo:

```powershell
cd ..\kernel
$env:DATABASE_URL = "postgres://plystra:plystra@localhost:5432/plystra?sslmode=disable"
$env:PLYSTRA_API_KEY = "ply_kernel_secret"
go run .\cmd\plystrad migrate
go run .\cmd\plystrad serve
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
API key: ply_kernel_secret
```

## Included Surfaces

- System health, readiness, and version.
- System capability registry.
- Resource type registry.
- Context Mode authorization inspector for `/api/v1/authz/explain`.
- Recent audit log viewer.

Inline actor, resource, and grant context is trusted server-side input. The console is an operator/debugging surface; production applications should construct Context Mode payloads in their own backend.

## Build

```powershell
npm run build
```
