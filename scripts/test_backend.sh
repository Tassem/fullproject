#!/bin/bash

API_URL="http://localhost:8080/api"

login() {
  curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\", \"password\":\"$2\"}" | jq -r '.token'
}

test_route() {
  local token=$1
  local method=$2
  local endpoint=$3
  local expected=$4
  
  echo -n "Testing $method $endpoint (Expect $expected)... "
  
  local response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
    -H "Authorization: Bearer $token")
  
  local status=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n -1)
  
  if [ "$status" -eq "$expected" ]; then
    echo "✅ PASS ($status)"
  else
    echo "❌ FAIL ($status)"
    echo "   Body: $body"
  fi
}

echo "🔑 Logging in users..."
FREE_TOKEN=$(login "test_free@test.com" "Test1234!")
PRO_TOKEN=$(login "test_pro@test.com" "Test1234!")
BIZ_TOKEN=$(login "test_biz@test.com" "Test1234!")

echo "--- Blog Automation (has_blog_automation) ---"
test_route "$FREE_TOKEN" "GET" "/articles" 403
test_route "$PRO_TOKEN" "GET" "/articles" 200
test_route "$BIZ_TOKEN" "GET" "/articles" 200

echo "--- Site Limits (max_sites) ---"
# test_free has 0 sites allowed
test_route "$FREE_TOKEN" "POST" "/sites" 422

echo "--- Done ---"
