/**
 * Dashboard API client — Phase 7
 *
 * Extracts and encapsulates existing data fetching logic from DashboardPage.tsx
 * without changing signatures, business logic, endpoints, or data models.
 */

export const API_BASE = "/api";
export const API_URL = `${API_BASE}/v1`;

const getHeaders = (token?: string | null) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const localToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  if (localToken) headers["Authorization"] = `Bearer ${localToken}`;
  return headers;
};

export async function fetchDashboardData(token?: string | null, signal?: AbortSignal) {
  const res = await fetch(`${API_URL}/dashboard`, {
    headers: getHeaders(token),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Server returned status ${res.status}`);
  }
  return res.json();
}

export async function fetchRewardsData(token?: string | null) {
  const res = await fetch(`${API_URL}/rewards`, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Server returned status ${res.status}`);
  }
  return res.json();
}

export async function fetchActiveOffers(token?: string | null) {
  const res = await fetch(`${API_URL}/offers/active`, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Server returned status ${res.status}`);
  }
  const data = await res.json();
  return data.offers || [];
}
