# Deployment Guide (Latest)

This document is the latest deploy flow for this repo (Vercel + EC2 + RDS).

## 1) Backend on EC2

```bash
cd /var/www
git clone https://github.com/chitsanupongjitmal/project-network-e2ee-cloud.git
cd project-network-e2ee-cloud/backend
cp .env.example .env
npm install
```

Required `.env` (backend):
- `NODE_ENV=production`
- `PORT=4001`
- `ENABLE_HTTPS=false`
- `JWT_SECRET=...`
- `CORS_ORIGIN=https://project-network-e2ee-cloud.vercel.app,https://project-network-e2ee-cloud-git-main-beam3.vercel.app`
- `DB_HOST=<rds-endpoint>`
- `DB_PORT=3306`
- `DB_USER=<db-user>`
- `DB_PASSWORD=<db-password>`
- `DB_NAME=pj_network`
- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=false`
- `SOCKET_IO_PATH=/api/ws`

Run with PM2:
```bash
cd /var/www/project-network-e2ee-cloud/backend
pm2 start ecosystem.config.cjs --name project-network-api
pm2 save
pm2 startup
```

Health check:
```bash
curl -i http://127.0.0.1:4001/health
```

## 2) Nginx Reverse Proxy (EC2)

Install config from repo template:
- `deploy/nginx/api.yourdomain.com.conf`

If using IP directly (no domain), keep proxy pass to `http://127.0.0.1:4001`.

After edit:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Check:
```bash
curl -i http://127.0.0.1/health
curl -i http://<EC2_PUBLIC_IP>/health
```

## 3) RDS MariaDB

Create DB `pj_network` and import base schema:
```bash
mysql -h <rds-endpoint> -P 3306 -u <db-user> -p --ssl-mode=REQUIRED pj_network < /var/www/project-network-e2ee-cloud/SQL_PJNETWORK.sql
```

Run incremental migrations (latest):
```bash
mysql -h <rds-endpoint> -P 3306 -u <db-user> -p --ssl-mode=REQUIRED pj_network < /var/www/project-network-e2ee-cloud/deploy/sql/20260307_add_user_approval_and_group_permission.sql
mysql -h <rds-endpoint> -P 3306 -u <db-user> -p --ssl-mode=REQUIRED pj_network < /var/www/project-network-e2ee-cloud/deploy/sql/20260307_add_post_image.sql
mysql -h <rds-endpoint> -P 3306 -u <db-user> -p --ssl-mode=REQUIRED pj_network < /var/www/project-network-e2ee-cloud/deploy/sql/20260307_add_group_avatar.sql
mysql -h <rds-endpoint> -P 3306 -u <db-user> -p --ssl-mode=REQUIRED pj_network < /var/www/project-network-e2ee-cloud/deploy/sql/20260307_add_call_history.sql
```

## 4) Frontend on Vercel

Project root: `frontend/`

Env vars:
- `VITE_SERVER_URL=` (empty when using rewrite mode)
- `VITE_SOCKET_URL=` (empty for rewrite mode, or set `wss://api.yourdomain.com`)
- `VITE_SOCKET_PATH=/api/ws`
- `VITE_ICE_SERVERS=<json array>`

`frontend/vercel.json` should include rewrites for:
- `/api/:path* -> http://<EC2_PUBLIC_IP>/api/:path*`
- `/api/ws/:path* -> http://<EC2_PUBLIC_IP>/api/ws/:path*`
- `/uploads/:path* -> http://<EC2_PUBLIC_IP>/uploads/:path*`

Then redeploy production.

## 5) Update Flow (after new commit)

On EC2:
```bash
cd /var/www/project-network-e2ee-cloud
git pull origin main
cd backend
pm2 restart project-network-api --update-env
sleep 2
curl -i http://127.0.0.1:4001/health
```

On Vercel:
- Redeploy production
- Hard refresh browser

## 6) Quick Troubleshooting

- `502 Bad Gateway`: Nginx upstream port wrong (`3000` vs `4001`)
- `ER_SECURE_TRANSPORT_REQUIRED`: set `DB_SSL=true`
- `Unknown database`: set `DB_NAME=pj_network`
- Socket polling returns HTML: rewrite/path mismatch (`/api/ws`)
- Login 401: wrong username/password (username, not display name)
