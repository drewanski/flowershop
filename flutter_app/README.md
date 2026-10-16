# Kape & Co. — Flutter customer app

This is a separate Flutter implementation of the **customer side**. It uses the existing Express API, MongoDB accounts, product stock, vouchers, orders and PayMongo payment integration. Admin, crew and rider operations stay in the existing React web application. Staff credentials are rejected by this customer app.

## Features

- Responsive coffee menu, search, category filters, price sorting and bundled product photography.
- Product sizes/grinds/sweetness, permitted extras, stock checks and live estimated prices.
- Favorites and a bag scoped to the current customer. A guest bag merges once on sign-in; signing out hides the customer's saved bag and address.
- Email/username/phone login, customer registration, password-reset code flow and profile editing.
- Checkout requires customer sign-in. Delivery address search and a draggable-view/tappable map pin use the existing server geocoding routes; address fields remain editable.
- Voucher discovery, claiming, selection and server-calculated totals.
- Cash on delivery or hosted PayMongo online checkout. Only the backend can verify payment; returning from the browser never marks an order paid on its own.
- Order history, itemized receipts, cancellation where allowed, and preparation/rider/delivery status updates with Philippine timestamps.
- Contact form and consistent local Poppins/Gilda fonts.

## Run locally

Use Flutter 3.47.2 / Dart 3.13.2 or a compatible newer SDK. Start the existing backend on port 5000 first (see the parent project README). Both apps use the same backend and database.

```powershell
cd flutter_app
flutter pub get
flutter run -d web-server --web-hostname localhost --web-port 3001
```

Open **http://localhost:3001** in Edge. Port 3001 is already in the backend's default local CORS allowlist. The React app can continue running on port 3000.

For an Android emulator, install Android Studio/Android SDK and start an emulator, then:

```powershell
flutter run -d <android-device-id>
```

The default Android API address is `http://10.0.2.2:5000/api`; web defaults to `http://localhost:5000/api`. Debug Android permits local HTTP. Release builds should use HTTPS.

For a physical phone or deployed API, set the API URL explicitly:

```powershell
flutter run -d <device-id> --dart-define=API_BASE_URL=https://your-api.example.com/api
flutter build apk --dart-define=API_BASE_URL=https://your-api.example.com/api
flutter build web --dart-define=API_BASE_URL=https://your-api.example.com/api
```

A phone cannot reach your computer through `localhost`. Use a reachable API hostname. iOS builds require macOS/Xcode and signing; use an HTTPS API. Add your deployed Flutter web origin to backend `CORS_ORIGINS`.

Only the API base URL belongs in client configuration. **Do not put PayMongo secret keys, webhook secrets, database credentials or admin credentials in Dart, assets or `--dart-define`.** The existing backend owns these.

## Payment walkthrough

1. Sign in as a customer, customize a coffee and add it to the bag.
2. Continue to checkout, search/select a delivery pin, check the required address fields and apply a claimed voucher if wanted.
3. Choose online payment and place the order. The server creates a pending order and returns its secure PayMongo checkout link.
4. Complete payment in the external browser using the provider's test mode during demonstrations. Return to the Flutter app and tap **I completed payment / refresh** if needed. The app also checks while the order screen is open and when the app resumes.
5. The server queries PayMongo and reports payment status. The matching purchased bag clears only when payment is confirmed. Pending orders can reopen their payment link from order details.
6. Staff and riders use the existing React portals. Their status changes appear in Flutter order tracking.

The current backend payment success/cancel URLs point to the React storefront. Native app deep-link return is not configured: switch back to Flutter after hosted checkout. Production webhook delivery still depends on deploying a public HTTPS backend and configuring PayMongo there. Available payment methods depend on the merchant account and backend configuration.

## Validation and current limits

```powershell
flutter analyze
flutter test
flutter build web
```

Tests cover option/add-on prices and payloads, guest/customer isolation, staff rejection, authenticated API errors, matching-bag clearing and customer navigation. The web build and local browser preview have been checked. Android/iOS device builds have **not** been validated on this machine: Android SDK/emulator is absent and iOS requires a Mac.

Email/password accounts work with the existing backend. Google sign-in is not included; it needs a separately configured native Firebase/OAuth app. Password-reset email delivery uses the backend's existing mail configuration. Map tiles and address searches need internet connectivity; if lookup fails, customers can place a pin and complete the fields manually. Bag/favorites/address are local per device, while orders, accounts and voucher records are shared through the server.

Targets are Android, iOS and web. `windows_template` is an unused generated Windows scaffold kept outside Flutter's active platform directory; it is not a supported desktop target. This avoids requiring Windows Developer Mode/plugin symlinks for mobile/web development.

## Source guide

`lib/core.dart` contains API/session/bag state; `shop.dart` contains menu, products, favorites and bag; `checkout.dart` contains delivery/vouchers/order submission; `orders.dart` contains receipts/payment verification/tracking; `account.dart` contains authentication/profile/contact; `ui.dart` defines the shared visual components.

## Notifications

The app-bar bell opens the customer's saved notification inbox. It shares read state with the React customer site, shows unread counts, links to the affected order and supports marking individual/all displayed notifications read. While the app is active it checks every 10 seconds and shows an in-app alert for new arrivals. Closed-app operating-system push is not configured; saved notifications load on the next opening. No separate API keys or Firebase configuration are needed for this inbox.
