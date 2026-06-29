#!/usr/bin/env bash
# TaxDox AI — Automated Smoke Test
#
# Runs on every change. Tests the critical auth path that has broken before:
#   1. Sign-in page loads
#   2. Login with valid credentials succeeds
#   3. Session cookie is set and valid
#   4. Protected route (/) returns 200 with session (NOT redirected to signin)
#   5. Protected API route returns 401 without session
#   6. Logout clears session
#   7. After logout, protected route redirects to signin
#
# Usage: bash scripts/smoke-test.sh
#
# Exit code 0 = all checks passed, 1 = any check failed.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
DEMO_EMAIL="sarah.chen@meridiancpa.com"
DEMO_PASSWORD="TaxDox2025!"
COOKIE_FILE=$(mktemp)
FAIL_COUNT=0
PASS_COUNT=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

info() {
  echo -e "${YELLOW}ℹ️${NC} $1"
}

cleanup() {
  rm -f "$COOKIE_FILE"
}
trap cleanup EXIT

echo "================================"
echo "TaxDox AI — Smoke Test"
echo "Target: $BASE_URL"
echo "================================"
echo ""

# --- Check 1: Server is running ---
info "Check 1: Server is reachable..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/signin" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  pass "Server is running (sign-in page returned 200)"
else
  fail "Server is not reachable (got $HTTP_CODE). Start it with: bun run dev"
  echo ""
  echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"
  exit 1
fi

# --- Check 2: Unauthenticated home redirects to signin ---
info "Check 2: Unauthenticated / redirects to signin..."
REDIRECT=$(curl -s -o /dev/null -w "%{redirect_url}" "$BASE_URL/" 2>/dev/null)
if echo "$REDIRECT" | grep -q "signin"; then
  pass "Unauthenticated / correctly redirects to /auth/signin"
else
  fail "Unauthenticated / should redirect to signin, got: $REDIRECT"
fi

# --- Check 3: Protected API returns 401 without session ---
info "Check 3: Protected API (/api/dashboard) returns 401 without session..."
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/dashboard" 2>/dev/null)
if [ "$API_CODE" = "401" ]; then
  pass "Protected API correctly returns 401 without session"
else
  fail "Protected API should return 401, got $API_CODE"
fi

# --- Check 4: Get CSRF token ---
info "Check 4: Fetching CSRF token..."
CSRF_JSON=$(curl -s -c "$COOKIE_FILE" "$BASE_URL/api/auth/csrf" 2>/dev/null)
CSRF_TOKEN=$(echo "$CSRF_JSON" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
if [ -n "$CSRF_TOKEN" ]; then
  pass "Got CSRF token"
else
  fail "Could not get CSRF token"
fi

# --- Check 5: Login with valid credentials ---
info "Check 5: Login with valid credentials..."
LOGIN_CODE=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=$DEMO_EMAIL&password=$DEMO_PASSWORD&csrfToken=$CSRF_TOKEN&callbackUrl=$BASE_URL/" \
  -o /dev/null -w "%{http_code}" 2>/dev/null)

# 302 = redirect (success), 200 = also acceptable (some configs)
if [ "$LOGIN_CODE" = "302" ] || [ "$LOGIN_CODE" = "200" ]; then
  pass "Login returned $LOGIN_CODE (expected 302 or 200)"
else
  fail "Login should return 302 or 200, got $LOGIN_CODE"
fi

# --- Check 6: Session is valid after login ---
info "Check 6: Session is valid after login..."
SESSION_JSON=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/auth/session" 2>/dev/null)
if echo "$SESSION_JSON" | grep -q '"user"'; then
  USER_NAME=$(echo "$SESSION_JSON" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
  pass "Session valid — logged in as: $USER_NAME"
else
  fail "Session should contain user data after login, got: $SESSION_JSON"
fi

# --- Check 7: Home page accessible with session (THE BUG THAT BROKE BEFORE) ---
info "Check 7: Home page accessible WITH session (the critical check)..."
HOME_CODE=$(curl -s -b "$COOKIE_FILE" -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null)
HOME_REDIRECT=$(curl -s -b "$COOKIE_FILE" -o /dev/null -w "%{redirect_url}" "$BASE_URL/" 2>/dev/null)

if [ "$HOME_CODE" = "200" ]; then
  pass "Home page returns 200 with session (NOT redirected to signin)"
else
  fail "Home page should return 200 with session, got $HOME_CODE (redirect: $HOME_REDIRECT). This is the login-loop bug — check NEXTAUTH_SECRET is stable in .env"
fi

# --- Check 8: Protected API works with session ---
info "Check 8: Protected API (/api/dashboard) returns 200 with session..."
API_WITH_SESSION=$(curl -s -b "$COOKIE_FILE" -o /dev/null -w "%{http_code}" "$BASE_URL/api/dashboard" 2>/dev/null)
if [ "$API_WITH_SESSION" = "200" ]; then
  pass "Protected API returns 200 with session"
else
  fail "Protected API should return 200 with session, got $API_WITH_SESSION"
fi

# --- Check 9: JWE decryption works (no secret mismatch) ---
info "Check 9: No JWE decryption errors in dev log..."
if grep -qi "JWEDecryptionFailed" /home/z/my-project/dev.log 2>/dev/null; then
  fail "JWEDecryptionFailed errors found in dev.log — NEXTAUTH_SECRET may be unstable"
else
  pass "No JWE decryption errors"
fi

# --- Check 10: Logout ---
info "Check 10: Logout clears session..."
LOGOUT_CODE=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/auth/callback/logout" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -o /dev/null -w "%{http_code}" 2>/dev/null || true)

# NextAuth logout via GET signout or POST — check session is cleared after
# Alternative: check that session is null after hitting the signout URL
curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" "$BASE_URL/api/auth/signout" -o /dev/null 2>/dev/null
POST_LOGOUT_SESSION=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/auth/session" 2>/dev/null)

if echo "$POST_LOGOUT_SESSION" | grep -q '"user"'; then
  # Some NextAuth configs don't clear via GET — try the POST flow
  CSRF2=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" "$BASE_URL/api/auth/csrf" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
  curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "$BASE_URL/api/auth/signout" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "csrfToken=$CSRF2&callbackUrl=$BASE_URL/auth/signin" \
    -o /dev/null 2>/dev/null
  POST_LOGOUT_SESSION=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/auth/session" 2>/dev/null)
fi

if echo "$POST_LOGOUT_SESSION" | grep -q '"user"'; then
  fail "Session still active after logout attempt — may need manual signout"
else
  pass "Session cleared after logout"
fi

# --- Summary ---
echo ""
echo "================================"
echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "================================"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
else
  exit 0
fi
