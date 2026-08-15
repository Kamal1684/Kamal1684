# NurseConnect Auth Testing Notes

Auth style: JWT Bearer tokens in `Authorization` header (NOT cookies). Token
stored in localStorage key `nc_token`. Tokens carry `sub`, `iat`, `exp`
(60 min). Passwords bcrypt-hashed in `users` collection.

## Endpoints
- POST /api/auth/register {email, password(min 8), account_type nurse|hospital}
- POST /api/auth/login {email, password} -> {token, user{id,email,account_type,is_admin}}
- GET  /api/auth/me (Bearer)
- POST /api/auth/change-password (Bearer) {current_password, new_password(min 8)}
  -> verifies current pw, rejects same-as-current, sets password_changed_at,
  returns fresh token; ALL older tokens (iat < password_changed_at) become 401.
- POST /api/auth/forgot-password {email} -> always generic message; rate limit
  5 requests/email/hour (429). Creates one-time token (sha256 hash stored,
  30-min expiry) in password_reset_tokens. Email delivery only if
  RESEND_API_KEY configured (not configured in preview).
- POST /api/auth/reset-password {token, new_password} -> one-time use, expiry
  checked, per-IP failed-attempt limit 10/15min (429), invalid/expired -> 400.
- POST /api/auth/admin-bootstrap: header x-admin-bootstrap-secret must match
  server env ADMIN_BOOTSTRAP_SECRET.

## Security invariants
- No endpoint ever returns password/password_hash. /api/admin/users excludes
  password_hash.
- Passwords never logged; reset tokens stored hashed only.
- is_admin only from users collection; registration rejects account_type admin.
