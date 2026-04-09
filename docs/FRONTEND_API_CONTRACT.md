# Frontend API Contract

Base URL:
- Local: `http://localhost:3000/api/v1`
- Prod: `https://<domain>/api/v1`

## 1. Response envelope

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "statusCode": 403,
  "message": "Bạn không có quyền thực hiện thao tác này",
  "path": "/api/v1/pages/abc",
  "timestamp": "2026-03-22T00:00:00.000Z"
}
```

## 2. Auth flow

### POST /auth/register
Request:

```json
{
  "email": "demo_owner@example.com",
  "name": "Demo Owner",
  "password": "StrongP@ssw0rd"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  }
}
```

### POST /auth/login
Request:

```json
{
  "email": "demo_owner@example.com",
  "password": "StrongP@ssw0rd"
}
```

### POST /auth/refresh
Request:

```json
{
  "refreshToken": "<jwt>"
}
```

Notes:
- May return `429` when refresh called too frequently.

## 3. Workspace flow

### POST /workspaces
Request:

```json
{ "name": "Demo Workspace" }
```

### GET /workspaces
Returns list of workspaces for current user.

### POST /workspaces/:id/invite
Request:

```json
{
  "email": "demo_viewer@example.com",
  "role": "viewer"
}
```

## 4. Page + Block flow

### POST /workspaces/:wid/pages
Request:

```json
{
  "title": "Project Plan",
  "icon": "📄"
}
```

### GET /pages/:id
Response excerpt:

```json
{
  "success": true,
  "data": {
    "id": "<pageId>",
    "title": "Project Plan",
    "blocks": []
  }
}
```

### POST /pages/:pid/blocks
Request:

```json
{
  "type": "paragraph",
  "content": "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Hello\"}]}]}"
}
```

## 5. Share flow

### POST /pages/:id/share
Request:

```json
{
  "permission": "view"
}
```

Response excerpt:

```json
{
  "success": true,
  "data": {
    "token": "<shareToken>",
    "permission": "view"
  }
}
```

### GET /share/:token
Public endpoint (no auth). Returns page snapshot and blocks.

## 6. Search flow

### GET /workspaces/:wid/search?q=<keyword>&limit=20
Response item:

```json
{
  "pageId": "<pageId>",
  "pageTitle": "Project Plan",
  "pageIcon": "📄",
  "matchType": "title",
  "snippet": "**Project** Plan"
}
```

## 7. Storage flow

### POST /storage/upload
- Multipart field: `file`
- Image only, max 5MB

Response:

```json
{
  "success": true,
  "data": {
    "objectName": "<key>",
    "url": "<presignedUrl>"
  }
}
```

## 8. WebSocket flow (collaboration)

Namespace: `/collaboration`

Client events:
- `join-page`
- `leave-page`
- `block-update`
- `block-create`
- `block-delete`
- `block-reorder`
- `cursor-move`

Server events:
- `user-joined`
- `user-left`
- `room-users`
- `block-updated`
- `block-created`
- `block-deleted`
- `block-reordered`
- `cursor-moved`
