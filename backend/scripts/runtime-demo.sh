#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:8080}

echo "[1/4] Login as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@taskmanager.com","password":"admin123"}')

echo "$LOGIN_RESPONSE" | sed 's/"token":"[^"]*"/"token":"<jwt-token>"/'

TOKEN=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "Login failed. Ensure the Spring Boot app is running and seed data initialized."
  exit 1
fi

echo "[2/4] Fetch users (admin endpoint)..."
curl -s "$BASE_URL/api/users" -H "Authorization: Bearer $TOKEN"
echo

echo "[3/4] Fetch tasks with pagination..."
curl -s "$BASE_URL/api/tasks?page=0&size=5" -H "Authorization: Bearer $TOKEN"
echo

echo "[4/4] Fetch dashboard..."
curl -s "$BASE_URL/api/dashboard" -H "Authorization: Bearer $TOKEN"
echo
