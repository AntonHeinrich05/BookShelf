# Auth-Gated App Testing Playbook (BookShelf)

Auth supports two providers that share the same `users` + `user_sessions` collections:
- Email/Password: `POST /api/auth/register {name,email,password}` and `POST /api/auth/login {email,password}` → returns `{user, token}` and sets `session_token` cookie.
- Google (Emergent Auth): `POST /api/auth/session {session_id}`.

Every protected endpoint accepts the session token via httpOnly cookie `session_token` OR header `Authorization: Bearer <token>`.

## Step 1: Create Test User & Session (direct DB, mirrors Google flow)
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({ user_id: userId, email: 'test.user.' + Date.now() + '@example.com', name: 'Test User', picture: null, auth_provider: 'google', created_at: new Date().toISOString() });
db.user_sessions.insertOne({ user_id: userId, session_token: sessionToken, expires_at: new Date(Date.now() + 7*24*60*60*1000), created_at: new Date() });
print('Session token: ' + sessionToken);
"

Simpler alternative: register via API → `curl -X POST $API/api/auth/register -H 'Content-Type: application/json' -d '{"name":"Test","email":"x@example.com","password":"secret123"}'` and use the returned `token`.

## Step 2: Test Backend API
curl "$API/api/auth/me" -H "Authorization: Bearer TOKEN"
curl "$API/api/books/overview" -H "Authorization: Bearer TOKEN"
curl -X POST "$API/api/books" -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"title":"Test","authors":["A"],"status":"reading","page_count":300}'

## Step 3: Browser Testing
Frontend stores the token in `localStorage` under key `bs_token` and sends it as Bearer header. Either log in via the UI form or set:
await page.evaluate("localStorage.setItem('bs_token', 'TOKEN')") then goto app URL.
Alternatively set cookie `session_token` (httpOnly, secure, sameSite None) for the app domain.

## Checklist
- /api/auth/me returns user with `user_id`
- Library page loads (not redirected to /login)
- CRUD on /api/books works and overview counts update
