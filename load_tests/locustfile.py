"""
Travel OS — Production Load Test Suite
Tool: Locust (https://locust.io)

Usage:
    pip install locust
    locust -f load_tests/locustfile.py --host=http://localhost:8000

Headless (CI):
    locust -f load_tests/locustfile.py --host=http://localhost:8000 \
        --users 500 --spawn-rate 50 --run-time 2m --headless \
        --html load_tests/report.html

Target:
    10,000 concurrent users
    p95 latency < 500ms for search endpoints
    Error rate < 1%
"""
from locust import HttpUser, task, between, events
import random
import json
import logging

logger = logging.getLogger(__name__)

# ─── Shared test data ────────────────────────────────────────────────────────

FLIGHT_ROUTES = [
    ("DEL", "BOM"), ("DEL", "BLR"), ("BOM", "GOI"),
    ("DEL", "SIN"), ("BOM", "DXB"), ("DEL", "LHR"),
]

HOTEL_CITIES = ["Mumbai", "Delhi", "Goa", "Bangalore", "Singapore", "Dubai"]

CURRENCIES = [("USD", "INR"), ("EUR", "INR"), ("GBP", "INR")]


# ─── Anonymous / Public Traffic ───────────────────────────────────────────────

class AnonymousUser(HttpUser):
    """Simulates unauthenticated traffic — health checks, public endpoints."""
    wait_time = between(1, 3)
    weight = 10  # 10% of virtual users

    @task(5)
    def health_check(self):
        self.client.get("/healthz", name="/healthz")

    @task(3)
    def forex_rates(self):
        self.client.get("/api/v1/forex/rates", name="/api/v1/forex/rates")

    @task(2)
    def insurance_plans(self):
        self.client.get("/api/v1/insurance/plans", name="/api/v1/insurance/plans")


# ─── Authenticated Customer ───────────────────────────────────────────────────

class AuthenticatedCustomer(HttpUser):
    """
    Simulates a logged-in customer performing search and booking.
    Uses pre-seeded test tokens — replace with real JWT generation if needed.
    """
    wait_time = between(2, 5)
    weight = 70  # 70% of virtual users

    def on_start(self):
        """Register and authenticate test user."""
        test_email = f"loadtest_{random.randint(1, 100000)}@travelos-test.com"
        reg = self.client.post(
            "/api/v1/auth/register",
            json={"email": test_email, "password": "LoadTest@1234!", "name": "Load Test User"},
            name="/api/v1/auth/register",
        )
        if reg.status_code == 200:
            self.token = reg.json().get("access_token", "")
        else:
            # Try login if already registered
            login = self.client.post(
                "/api/v1/auth/login",
                json={"email": test_email, "password": "LoadTest@1234!"},
                name="/api/v1/auth/login",
            )
            self.token = login.json().get("access_token", "") if login.status_code == 200 else ""

        self.headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(30)
    def search_flights(self):
        origin, dest = random.choice(FLIGHT_ROUTES)
        self.client.post(
            "/api/v1/flights/search",
            json={
                "origin": origin,
                "destination": dest,
                "departure_date": "2026-12-15",
                "adults": 1,
                "cabin_class": "economy",
                "trip_type": "one_way",
            },
            headers=self.headers,
            name="/api/v1/flights/search",
        )

    @task(20)
    def search_hotels(self):
        city = random.choice(HOTEL_CITIES)
        self.client.post(
            "/api/v1/hotels/search",
            json={
                "city": city,
                "check_in": "2026-12-15",
                "check_out": "2026-12-18",
                "guests": 2,
                "rooms": 1,
            },
            headers=self.headers,
            name="/api/v1/hotels/search",
        )

    @task(10)
    def view_wallet(self):
        self.client.get("/api/v1/wallet/balance", headers=self.headers, name="/api/v1/wallet/balance")

    @task(8)
    def loyalty_dashboard(self):
        self.client.get("/api/v1/loyalty/dashboard", headers=self.headers, name="/api/v1/loyalty/dashboard")

    @task(5)
    def visa_search(self):
        country = random.choice(["France", "UAE", "UK", "USA", "Singapore"])
        self.client.post(
            "/api/v1/visa/search",
            json={"country": country},
            headers=self.headers,
            name="/api/v1/visa/search",
        )

    @task(5)
    def forex_rates(self):
        self.client.get("/api/v1/forex/rates", name="/api/v1/forex/rates")

    @task(3)
    def insurance_plans(self):
        self.client.get("/api/v1/insurance/plans", headers=self.headers, name="/api/v1/insurance/plans")

    @task(3)
    def esim_plans(self):
        country = random.choice(["USA", "France", "UAE", "Singapore"])
        self.client.get(
            f"/api/v1/esim/plans?country={country}",
            headers=self.headers,
            name="/api/v1/esim/plans",
        )

    @task(2)
    def view_documents(self):
        self.client.get("/api/v1/documents/list", headers=self.headers, name="/api/v1/documents/list")

    @task(2)
    def booking_history(self):
        self.client.get("/api/v1/bookings/history", headers=self.headers, name="/api/v1/bookings/history")


# ─── Support Agent ────────────────────────────────────────────────────────────

class SupportAgent(HttpUser):
    """Simulates a support staff member managing CRM tickets."""
    wait_time = between(5, 10)
    weight = 10  # 10% of virtual users

    def on_start(self):
        login = self.client.post(
            "/api/v1/auth/login",
            json={"email": "support@travelos.com", "password": "Support@1234!"},
            name="support-login",
        )
        self.token = login.json().get("access_token", "") if login.status_code == 200 else ""
        self.headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(5)
    def list_tickets(self):
        self.client.get("/api/v1/crm/tickets?status=open", headers=self.headers, name="/api/v1/crm/tickets")

    @task(3)
    def crm_stats(self):
        self.client.get("/api/v1/crm/admin/stats", headers=self.headers, name="/api/v1/crm/admin/stats")

    @task(2)
    def list_bookings(self):
        self.client.get("/api/v1/bookings/all?page=1&page_size=20", headers=self.headers, name="/api/v1/bookings/all")


# ─── Admin Analytics ─────────────────────────────────────────────────────────

class AdminAnalystUser(HttpUser):
    """Simulates an admin user accessing analytics dashboards."""
    wait_time = between(10, 20)
    weight = 10  # 10% of virtual users

    def on_start(self):
        login = self.client.post(
            "/api/admin/auth/login",
            json={"email": "admin@travelos.com", "password": "Admin@1234!"},
            name="admin-login",
        )
        self.token = login.json().get("access_token", "") if login.status_code == 200 else ""
        self.headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(3)
    def revenue_overview(self):
        self.client.get("/api/v1/admin/analytics/revenue", headers=self.headers, name="/api/v1/admin/analytics/revenue")

    @task(2)
    def top_destinations(self):
        self.client.get("/api/v1/admin/analytics/top-destinations", headers=self.headers, name="/api/v1/admin/analytics/top-destinations")

    @task(2)
    def provider_health(self):
        self.client.get("/api/v1/admin/analytics/provider-health", headers=self.headers, name="/api/v1/admin/analytics/provider-health")

    @task(1)
    def ai_usage(self):
        self.client.get("/api/v1/admin/analytics/ai-usage", headers=self.headers, name="/api/v1/admin/analytics/ai-usage")


# ─── Event Hooks ─────────────────────────────────────────────────────────────

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, response, exception, **kwargs):
    if exception:
        logger.error(f"[LOAD TEST] Request FAILED: {name} | Error: {exception}")
    elif response and response.status_code >= 500:
        logger.warning(f"[LOAD TEST] Server Error {response.status_code}: {name} | {response_time}ms")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    logger.info("=" * 60)
    logger.info("Travel OS Load Test Started")
    logger.info(f"Target host: {environment.host}")
    logger.info("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    logger.info("=" * 60)
    logger.info("Travel OS Load Test Completed")
    logger.info(f"Total requests: {stats.total.num_requests}")
    logger.info(f"Total failures: {stats.total.num_failures}")
    fail_pct = (stats.total.num_failures / stats.total.num_requests * 100) if stats.total.num_requests > 0 else 0
    logger.info(f"Failure rate: {fail_pct:.2f}%")
    logger.info(f"Median response time: {stats.total.median_response_time}ms")
    logger.info(f"95th percentile: {stats.total.get_response_time_percentile(0.95)}ms")
    logger.info("=" * 60)
    if fail_pct > 1.0:
        logger.error("LOAD TEST FAILED: Failure rate exceeded 1%")
