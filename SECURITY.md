# SECURITY.md — Wadifatuk Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it to:
📧 **admin@wadifatuk.com**

Do NOT create public GitHub issues for security vulnerabilities.

---

## Security Architecture

### Authentication
| Layer | Method | Status |
|-------|--------|--------|
| Admin Panel | Client-side session + ADMIN_TOKEN SHA-256 | ✅ Active |
| Push API | X-Admin-Token header (derived from VAPID + password) | ✅ Active |
| Public endpoints | No auth (subscribe.php) | ✅ Intentional |

### API Endpoints Security
| Endpoint | Protection | Notes |
|----------|-----------|-------|
| `push/send.php` | X-Admin-Token required | 403 if missing/wrong |
| `push/diagnostics.php` | X-Admin-Token required | 403 if missing/wrong |
| `push/stats.php` | X-Admin-Token required | 403 if missing/wrong |
| `push/subscribe.php` | None (public) | Rate-limited by Hostinger |
| `push/config.php` | Blocked by .htaccess | 403 for all |

### HTTP Security Headers (.htaccess)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' ...
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### File Protection (.htaccess)
- `push/config.php` → ❌ Blocked (DenyAll)
- `push/*.json` → ❌ Blocked (except latest.json)
- `push/*.log` → ❌ Blocked
- Admin panel → ✅ noindex (not linked publicly)

### VAPID Keys
- Private key stored in `push/config.php` (server-side only)
- Public key exposed in `js/push-notifications.js` (intentional — required by Web Push spec)
- Keys generated with P-256 EC algorithm

### Known Limitations
1. **Admin auth is client-side** — username/password checked in JavaScript. Acceptable for single-operator sites, but should migrate to PHP sessions for multi-admin scenarios.
2. **No rate limiting on subscribe.php** — recommend adding Hostinger firewall rules for /push/subscribe.php
3. **No CSRF token** on PHP endpoints — mitigated by CORS + same-origin policy

---

## Encryption (Push Payload)

- Algorithm: **AES-128-GCM** (RFC 8291)
- Key exchange: **ECDH P-256** (`openssl_pkey_derive` on PHP 8.1+)
- Key derivation: **HKDF-SHA-256**
- Auth: **VAPID JWT ES256**

---

## Recommended Hostinger Settings

```
PHP Version: 8.1 or 8.2 (required for openssl_pkey_derive)
PHP Extensions: openssl, curl, json (all enabled by default)
File Permissions:
  push/config.php → 644
  push/subscriptions.json → 664 (writable by PHP)
  push/push-log.json → 664
  push/latest.json → 664
```
