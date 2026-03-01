# Security Hardening Implementation

This document describes the security hardening measures implemented for the Internal Developer Platform.

## Overview

The security hardening implementation includes:

1. **API Rate Limiting** - Prevent abuse and ensure fair resource usage
2. **Sensitive Data Encryption** - Protect data at rest and in transit
3. **Audit Logging** - Track all sensitive operations
4. **Dependency Vulnerability Scanning** - Identify and remediate security vulnerabilities
5. **API Key Rotation** - Manage API key lifecycle and automatic rotation

## 1. API Rate Limiting

### Implementation

Rate limiting is implemented using Redis-backed distributed rate limiting with configurable limits per endpoint.

**Location**: `packages/backend/src/plugins/common/rate-limiter.ts`

### Configuration

```yaml
# app-config.yaml
security:
  rateLimiting:
    enabled: true
    windowMs: 900000  # 15 minutes
    maxRequests: 100  # 100 requests per window
    endpoints:
      /api/catalog/entities:
        windowMs: 60000  # 1 minute
        maxRequests: 60  # 60 requests per minute
      /api/scaffolder/v2/tasks:
        windowMs: 3600000  # 1 hour
        maxRequests: 10  # 10 service creations per hour
```

### Features

- Per-endpoint limits with different rate limits for different API endpoints
- User-based tracking for authenticated users
- IP-based fallback for unauthenticated requests
- Standard headers returning RateLimit-* headers in responses
- Distributed using Redis for coordination across multiple backend instances
- Fail-open allowing requests if rate limiter fails

## 2. Sensitive Data Encryption

### Implementation

Encryption is implemented using AES-256-GCM with automatic key rotation.

**Location**: `packages/backend/src/plugins/common/encryption-service.ts`

### Environment Variables

```bash
# Required: Master encryption key (32+ characters)
ENCRYPTION_MASTER_KEY=<your-secure-master-key>
```

### Features

- At-rest encryption for sensitive database fields
- In-transit encryption using TLS 1.2+
- Key rotation every 90 days
- Key derivation using PBKDF2
- Authentication using GCM mode

## 3. Audit Logging

### Implementation

Comprehensive audit logging for all sensitive operations with multiple destinations.

**Location**: `packages/backend/src/plugins/common/audit-logger.ts`

### Features

- Multiple destinations: database, file, and Sentry
- Structured logging with actor, resource, action, status
- Retention policy with automatic cleanup
- Query API for searching and filtering
- Sensitive operations only

## 4. Dependency Vulnerability Scanning

### Setup

Run security scans:

```bash
# npm audit
npm audit

# npm audit with automatic fixes
npm audit fix
```

### Features

- npm audit for built-in vulnerability scanning
- Automated scanning via GitHub Actions
- PR checks on every pull request
- Severity thresholds failing builds on high/critical vulnerabilities

## 5. API Key Rotation

### Implementation

Automated API key lifecycle management with rotation policies.

**Location**: `packages/backend/src/plugins/common/api-key-rotation.ts`

### Features

- Automatic expiration after configured interval
- Rotation warnings notifying owners before expiration
- Manual rotation on-demand
- Auto-rotation (optional, disabled by default)
- Audit logging for all key operations
- Scoped access with limited permissions

### API Key Format

API keys follow the format: `idp_<random_32_chars>`

Example: `idp_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## Security Best Practices

### Environment Variables

Store sensitive configuration in environment variables:

```bash
POSTGRES_PASSWORD=<secure-password>
BACKEND_SECRET=<secure-secret>
GITHUB_TOKEN=<github-token>
ENCRYPTION_MASTER_KEY=<32+-char-key>
```

### TLS Configuration

Configure TLS at the infrastructure level:
- Minimum version: TLS 1.2
- Strong ciphers only
- Enable HSTS
- Use valid certificates from trusted CA

### Database Security

- Use SSL/TLS for database connections
- Dedicated database user with minimal permissions
- Configure appropriate connection pool size
- Encrypt database backups

## Compliance

### GDPR

- Data encryption at rest and in transit
- Audit logging for all data access
- Data retention for 90 days
- Data deletion procedures

### SOC 2

- RBAC enforced for all resources
- Comprehensive audit trail
- Data encrypted at rest and in transit
- Security events monitored and alerted

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Backstage Security](https://backstage.io/docs/overview/security/)
