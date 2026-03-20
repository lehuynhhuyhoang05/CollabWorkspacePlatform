# Collaborative Workspace Platform

## Cho teammate Frontend

### API Base URL
```
Development: http://localhost:3000
Production:  https://your-domain.com/api
```

### Auth Flow
```
POST /auth/register  { email, password, name }
POST /auth/login     { email, password }
  → { accessToken, refreshToken }

// Gửi accessToken trong header:
Authorization: Bearer <accessToken>

// Khi accessToken hết hạn (401):
POST /auth/refresh  { refreshToken }
  → { accessToken, refreshToken }
```

### WebSocket Connection
```javascript
import { io } from 'socket.io-client';

const socket = io('https://your-domain.com/collaboration', {
  auth: { token: accessToken }
});

// Join page
socket.emit('join-page', { pageId });

// Nhận thay đổi
socket.on('block-updated', ({ blockId, content, userId }) => { ... });
socket.on('user-joined', ({ userId, name, color }) => { ... });
socket.on('cursor-moved', ({ userId, position }) => { ... });

// Gửi thay đổi
socket.emit('block-update', { pageId, blockId, content });
socket.emit('cursor-move', { pageId, position });
```

### Block Content Format (Tiptap JSON)
```json
{
  "type": "doc",
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "Hello" }] }
  ]
}
```

### File Upload
```
POST /storage/upload
Content-Type: multipart/form-data
Body: { file: <File> }
→ { objectName, url }
```

### Màu user cho cursor
Backend tự assign màu theo userId — nhận từ `user-joined` event field `color`.

---

## Setup local

### Chạy backend local
```bash
# 1. Clone repo
git clone ...
cd backend

# 2. Copy env
cp .env.example .env
# Điền Oracle DB credentials vào .env

# 3. Chạy
docker compose up -d redis
npm install
npm run start:dev
```

### Endpoints đầy đủ
Xem file `PROJECT.md` phần API Endpoints.
