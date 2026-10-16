# Sampaguita

## Online payments

The payment return page also performs authenticated server-to-server reconciliation with PayMongo. It verifies the session ID, order reference, test/live mode, paid payment, PHP currency, and gross amount. Only the owning customer can request this check; redirect parameters cannot mark an order paid. This allows local test checkout to confirm payment without a public tunnel. Public webhooks are still needed to confirm payment when a customer closes the checkout before returning.

Checkout offers cash on delivery and PayMongo hosted online payment when the backend has both `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` in its ignored `.env`. The secret key stays on the server; this hosted flow does not require a frontend public key. Restart the backend after changing credentials.

Customers choose Card, GCash, or QR Ph on PayMongo. Unpaid orders reserve stock and cannot enter preparation. Order history and the payment result screen let customers resume an unpaid checkout. A successful browser redirect alone never marks an order paid. Signed payment events confirm the amount and PHP currency, then make the paid order available for staff preparation and normal rider fulfillment. Staff cannot manually mark an online payment paid. Cancelling an unpaid order expires the provider session before restoring stock; paid online cancellation requires a refund workflow.

Configure a public HTTPS webhook endpoint in the PayMongo dashboard, ending in `/api/payments/paymongo/webhook`, subscribed to `checkout_session.payment.paid`. Use its matching signing secret and test-mode keys for demonstrations. PayMongo cannot call localhost directly. Local configuration and a checkout page are not proof that external webhooks are reaching the server.

From `backend`, run `node scripts/online-payment-smoke.js` with the local API running. This test only allows `sk_test_` credentials. It creates real hosted test sessions, simulates signed notifications locally, verifies payment and fulfillment guards, tests provider expiry/cancellation, and removes its own records. It does not submit a card/wallet payment or verify external webhook delivery.

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

For production, also set `NODE_ENV=production`, an explicit trusted `CORS_ORIGINS`, and a strong `JWT_SECRET` (at least 32 random characters). If the API runs behind a trusted reverse proxy, set `TRUST_PROXY_HOPS` to the exact number of proxy hops. Never copy the development `.env` between machines.

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

The admin script prints a one-time generated password. Save it securely. The seed script inserts six coffee products and two optional add-ons. Reruns preserve existing prices, stock, and staff edits. For an existing flower sample catalog, run `npm run migrate:coffee` from `backend` to add coffee and phase out the eight known sample flower SKUs while preserving order history. Custom products can be edited or phased out in the admin panel. To use MongoDB Atlas instead, put the Atlas connection string in `MONGODB_URI` before these commands.

## Configure Google sign-in

The frontend Firebase client configuration in `frontend/src/firebase/firebase.js` currently targets the project's Firebase app `sampaguitadeselva`. In Firebase Console:

1. Open **Authentication → Sign-in method** and enable Google.
2. Add `localhost` to **Authentication → Settings → Authorized domains**.
3. If using your own Firebase project, update the frontend Firebase configuration and set `FIREBASE_PROJECT_ID` in `backend/.env` to the same project ID.

The backend verifies Firebase ID tokens and issues the API's own JWT. Do not put Firebase service-account private keys or production secrets in the repository.

## Password reset email

Password reset uses Brevo SMTP API. Set `BREVO_API_KEY` and a verified sender address in `MAIL_FROM` in `backend/.env`. Reset codes are hashed in MongoDB, expire after 10 minutes, have a five-attempt limit, and successful resets revoke earlier API tokens. Without those mail settings, the reset endpoint reports that email is not configured.

## Configure PayMongo payments

Cash on delivery is available without provider credentials. The checkout UI only shows online payment after both PayMongo values are configured. To enable hosted card/GCash/Maya checkout, put a PayMongo test key and webhook secret in `backend/.env`:

```text
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=whsk_...
FRONTEND_BASE_URL=http://localhost:3000
```

Create a PayMongo webhook pointing to `https://YOUR_API_HOST/api/payments/paymongo/webhook` and subscribe to checkout-session payment paid, payment failed, and expired events. In local development, a hosted webhook receiver/tunnel is needed because PayMongo cannot call `localhost`. Keep both keys private. The app verifies webhook signatures; a browser redirect alone never marks an order paid. If either key is absent, the API offers cash only and safely rejects online checkout.

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

Open `http://localhost:3000`. The root route is the landing page; products are at `/shop`, customer login/signup are `/login` and `/signup`, and all roles sign in at `/login` (`/employee-login` redirects there).

If port 3000 is already in use, choose another React port such as 3001 and make sure it is included in `CORS_ORIGINS` in `backend/.env`.

## Database access

In MongoDB Compass connect to the value of `MONGODB_URI`, then open the `coffeeshop` database. Collections include `users`, `products`, `orders`, `vouchertemplates`, `voucherinstances`, `contactmessages`, and `employeelogs`.

## Verify

```powershell
cd frontend
npm run build
```

The backend contains an integration smoke test at `backend/scripts/integration-smoke-test.js`; run it only against a development database because it creates and removes temporary records.
## Coffee storefront

The storefront uses locally bundled coffee illustrations, a responsive cream/espresso/sage theme, and the existing product, stock, add-on, voucher, account, order, payment, and delivery APIs. Prices are in Philippine pesos. Product categories and coffee styles come from your database. Staff can manage coffee products and attach optional espresso shots or oat milk using the existing add-on controls.

```powershell
cd backend
npm run seed:coffee
# Existing sample flower database:
npm run migrate:coffee
```

The migration only phases out the known sample flower SKUs. It does not delete products, customers, or historical orders. Start MongoDB and create an admin account before running it.

## Coffee ordering

Customers can browse, search, sort, save favorites in their browser, and open shareable `/products/:productId` pages. Coffee choices are configured per product in the staff product editor: size, temperature, sweetness, or bean grind. Each choice may add a price per item. The server validates selections and recalculates prices for vouchers and order creation; submitted client prices are ignored. Different customizations remain separate bag lines. Choices and barista notes appear in customer, staff, and delivery order views.

The bag refreshes catalog prices, availability, and stock before checkout. Customers review items, options, delivery details, payment method, and totals before submitting. Required delivery coordinates still use the existing map workflow. Favorites and the shopping bag are local to the current browser.

`seed:coffee` adds missing choice groups to the known sample coffee catalog without overwriting existing nonempty customization groups, stock, or prices. The sample large drink adjustment is PHP30; staff should set actual portions and prices before launch.

Before operating publicly, supply the real store contact details, hours, delivery areas/fees, ingredient and allergen information, and provider credentials. Pickup/time slots and delivery-zone enforcement are not implemented. Verify the configured PayMongo webhook/payment flow and email delivery in the intended deployment environment before accepting customer orders.

## Cart and checkout flow

`/cart` contains compact item rows, quantity controls, totals, and the continue-to-checkout action. All delivery inputs are on `/checkout`, including its single delivery-address search field. Suggestions appear after typing pauses; selecting a match pins the map and reverse-fills the structured delivery address. Customers can drag the pin and expand address corrections for missing map details, unit numbers, or landmarks. Changes to search invalidate the previous pin. `/checkout` rechecks catalog prices/stock and contains the delivery address/map, delivery summary, vouchers, barista note, and available payment methods. A delivery address is not required to leave the cart; it is required before placing the order. Only its final action creates an order; online payment continues to the existing hosted PayMongo checkout.

Address search uses Mapbox when `MAPBOX_ACCESS_TOKEN` is set. Otherwise it uses the public Photon demo service with bounded Philippine results and a short server cache; this small-volume fallback has no availability guarantee. Configure `PHOTON_BASE_URL` for a dedicated/self-hosted Photon service or use Mapbox before production traffic. Reverse lookup retains the existing Mapbox/Nominatim integration. Photon documentation: https://github.com/komoot/photon/blob/master/docs/api-v1.md

## Order operations and presentation checks

Customers see readable progress stages, transition timestamps, cash/online payment status, delivery details, preparation notes, and filters for active/past orders. Customer, operations, and rider views refresh every 30 seconds while visible. Errors preserve the last loaded data and offer refresh.

The staff order queue searches order numbers, customer names, and coffees; filters by stage; shows oldest active work first; and exposes only relevant next actions. Unpaid online orders cannot be prepared. Staff cancellations request a reason, and concurrent status requests use a conditional database transition to prevent duplicate cancellation stock returns. Delivered cash orders accept tendered amount and calculate change; the backend rejects insufficient tender, mismatched change, early collection, or changes to previously recorded cash collection. Online payment status remains webhook-controlled.

Dashboard cards distinguish today's orders, active orders, paid collections today (using `paidAt`), and low-stock products. These are service metrics, not accounting or refund reports.

Run `node scripts/order-lifecycle-smoke.js` from `backend` with the local API running. It creates disposable customer/crew/rider accounts, a configured coffee and extra, and orders; checks stock, preparation/delivery transitions, cash collection, concurrent cancellation, history, and overselling; then removes its own records. It does not send emails or make external payments.

### Shared role-based sign-in

All accounts use `/login`. The authenticated backend account role determines the destination: customer ? `/userinfo`, crew/manager/admin ? `/adminpanel`, delivery ? `/delivery`. Customer checkout redirects are preserved. The old `/employee-login` address redirects to the same shared page. Account navigation and protected routes send signed-in users to their permitted workspace. Backend role authorization remains enforced independently of frontend redirects.

### Shopping sessions

Bags, saved favorites, delivery drafts, selected vouchers, and pending checkout markers are scoped to each customer in this browser. Guests have a separate temporary bag that merges once on customer sign-in; matching configurations combine quantities and the cart revalidates current prices/stock. Signing out hides the customer data and restores guest mode. Staff sessions do not expose shopping bags. Existing shared storage without an identifiable signed-in customer is retained under a legacy-unassigned namespace rather than exposed to guests or assigned to the next account. This is browser-local persistence, not cross-device cart synchronization.


## Flutter customer app

The customer-only Flutter app is in [`flutter_app`](flutter_app/README.md). It shares the existing backend and supports shopping, customer accounts, delivery checkout, vouchers, online/cash payment and order tracking. Admin, crew and rider tools remain in the React web app. See the Flutter README for setup, test commands and native-device limitations.


## Order notifications

Web accounts now have a **Notifications** inbox (bottom-right bell); the admin header bell opens the same inbox. The Flutter customer app has a notification bell in its app bar. Records are stored in MongoDB and have individual read state, an unread count, pagination and a mark-all-read action.

- Customers receive order-received, payment-confirmed, accepted, preparing, ready, rider-assigned, out-for-delivery, delivered and cancellation notifications for their own orders.
- Admin, manager and crew receive new-order/payment alerts and delivery/cancellation updates. Unpaid online orders explicitly say to wait for payment.
- Riders receive available-delivery alerts when an unassigned order becomes ready. An assigned order's ready/assignment alerts go to its rider; a rider also receives pickup confirmation and cancellation alerts for their assignment. Available-delivery alerts are historical notices: another rider may already have claimed the order when opened.

Clients check every **10 seconds while active**, plus when returning to the app. New arrivals show an in-app alert; older unread notifications remain in the inbox after login. These are **in-app notifications**, not operating-system push, email or SMS; a closed app receives its saved notifications on next opening. Events before this feature was installed are not backfilled.

The authenticated `/api/notifications` endpoints always filter by recipient and current role. Read-all uses the latest displayed record as a boundary so a newer unseen arrival remains unread. Unique recipient/event indexes deduplicate retries. Notification errors are logged without undoing an order or successful payment. Inbox polling has its own rate limit so it does not consume the checkout request budget.

Validation: backend notification recipient/ownership/deduplication tests, web inbox tests, Flutter feed tests, and a disposable all-role lifecycle integration script:

```powershell
cd backend
node scripts/notifications-smoke.js
```

The script uses temporary test users/products/orders, charges nothing and cleans up its records. Use against the local demonstration API/database only.
