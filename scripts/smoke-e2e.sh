#!/usr/bin/env bash
# Smoke E2E HTTP — jalankan setelah app listen di BASE_URL (default http://127.0.0.1:3000)
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
COOKIE_JAR="$(mktemp)"
COOKIE_TEACHER="$(mktemp)"
COOKIE_ADMIN="$(mktemp)"
COOKIE_SA="$(mktemp)"
COOKIE_STUDENT="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$COOKIE_TEACHER" "$COOKIE_ADMIN" "$COOKIE_SA" "$COOKIE_STUDENT"' EXIT

pass=0
fail=0
step() { echo ""; echo "=== $* ==="; }
ok() { echo "PASS: $*"; pass=$((pass + 1)); }
bad() { echo "FAIL: $*"; fail=$((fail + 1)); }

csrf_login() {
  local provider="$1" email="$2" password="$3" jar="$4"
  # NextAuth credentials: get CSRF then POST callback
  local csrf
  csrf=$(curl -sS -c "$jar" -b "$jar" "$BASE_URL/api/auth/csrf" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")
  local code
  code=$(curl -sS -o /tmp/smoke-login-body.txt -w "%{http_code}" -c "$jar" -b "$jar" \
    -X POST "$BASE_URL/api/auth/callback/${provider}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=${csrf}" \
    --data-urlencode "email=${email}" \
    --data-urlencode "password=${password}" \
    --data-urlencode "json=true" \
    -L || true)
  # next-auth may redirect 302; session cookie must be set
  if grep -q 'next-auth.session-token\|__Secure-next-auth.session-token\|authjs.session-token\|__Secure-authjs.session-token' "$jar" 2>/dev/null; then
    return 0
  fi
  # fallback: check session endpoint
  local sess
  sess=$(curl -sS -b "$jar" "$BASE_URL/api/auth/session" || true)
  echo "$sess" | python3 -c "import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get('user') else 1)" 2>/dev/null
}

step "1. GET /api/health/ready"
ready=$(curl -sS -o /tmp/smoke-ready.json -w "%{http_code}" "$BASE_URL/api/health/ready")
if [[ "$ready" == "200" ]]; then ok "health ready 200"; else bad "health ready got $ready"; cat /tmp/smoke-ready.json; fi

step "2a. Login siswa"
if csrf_login "student-login" "0051234567@siswa.seed.local" "Siswa@123456" "$COOKIE_STUDENT"; then
  ok "login siswa"
else
  bad "login siswa"; cat /tmp/smoke-login-body.txt 2>/dev/null || true
fi

step "2b. Login guru (TEACHER)"
if csrf_login "admin-login" "s.rahayu@seed.local" "Guru@1234" "$COOKIE_TEACHER"; then
  ok "login guru"
else
  bad "login guru"
fi

step "2b2. Login admin (canManageData — hapus/export)"
if csrf_login "admin-login" "piket@seed.local" "Guru@1234" "$COOKIE_ADMIN"; then
  ok "login admin"
else
  bad "login admin"
fi

step "2c. Login super admin"
if csrf_login "admin-login" "admin@seed.local" "Admin@1234" "$COOKIE_SA"; then
  ok "login super admin"
else
  bad "login super admin"
fi

# Jenis pelanggaran ringan (≤20 poin) agar siswa tidak wajib bukti
VT_ID=$(curl -sS -b "$COOKIE_TEACHER" "$BASE_URL/api/violations" | python3 -c "
import sys,json
a=json.load(sys.stdin)
light=next((x for x in a if int(x.get('points') or 0) <= 20), a[0] if a else None)
print(light['id'] if light else '')
")

step "3. Siswa submit catatan pelanggaran"
create_code=$(curl -sS -o /tmp/smoke-create.json -w "%{http_code}" -b "$COOKIE_STUDENT" \
  -X POST "$BASE_URL/api/records" \
  -H "Content-Type: application/json" \
  -d "{\"violationTypeId\":\"${VT_ID}\",\"session\":\"Istirahat / Umum\",\"notes\":\"smoke-e2e\",\"date\":\"$(date -u +%Y-%m-%d)\",\"studentSignatureData\":\"Saya mengakui pelanggaran ini sebagai pengakuan tertulis.\"}")
if [[ "$create_code" == "201" || "$create_code" == "200" ]]; then
  ok "siswa create record $create_code"
  RECORD_ID=$(python3 -c "import json; print(json.load(open('/tmp/smoke-create.json')).get('id',''))")
else
  bad "siswa create got $create_code"; cat /tmp/smoke-create.json; RECORD_ID=""
fi

step "4. Guru list records paginated"
list1=$(curl -sS -b "$COOKIE_TEACHER" "$BASE_URL/api/records?page=1&perPage=5")
echo "$list1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert 'data' in d and 'page' in d and 'total' in d, d
assert d['page']==1 and d['perPage']==5
assert isinstance(d['data'], list)
print('page1_ids', ','.join(x['id'] for x in d['data'][:5]))
print('total', d['total'])
" && ok "guru list page 1" || bad "guru list page 1"

list2=$(curl -sS -b "$COOKIE_TEACHER" "$BASE_URL/api/records?page=2&perPage=5")
ids1=$(echo "$list1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(','.join(x['id'] for x in d['data']))")
ids2=$(echo "$list2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(','.join(x['id'] for x in d['data']))")
if [[ -n "$ids1" && -n "$ids2" && "$ids1" != "$ids2" ]]; then
  ok "page2 ids differ from page1"
elif [[ $(echo "$list1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))") -le 5 ]]; then
  ok "page2 skipped (total<=5, still consistent)"
else
  bad "pagination pages not distinct: p1=$ids1 p2=$ids2"
fi

step "5. Admin soft-delete satu catatan (TEACHER tidak punya canManageData)"
DEL_ID="${RECORD_ID}"
if [[ -z "$DEL_ID" ]]; then
  DEL_ID=$(echo "$list1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else '')")
fi
del_code=$(curl -sS -o /tmp/smoke-del.json -w "%{http_code}" -b "$COOKIE_ADMIN" -X DELETE "$BASE_URL/api/records/${DEL_ID}")
if [[ "$del_code" == "200" || "$del_code" == "204" ]]; then
  ok "soft-delete $del_code"
else
  bad "soft-delete got $del_code"; cat /tmp/smoke-del.json
fi
still=$(curl -sS -b "$COOKIE_TEACHER" "$BASE_URL/api/records?page=1&perPage=100" | python3 -c "import sys,json; d=json.load(sys.stdin); print(any(x['id']=='$DEL_ID' for x in d.get('data',[])))")
if [[ "$still" == "False" ]]; then ok "deleted id absent from list"; else bad "deleted id still in list"; fi

step "6. Guru (TEACHER) create user → 403"
teach_create=$(curl -sS -o /tmp/smoke-teach-user.json -w "%{http_code}" -b "$COOKIE_TEACHER" \
  -X POST "$BASE_URL/api/users" -H "Content-Type: application/json" \
  -d '{"name":"Smoke Guru User","email":"smoke.teacher.create@seed.local","password":"Guru@12345678","role":"TEACHER"}')
if [[ "$teach_create" == "403" ]]; then ok "teacher create user 403"; else bad "teacher create got $teach_create"; cat /tmp/smoke-teach-user.json; fi

step "7. Super admin create user → success"
sa_email="smoke.sa.$(date +%s)@seed.local"
sa_create=$(curl -sS -o /tmp/smoke-sa-user.json -w "%{http_code}" -b "$COOKIE_SA" \
  -X POST "$BASE_URL/api/users" -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke SA User\",\"email\":\"${sa_email}\",\"password\":\"Guru@12345678\",\"role\":\"TEACHER\"}")
if [[ "$sa_create" == "200" || "$sa_create" == "201" ]]; then ok "SA create user $sa_create"; else bad "SA create got $sa_create"; cat /tmp/smoke-sa-user.json; fi

step "8. Export Excel (admin) excludes soft-deleted"
exp_code=$(curl -sS -o /tmp/smoke-export.xlsx -w "%{http_code}" -b "$COOKIE_ADMIN" "$BASE_URL/api/export")
if [[ "$exp_code" == "200" ]]; then
  ok "export 200"
  if command -v unzip >/dev/null; then
    rm -rf /tmp/smoke-xlsx && mkdir -p /tmp/smoke-xlsx && unzip -q /tmp/smoke-export.xlsx -d /tmp/smoke-xlsx
    if grep -R "$DEL_ID" /tmp/smoke-xlsx >/dev/null 2>&1; then
      bad "export still contains deleted record id $DEL_ID"
    else
      ok "export does not contain deleted id"
    fi
  else
    ok "export downloaded (unzip not available to scan id)"
  fi
else
  bad "export got $exp_code"
fi

step "9. Security headers on /"
hdrs=$(curl -sSI "$BASE_URL/" | tr -d '\r')
echo "$hdrs" | grep -qi 'x-frame-options: *DENY' && ok "X-Frame-Options DENY" || bad "missing X-Frame-Options"
echo "$hdrs" | grep -qi 'x-content-type-options: *nosniff' && ok "X-Content-Type-Options" || bad "missing X-Content-Type-Options"
echo "$hdrs" | grep -qi 'content-security-policy:' && ok "CSP present" || bad "missing CSP"
echo "$hdrs" | grep -qi 'referrer-policy:' && ok "Referrer-Policy" || bad "missing Referrer-Policy"

step "SUMMARY"
echo "pass=$pass fail=$fail"
if [[ "$fail" -gt 0 ]]; then exit 1; fi
exit 0
