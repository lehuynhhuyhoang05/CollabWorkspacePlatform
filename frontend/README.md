# Collaborative Workspace Frontend

Production API target:
- https://api.huyhoang05.id.vn/api/v1

## Run locally

1. Copy env file:

   cp .env.example .env

2. Install dependencies:

   npm install

3. Start dev server:

   npm run dev

## Scripts

- npm run dev
- npm run build
- npm run preview
- npm run check

## Testing workflow

- Follow: ../docs/FRONTEND_TEST_WORKFLOW.md
- Follow (Vietnamese): ../docs/FRONTEND_TEST_WORKFLOW.vi.md
- This is the standard release gate before opening a frontend PR.

## Implemented features

- JWT auth flow (register/login/refresh/logout)
- Protected routes with persisted session store
- Workspace CRUD
- Member management (invite/update role/remove)
- Page tree + page detail editing
- Block CRUD
- Comment CRUD per block
- Upload image to storage
- Share link generation and public shared page view
- Workspace search
- Socket collaboration presence on page detail

## API contract

This frontend expects the backend response envelope:

{
  "success": true,
  "data": {}
}

Error shape:

{
  "success": false,
  "statusCode": 400,
  "message": "...",
  "path": "/api/v1/...",
  "timestamp": "..."
}
