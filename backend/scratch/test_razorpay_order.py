import os
import sys

# Add the parent directory (backend) to sys.path so we can import app module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.payments import settings, razorpay_client, check_razorpay_health

def mask_key(key: str) -> str:
    if len(key) <= 8:
        return "****"
    return f"{key[:8]}...{key[-4:]}"

def main():
    print("=" * 60)
    print("RAZORPAY INTEGRATION FOUNDATION VERIFICATION SCRIPT")
    print("=" * 60)
    
    # 1. Print loaded settings
    print(f"Loaded RAZORPAY_KEY_ID: {mask_key(settings.RAZORPAY_KEY_ID)}")
    print(f"Loaded RAZORPAY_KEY_SECRET: {mask_key(settings.RAZORPAY_KEY_SECRET)}")
    print(f"Loaded RAZORPAY_WEBHOOK_SECRET: {mask_key(settings.RAZORPAY_WEBHOOK_SECRET or '')}")
    print("-" * 60)
    
    # Check if we are using default placeholders
    is_placeholder = (
        "your" in settings.RAZORPAY_KEY_ID.lower() or 
        "your" in settings.RAZORPAY_KEY_SECRET.lower() or
        settings.RAZORPAY_KEY_ID == "rzp_test_your_razorpay_key"
    )
    
    if is_placeholder:
        print("[!] WARNING: You are using the default placeholder keys from .env.example.")
        print("    To run a live test, create a '.env' file in the 'backend' folder")
        print("    with valid keys from your Razorpay Dashboard.")
        print("-" * 60)
        
    # 2. Run Health Check
    print("Running connection and credential health check...")
    health = check_razorpay_health()
    print(f"Health Check Result: {health['status'].upper()}")
    print(f"Message: {health['message']}")
    print("-" * 60)
    
    if not health["success"]:
        print("[x] Health check failed. Skipping test order creation.")
        print("    Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in '.env'.")
        print("=" * 60)
        return
        
    # 3. Create a ₹1 test order (100 paise)
    print("Creating a ₹1 (100 paise) test order...")
    try:
        order_data = {
            "amount": 100,  # 100 paise = 1 INR
            "currency": "INR",
            "receipt": "receipt_test_foundation_1",
            "notes": {
                "env": "development",
                "integration": "foundation_test",
                "project": "Ghumne Chale"
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        print("\n[+] SUCCESS: Order created successfully!")
        print("-" * 60)
        print(f"Order ID:      {order.get('id')}")
        print(f"Amount:        {order.get('amount')} {order.get('currency')} (paise)")
        print(f"Status:        {order.get('status')}")
        print(f"Receipt:       {order.get('receipt')}")
        print(f"Created At:    {order.get('created_at')}")
        print("-" * 60)
        print("Full API Response:")
        import pprint
        pprint.pprint(order)
        
    except Exception as e:
        print(f"\n[x] ERROR: Failed to create order: {e}")
        
    print("=" * 60)

if __name__ == "__main__":
    main()
