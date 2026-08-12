# Razorpay Integration Foundation

This module provides the foundation for Razorpay payment gateway integration inside the Ghumne Chale FastAPI backend. It loads environment variables via Pydantic `BaseSettings` and manages a singleton client instance with built-in connection verification.

## Module Structure

- [config.py](file:///c:/Users/tanis/OneDrive/Desktop/Make%20My%20Trip/backend/app/payments/config.py): Configuration class that loads environment variables using Pydantic `BaseSettings`.
- [client.py](file:///c:/Users/tanis/OneDrive/Desktop/Make%20My%20Trip/backend/app/payments/client.py): Initializes the singleton `razorpay_client` and defines the connection health-check function.
- [__init__.py](file:///c:/Users/tanis/OneDrive/Desktop/Make%20My%20Trip/backend/app/payments/__init__.py): Exposes config settings, singleton client, and health check function.

---

## Getting Razorpay API Keys

### Step 1: Obtain Test Mode Keys
1. Create/Log into your account on the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Look at the top menu bar and make sure the mode toggle is set to **Test Mode**.
3. In the left navigation menu, go to **Settings** > **API Keys**.
4. Click on **Generate Key** to generate a new key pair.
5. Copy your **Key ID** and **Key Secret**. 
   > [!IMPORTANT]
   > Test mode Key IDs always start with the prefix `rzp_test_`.

### Step 2: Configure Environment Variables
Create or update your `.env` file in the backend root directory (or project root directory) with the retrieved keys:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_if_configured
```

---

## Switching to Production (Live) Keys

To process real payments, you must switch to live API keys.

1. Ensure your Razorpay account activation is fully approved by Razorpay.
2. In the [Razorpay Dashboard](https://dashboard.razorpay.com), toggle the mode switch in the top header to **Live Mode**.
3. Navigate to **Settings** > **API Keys** on the sidebar.
4. Generate a new API key pair.
   > [!IMPORTANT]
   > Live mode Key IDs always start with the prefix `rzp_live_`.
5. Replace the test keys in your environment variables/`.env` file with these live keys.
6. Restart the backend service to pick up the new configuration.

---

## Verifying Connection & Credentials

We provide a health-check utility to test the integration. It calls Razorpay's `/orders` endpoint with a limit of 1 to verify credentials.

```python
from app.payments import check_razorpay_health

health = check_razorpay_health()
if health["success"]:
    print(f"Connected successfully in {health['mode']} mode!")
else:
    print(f"Failed to connect: {health['message']}")
```

To run the verification script, execute the following from the `backend/` root directory:
```bash
python scratch/test_razorpay_order.py
```

---

## Configuring Webhooks (Razorpay Server-to-Server)

To handle transaction updates reliably (reconciliation, payments completed offline or outside the tab), configure a Razorpay Webhook.

### Webhook URL
- **Local Dev**: Use ngrok or a similar tunnel: `http://<ngrok-id>.ngrok-free.app/api/v1/payments/webhook`
- **Production**: `https://api.travelos.com/api/v1/payments/webhook`

### Configuration Steps
1. Navigate to your [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Go to **Settings** > **Webhooks** from the sidebar.
3. Click **Add New Webhook**.
4. Enter the **Webhook URL** (from above).
5. Specify a strong random string as the **Secret**. Save this value and assign it to `RAZORPAY_WEBHOOK_SECRET` in your `.env` file.
6. Under **Active Events**, select:
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
   - `qr_code.credited`
7. Click **Create Webhook**.
