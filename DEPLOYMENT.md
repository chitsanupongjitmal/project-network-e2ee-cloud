# Deployment Guide (Vercel + EC2 + MariaDB RDS)

## 1) Backend on EC2

1. Open EC2 security group inbound:
- `22` from your IP
- `80` from `0.0.0.0/0`
- `443` from `0.0.0.0/0`
- `4001` only from localhost/internal (if using Nginx reverse proxy)

2. Install Node.js 20+ on EC2 and clone project.

3. Backend setup:
```bash
cd backend
cp .env.example .env
# edit .env
npm install
npm run start
```

4. In `backend/.env` set at least:
- `NODE_ENV=production`
- `PORT=4001`
- `ENABLE_HTTPS=false`
- `CORS_ORIGIN=https://project-network-e2ee-cloud.vercel.app`
- `DB_HOST=pj-cloud.cfkywcoom7ye.ap-southeast-7.rds.amazonaws.com`, `DB_PORT=3306`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`

5. Use PM2 (recommended):
```bash
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 2) Nginx on EC2 (TLS + reverse proxy)

Use Nginx to terminate SSL and forward to Node at `http://127.0.0.1:4001`.

Use this file from repo as template:
- `deploy/nginx/api.yourdomain.com.conf`

Then install:
```bash
sudo cp deploy/nginx/api.yourdomain.com.conf /etc/nginx/sites-available/api.yourdomain.com.conf
sudo ln -s /etc/nginx/sites-available/api.yourdomain.com.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Reference config:
```nginx
server {
  listen 80;
  server_name api.yourdomain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name api.yourdomain.com;

  ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:4001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 3) MariaDB RDS

1. Create RDS MariaDB instance.
2. In RDS security group inbound, allow `3306` from EC2 security group.
3. Import schema from `SQL_PJNETWORK.sql`.
4. Put RDS endpoint credentials into `backend/.env`.

## 4) Frontend on Vercel

1. Import `frontend` folder as Vercel project.
2. Framework preset: `Vite`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add env var in Vercel:
- `VITE_SERVER_URL=http://43.209.239.254`

6. Redeploy.

## 5) Quick verification

1. Open `https://api.yourdomain.com/health` and expect `{"status":"ok"}`.
2. Open Vercel app, login/register should hit `https://api.yourdomain.com/api/...`
3. Browser console should not show CORS errors.
4. Socket should connect successfully.
5. EC2 logs (`pm2 logs`) should show traffic and no certificate read errors.
