# Lazy Bread POS System

This is a [Next.js](https://nextjs.org) project for the Lazy Bread Point of Sale system with Stripe Terminal integration and online order management.

## Features

- **Point of Sale**: Process in-person payments using Stripe Terminal
- **Online Orders**: View and manage online orders with delivery date grouping
- **Delivery Maps**: Visualize delivery routes using Google Maps
- **Order Management**: Track orders, revenue, and bread quantities by delivery date

## Getting Started

### Prerequisites

1. **Stripe Account**: Set up a Stripe account and get your API keys
2. **Google Maps API Key**: Required for delivery map functionality
3. **Stripe Terminal Reader**: Physical card reader for in-person payments

### Environment Setup

Create a `.env.local` file in the project root with the following variables:

```env
# Stripe Configuration
STRIPE_API_KEY=sk_test_your_stripe_secret_key_here

# Google Maps Configuration
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# NextAuth Configuration
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### Google Maps API Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Geocoding API
4. Create credentials (API Key)
5. Add the API key to your `.env.local` file as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### Running the Application

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
