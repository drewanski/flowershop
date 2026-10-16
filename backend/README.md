# Coffee Shop Backend

Backend API for the Coffee Shop E-commerce System.

## Installation

npm install

## Development

npm run dev

## Production

npm start

## Environment Variables

Copy `.env.example` to `.env`.

For checkout address search, set `MAPBOX_ACCESS_TOKEN`. The token stays on the backend; address queries are sent to Mapbox and use permanent geocoding because selected coordinates are saved with delivery orders. Map browsing and manually placing the pin work without this token.

To offer online payments, set `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET`. Configure a PayMongo webhook for `checkout_session.payment.paid` at `https://<your-public-host>/api/payments/paymongo/webhook`; for local development, expose the backend through an HTTPS tunnel and register that URL in PayMongo. The frontend only displays online checkout when both server settings are present. Use PayMongo test credentials for development.
