# Sampaguita Coffee Shop

React storefront and Express/MongoDB API.

## Requirements

- Node.js 22 LTS (Node.js 20.19 or newer is required by the backend dependencies)
- MongoDB Community Server running locally, or a MongoDB Atlas connection string
- Firebase project access if Google sign-in is needed

## Get the project

For a computer that may need to pull updates or push changes, clone the repository rather than downloading a ZIP:

```powershell
git clone https://github.com/drewanski/flowershop.git
cd flowershop
```

A ZIP is also usable, but it does not include Git history/remotes. Extract it and open a terminal in the extracted project folder.

## Install

Install each workspace separately to avoid npm hoisting issues in this project:

```powershell
cd backend
npm install --workspaces=false
Copy-Item .env.example .env
```

Edit `backend/.env` and set a private, long random `JWT_SECRET`. Set `MONGODB_URI` to the local MongoDB URI or your Atlas URI. Keep `.env` private; it is gitignored.

Then install the frontend:

```powershell
cd ..\frontend
npm install --workspaces=false
```

## Prepare a local database

Start MongoDB first. The default database is `coffeeshop` at `mongodb://localhost:27017/coffeeshop`. Database records are not included in the source ZIP or Git repository.

Create a local admin account, then seed the sample catalog. Run these once from the `backend` folder:

```powershell
cd ..\backend
node scripts/create-local-admin.js
npm run seed:test-products
```

The admin script prints a one-time generated password. Save it securely. The seed script adds or updates four `TEST-FLOWER-*` products and is safe to rerun. To use MongoDB Atlas instead, put the Atlas connection string in `MONGODB_URI` before these commands.

## Configure Google sign-in

The frontend Firebase client configuration in `frontend/src/firebase/firebase.js` currently targets the project's Firebase app `sampaguitadeselva`. In Firebase Console:

1. Open **Authentication → Sign-in method** and enable Google.
2. Add `localhost` to **Authentication → Settings → Authorized domains**.
3. If using your own Firebase project, update the frontend Firebase configuration and set `FIREBASE_PROJECT_ID` in `backend/.env` to the same project ID.

The backend verifies Firebase ID tokens and issues the API's own JWT. Do not put Firebase service-account private keys or production secrets in the repository.

## Run locally

Use two PowerShell terminals. Start the API first:

```powershell
cd backend
npm start
```

It listens on `http://localhost:5000`; health check: `http://localhost:5000/health`.

Start React in the second terminal:

```powershell
cd frontend
$env:PORT='3000'
$env:REACT_APP_API_BASE_URL='http://localhost:5000/api'
npm start
```

Open `http://localhost:3000`. The root route is the landing page; products are at `/shop`, customer login/signup are `/login` and `/signup`, and employee/admin login is `/employee-login`.

If port 3000 is already in use, choose another React port such as 3001 and make sure it is included in `CORS_ORIGINS` in `backend/.env`.

## Database access

In MongoDB Compass connect to the value of `MONGODB_URI`, then open the `coffeeshop` database. Collections include `users`, `products`, `orders`, `vouchertemplates`, `voucherinstances`, `contactmessages`, and `employeelogs`.

## Verify

```powershell
cd frontend
npm run build
```

The backend contains an integration smoke test at `backend/scripts/integration-smoke-test.js`; run it only against a development database because it creates and removes temporary records.