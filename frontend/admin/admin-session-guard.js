/* Admin session guard: prevent stale/expired browser tokens from opening the
 * bookings shell and repeatedly generating 401 requests. The server remains
 * authoritative; this only performs a safe client-side expiry check and
 * redirects invalid sessions back to the existing login form.
 */
(function () {
  const TOKEN_KEY = "caSmartAdminToken";
  const token = sessionStorage.getItem(TOKEN_KEY) || "";
  if (!token) return;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      sessionStorage.removeItem(TOKEN_KEY);
      return;
    }
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload || payload.role !== "admin" || !payload.email || (payload.exp && payload.exp * 1000 <= Date.now())) {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch (_) {
    sessionStorage.removeItem(TOKEN_KEY);
  }
})();
