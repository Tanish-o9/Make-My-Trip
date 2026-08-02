from prometheus_client import Counter, Histogram

# API latency histogram
API_RESPONSE_TIMES = Histogram(
    "api_response_times_seconds",
    "API response latency in seconds",
    ["endpoint", "method"]
)

# Payment transaction metrics
PAYMENT_TRANSACTIONS = Counter(
    "payment_transactions_total",
    "Total count of payment transactions",
    ["gateway", "status"]  # e.g., gateway="razorpay", status="captured" / "failed"
)

# Multi-aggregator provider search success/failure metrics
PROVIDER_SEARCHES = Counter(
    "provider_search_total",
    "Total count of provider aggregator queries",
    ["provider", "vertical", "status"]  # e.g., provider="TBO", vertical="flights", status="success" / "timeout" / "error"
)

# Booking funnel stage metrics
BOOKING_FUNNEL = Counter(
    "booking_funnel_stages_total",
    "Total count of bookings passing through different stages of the funnel",
    ["stage"]  # e.g. "search", "hold", "payment_pending", "payment_confirmed"
)

# Reconciliation run metrics
RECONCILIATION_RUNS = Counter(
    "reconciliation_runs_total",
    "Total count of financial reconciliation runs",
    ["status"]  # e.g., "success", "exceptions_found"
)
