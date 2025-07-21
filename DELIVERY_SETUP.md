# Delivery Management Setup

This document explains how to set up the delivery management functionality in the Lazy Bread POS system.

## Features Added

### 1. Stripe Payment Capture API
- **Endpoint**: `/api/stripe/capture-payment`
- **Method**: POST
- **Purpose**: Captures a pending payment intent to complete the transaction
- **Payload**: `{ paymentIntentId: string }`

### 2. Stripe Payment Status API
- **Endpoint**: `/api/stripe/status-payment`
- **Method**: POST
- **Purpose**: Retrieves payment intent status from Stripe
- **Payload**: `{ paymentIntentId: string }`

### 3. Order Status Update API
- **Endpoint**: `/api/orders/update-status`
- **Method**: POST
- **Purpose**: Updates order status via AWS API Gateway
- **Payload**: `{ orderId: string, status: string }`

### 4. Delivery Service
- **File**: `/lib/deliveryService.ts`
- **Purpose**: Provides separate functions for payment capture and status update
- **Functions**: 
  - `capturePayment(paymentIntentId)`: Captures payment intent
  - `markOrderAsDelivered(orderId)`: Updates order status to delivered
  - `getPaymentIntentStatus(paymentIntentId)`: Gets payment status

### 5. Frontend Payment and Delivery Buttons
- **Location**: OrdersList component
- **Features**:
  - "Capture Payment" button for orders with payment intents
  - "Mark as Delivered" button for each order
  - Loading states with spinner for both actions
  - Success/error messages for both operations
  - Automatic order refresh after actions
  - Disabled states for completed actions
  - Payment status display

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_API_KEY=sk_test_your_stripe_secret_key_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here

# Orders API Configuration
ORDERS_API_URL=https://your-api-gateway-url.amazonaws.com
```

## Firebase Setup

1. Create a Firebase project
2. Enable Firestore database
3. Create a collection called `orders`
4. Set up security rules for the orders collection

## Usage

1. Navigate to the Orders tab in the POS system
2. Select a delivery date
3. For each order, you can:
   - **Capture Payment**: Click "Capture Payment" to capture the payment intent (if available)
   - **Mark as Delivered**: Click "Mark as Delivered" to update the order status
4. The system will:
   - Show loading states during operations
   - Display success/error messages
   - Automatically refresh the order list
   - Update payment and delivery statuses

## Error Handling

The system handles various error scenarios:
- Payment capture failures
- Payment status retrieval errors
- Order status update failures
- Invalid order IDs
- Network errors
- Stripe API errors

All errors are displayed to the user with appropriate messages for both payment and delivery operations.

## Dependencies Added

- `firebase`: For Firebase Firestore operations
- Existing `stripe`: For payment intent capture

## File Structure

```
src/
├── app/
│   └── api/
│       ├── stripe/
│       │   ├── capture-payment/
│       │   │   └── route.ts
│       │   └── status-payment/
│       │       └── route.ts
│       └── orders/
│           └── update-status/
│               └── route.ts
├── lib/
│   └── deliveryService.ts
└── components/
    └── OrdersList.tsx (updated)
``` 