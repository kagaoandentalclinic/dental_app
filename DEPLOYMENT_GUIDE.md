# Deployment Guide: Vercel Frontend + Railway Backend

This guide explains how to redeploy this project from a new GitHub, Vercel, or Railway account.

Recommended order:

1. Put the code in the new GitHub account.
2. Deploy the backend and PostgreSQL database on Railway.
3. Deploy the frontend on Vercel.
4. Connect the frontend and backend URLs through environment variables.

Official docs used for this guide:

- Vercel Vite apps: https://vercel.com/docs/frameworks/frontend/vite
- Vercel monorepos: https://vercel.com/docs/monorepos
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Railway services: https://docs.railway.com/guides/services
- Railway monorepos: https://docs.railway.com/guides/monorepo
- Railway PostgreSQL: https://docs.railway.com/guides/postgresql
- Railway variables: https://docs.railway.com/variables
- Railway public domains: https://docs.railway.com/networking/domains/working-with-domains

## Project Structure

```text
Dental_Health_V1.0/
  client/   React + Vite frontend
  server/   Express API backend
```

Frontend:

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Main environment variable: `VITE_API_URL`

Backend:

- Root directory: `server`
- Start command: `npm start`
- The start script runs database migrations before starting the API.
- Main environment variables: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV`

## 1. Move the Repo to the New GitHub Account

Use one of these options.

### Option A: Transfer the repository

1. Open the current GitHub repository.
2. Go to `Settings`.
3. Go to `General`.
4. Scroll to `Danger Zone`.
5. Choose `Transfer ownership`.
6. Transfer it to the new GitHub account or organization.
7. Accept the transfer from the destination account.

### Option B: Fork or re-upload the repository

1. Create a new empty GitHub repository in the destination account.
2. On your local machine, update the remote:

```bash
git remote set-url origin https://github.com/NEW_ACCOUNT/NEW_REPO.git
git push -u origin main
```

Replace `NEW_ACCOUNT` and `NEW_REPO`.

Important: do not commit `.env` files. Production secrets should be entered in Railway and Vercel dashboards.

## 2. Deploy the Backend on Railway

Do this first because the frontend needs the backend API URL.

### 2.1 Create a Railway project

1. Log in to the new Railway account.
2. Click `New Project`.
3. Choose `Deploy from GitHub repo`.
4. Connect the new GitHub account if Railway asks for access.
5. Select this repository.

### 2.2 Configure the backend service

If Railway detects multiple services, choose the `server` app for the backend.

If you configure it manually:

1. Open the backend service.
2. Go to `Settings`.
3. Set `Root Directory` to:

```text
/server
```

4. Confirm the service uses the server package:

```text
Build command: npm install
Start command: npm start
```

The repo also contains `server/railway.json`, so Railway can read the backend start command from that file.

### 2.3 Add PostgreSQL

1. In the Railway project canvas, click `+ New`.
2. Choose `Database`.
3. Choose `PostgreSQL`.
4. Wait for the Postgres service to finish provisioning.

Railway exposes database variables such as `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`.

### 2.4 Add backend environment variables

Open the backend service, then go to `Variables`.

Add:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=https://your-vercel-frontend-domain.vercel.app
```

Notes:

- The `Postgres` part in `${{Postgres.DATABASE_URL}}` must match the exact Railway Postgres service name. If your service is named differently, use that name.
- `CLIENT_URL` is used by CORS. At first, you may not know the Vercel URL yet. You can temporarily set it after the Vercel deployment, then redeploy the backend.
- Generate a fresh `JWT_SECRET` for the new account. Do not reuse local development secrets.

Optional database variables:

```env
DB_CONNECT_RETRIES=10
DB_CONNECT_RETRY_DELAY_MS=2000
```

### 2.5 Deploy the backend

1. In Railway, deploy the backend service.
2. Watch the deployment logs.
3. Confirm the migration step runs successfully.
4. Confirm the server starts without database connection errors.

The backend health check route is:

```text
/api/health
```

### 2.6 Generate the Railway public backend URL

1. Open the backend service.
2. Go to `Settings`.
3. Find `Networking` or `Public Networking`.
4. Click `Generate Domain`.
5. Copy the generated Railway URL.

Example:

```text
https://your-backend.up.railway.app
```

Test it in the browser:

```text
https://your-backend.up.railway.app/api/health
```

Expected response:

```json
{ "status": "ok", "version": "1.0.0" }
```

## 3. Initialize the Production Database

The backend start command automatically runs migrations:

```bash
npm run migrate
```

That creates or updates the database schema.

If this is a brand-new database and you need the default demo admin account, run the seed script once from the Railway backend service shell or one-off command:

```bash
npm run db:setup
```

Default seeded login:

```text
Username: admin
Password: admin123
```

Important after seeding:

1. Log in immediately.
2. Change the admin password.
3. Delete or replace demo patients if this is a real production clinic database.

Do not run the seed script repeatedly in production unless you intentionally want to reset the seeded admin password and insert demo data.

## 4. Deploy the Frontend on Vercel

### 4.1 Create the Vercel project

1. Log in to the new Vercel account.
2. Click `Add New`.
3. Choose `Project`.
4. Import the GitHub repository.
5. When Vercel asks for the project root, set:

```text
client
```

This is important because the frontend is inside the `client` folder.

### 4.2 Configure Vercel build settings

Use these settings:

```text
Framework Preset: Vite
Root Directory: client
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

The file `client/vercel.json` already contains the SPA rewrite needed for React Router routes:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 4.3 Add frontend environment variable

In the Vercel project, go to `Settings` then `Environment Variables`.

Add this variable for Production, Preview, and Development if needed:

```env
VITE_API_URL=https://your-backend.up.railway.app/api
```

Important:

- Vite only exposes browser environment variables that start with `VITE_`.
- The value must include `/api` at the end.
- Do not add a trailing slash unless you also update the API client code.

### 4.4 Deploy the frontend

1. Click `Deploy`.
2. Wait for the build to complete.
3. Open the generated Vercel URL.

Example:

```text
https://your-frontend.vercel.app
```

## 5. Connect CORS After Both URLs Exist

After Vercel gives you the final frontend URL:

1. Go back to Railway.
2. Open the backend service.
3. Go to `Variables`.
4. Set:

```env
CLIENT_URL=https://your-frontend.vercel.app
```

5. Redeploy the backend service.

Without this step, the browser may block frontend requests with a CORS error.

If you use a custom frontend domain later, update `CLIENT_URL` again:

```env
CLIENT_URL=https://your-custom-domain.com
```

Then redeploy the backend.

## 6. Final Production Test Checklist

Use this checklist after both deployments finish.

1. Open:

```text
https://your-backend.up.railway.app/api/health
```

2. Confirm it returns:

```json
{ "status": "ok", "version": "1.0.0" }
```

3. Open the Vercel frontend URL.
4. Log in.
5. Open Dashboard.
6. Open Patients.
7. Add or view a patient.
8. Open Appointments.
9. Test a public form route if enabled:

```text
/intake/:slug
/appointment/:slug
/kiosk
```

10. Check Railway logs for API errors.
11. Check the browser console for CORS or failed request errors.

## 7. Common Problems and Fixes

### Frontend shows network errors

Check Vercel `VITE_API_URL`.

Correct:

```env
VITE_API_URL=https://your-backend.up.railway.app/api
```

Wrong:

```env
VITE_API_URL=https://your-backend.up.railway.app
```

After changing Vercel environment variables, redeploy the frontend.

### Browser shows CORS errors

Check Railway `CLIENT_URL`.

Correct:

```env
CLIENT_URL=https://your-frontend.vercel.app
```

After changing Railway variables, redeploy the backend.

### Backend cannot connect to database

Check Railway backend variables.

Recommended:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
```

Also confirm the Postgres service is in the same Railway project and environment.

### Login does not work after migration

If the database is empty, run the seed script once:

```bash
npm run db:setup
```

Then log in with:

```text
admin / admin123
```

Change the password immediately after login.

### React routes show 404 on refresh

Confirm Vercel is deploying from the `client` directory and that `client/vercel.json` is included in the deployment.

The rewrite should send all frontend routes to `index.html`.

## 8. Environment Variable Summary

### Railway backend

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=https://your-frontend.vercel.app
```

### Vercel frontend

```env
VITE_API_URL=https://your-backend.up.railway.app/api
```

## 9. Migration Safety Notes

Before switching accounts or domains:

1. Export or back up the old production database.
2. Keep the old deployment running until the new one is tested.
3. Use a new `JWT_SECRET`; existing login tokens from the old deployment should not carry over.
4. Do not copy `.env` files into GitHub.
5. Update DNS only after both Railway and Vercel deployments are confirmed working.
6. If using custom domains, update both sides:
   - Vercel frontend domain
   - Railway `CLIENT_URL`
   - Vercel `VITE_API_URL` if the backend domain changes

