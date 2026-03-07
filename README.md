# Project Network E2EE Cloud

Secure social/chat platform for cloud deployment practice.

## Current Stack
- Frontend: React + Vite + Tailwind (Vercel)
- Backend: Node.js + Express + Socket.IO (EC2 + PM2 + Nginx)
- Database: MariaDB (AWS RDS, SSL required)

## Current Features
- JWT authentication
- Register flow with `approval_status` (pending/approved/rejected)
- Role system (`user`, `super-admin`)
- Super-admin page:
  - change role
  - approve/reject users
  - allow/deny group creation
  - delete user account
- Private chat + group chat
- End-to-end encryption key flow (client side)
- Realtime messaging with Socket.IO
- WebRTC voice call (private/group)
- Call history in Settings
- Feed posts (text + image)
- Profile avatar update
- Group settings (including group avatar)
- Light/Dark mode UI

## Repo Structure
- `frontend/` React app
- `backend/` API + socket server
- `deploy/` deploy configs and SQL migrations
- `SQL_PJNETWORK.sql` full schema snapshot
- `DEPLOYMENT.md` step-by-step deploy guide

## Local Development
1. Database
```bash
# create DB and import schema
mysql -u <user> -p < SQL_PJNETWORK.sql
```

2. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run start
```

3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Notes
- Production uses rewrite mode on Vercel (`/api/*`, `/api/ws/*`, `/uploads/*`) to backend.
- For best realtime stability, use a dedicated backend domain with `wss`.

## Status (Mar 8, 2026)
- Core cloud demo flow is complete and deployable.
