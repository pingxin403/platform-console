# RBAC and Permission Management

This module implements enhanced Role-Based Access Control (RBAC) and permission management for the Internal Developer Platform.

## Features

### 1. Fine-Grained Access Control
- Role-based permissions (admin, developer, viewer, contractor)
- Resource-level access control (catalog, kubernetes, scaffolder, etc.)
- Namespace-based restrictions for Kubernetes resources
- Sensitive resource protection

### 2. Permission Synchronization
- Automatic synchronization from GitHub teams every 5 minutes
- Role cache with 5-minute TTL
- Support for external identity providers (GitHub, Keycloak)
- Real-time permission updates

### 3. Audit Logging
- All permission checks logged to database
- 90-day retention policy
- Audit statistics and reporting
- Security event monitoring

### 4. Permission Middleware
- Express middleware for API endpoint protection
- Role-based access control
- Resource ownership verification
- Custom permission requirements

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RBAC System                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │  RBAC Policy     │      │  Permission Sync │            │
│  │  Module          │◄─────┤  Service         │            │
│  │                  │      │  (5 min interval)│            │
│  └────────┬─────────┘      └──────────────────┘            │
│           │                                                  │
│           │                                                  │
│  ┌────────▼─────────┐      ┌──────────────────┐            │
│  │  Permission      │      │  Audit Logger    │            │
│  │  Middleware      │─────►│  (Database)      │            │
│  │                  │      │  90-day retention│            │
│  └──────────────────┘      └──────────────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### app-config.yaml

```yaml
permission:
  enabled: true
  policy:
    policyFile: './rbac-policy.yaml'
    refreshInterval: 300 # 5 minutes
    cache: true
  
  roles:
    admin:
      permissions:
        - 'catalog:*'
        - 'scaffolder:*'
        - 'kubernetes:*'
        - 'permission:*'
    
    developer:
      permissions:
        - 'catalog:read'
        - 'catalog:write'
        - 'scaffolder:read'
        - 'scaffolder:write'
        - 'kubernetes:read'
    
    viewer:
      permissions:
        - 'catalog:read'
        - 'techdocs:read'
    
    contractor:
      permissions:
        - 'catalog:read'
        - 'techdocs:read'
      boundaries:
        namespaces: ['public', 'documentation']
        dataRetention: '30d'
  
  userRoles:
    github:
      'platform-team': 'admin'
      'backend-team': 'developer'
      'contractors': 'contractor'
      'default': 'viewer'
  
  audit:
    enabled: true
    retention: '90d'
    events: ['permission:check', 'permission:grant', 'permission:deny']
```

### rbac-policy.yaml

See `rbac-policy.yaml` in the project root for detailed policy configuration.

## Usage

### 1. Backend Module Registration

The RBAC policy module is automatically registered in `packages/backend/src/index.ts`:

```typescript
// Replace allow-all policy with custom RBAC policy
backend.add(import('./plugins/rbac').then(m => ({ default: m.rbacPolicyModule })));
```

### 2. Permission Middleware

Protect API endpoints with permission middleware:

```typescript
import { createPermissionMiddleware, requireRole } from './plugins/rbac/permission-middleware';

// Require specific permission
router.get('/api/services',
  createPermissionMiddleware(
    { permission: 'catalog:read' },
    { logger, auditLogger }
  ),
  async (req, res) => {
    // Handler code
  }
);

// Require specific role
router.post('/api/services',
  requireRole('developer', { logger, auditLogger }),
  async (req, res) => {
    // Handler code
  }
);

// Require resource ownership
router.delete('/api/services/:id',
  requireOwnership(
    async (req) => {
      const service = await getService(req.params.id);
      return service.owner;
    },
    { logger, auditLogger }
  ),
  async (req, res) => {
    // Handler code
  }
);
```

### 3. Permission Synchronization

The permission sync service runs automatically every 5 minutes:

```typescript
import { PermissionSyncService } from './plugins/rbac/permission-sync-service';

const syncService = new PermissionSyncService(config, logger);
syncService.start();

// Get sync statistics
const stats = syncService.getSyncStats();
console.log(`Total users: ${stats.totalUsers}`);
console.log(`Next sync in: ${stats.nextSyncIn}s`);
```

### 4. Audit Logging

Query audit logs for security monitoring:

```typescript
import { AuditLogger } from './plugins/rbac/audit-logger';

const auditLogger = new AuditLogger(database, logger);
await auditLogger.initialize();

// Query logs
const logs = await auditLogger.queryLogs({
  userId: 'user:default/john.doe',
  decision: 'DENY',
  startDate: new Date('2024-01-01'),
  limit: 100,
});

// Get statistics
const stats = await auditLogger.getStatistics({
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31'),
});
console.log(`Denial rate: ${stats.denialRate}%`);
```

## Permission Format

Permissions follow the format: `resource:action`

### Resources
- `catalog` - Service catalog entities
- `scaffolder` - Project templates and scaffolding
- `techdocs` - Documentation
- `kubernetes` - Kubernetes resources
- `permission` - Permission management

### Actions
- `read` - View resources
- `write` - Create/update resources
- `delete` - Delete resources
- `*` - All actions

### Examples
- `catalog:read` - View catalog entities
- `catalog:write` - Create/update catalog entities
- `kubernetes:*` - All Kubernetes operations
- `*` - All permissions (admin only)

## Roles

### Admin
- Full access to all resources
- Can manage permissions
- Can access production Kubernetes namespaces

### Engineering Lead
- Administrative access with some restrictions
- Cannot modify permission configuration
- Can access all environments

### Developer
- Standard development access
- Can read/write catalog and scaffolder
- Limited Kubernetes access (dev/staging only)

### Viewer
- Read-only access
- Can view catalog and documentation
- Cannot modify resources

### Contractor
- Limited access with data boundaries
- Can only view public resources
- No Kubernetes access
- Requires approval for sensitive operations

## Security Features

### 1. Fail-Closed Policy
- Default deny unless explicitly allowed
- Errors result in access denial
- No implicit permissions

### 2. Permission Caching
- 5-minute cache TTL
- Automatic cache invalidation
- Reduces external API calls

### 3. Audit Trail
- All permission checks logged
- 90-day retention
- Tamper-evident logging

### 4. Rate Limiting
- 100 requests per minute per user
- Burst allowance of 20 requests
- IP-based rate limiting

### 5. Session Management
- 8-hour session timeout
- Re-authentication for sensitive operations
- Automatic session cleanup

## Monitoring

### Audit Statistics

Query audit statistics for security monitoring:

```typescript
const stats = await auditLogger.getStatistics({
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31'),
});

console.log(`Total events: ${stats.totalEvents}`);
console.log(`Denied events: ${stats.deniedEvents}`);
console.log(`Denial rate: ${stats.denialRate}%`);
console.log(`Top users:`, stats.topUsers);
console.log(`Top permissions:`, stats.topPermissions);
```

### Permission Sync Status

Monitor permission synchronization:

```typescript
const stats = syncService.getSyncStats();
console.log(`Total users: ${stats.totalUsers}`);
console.log(`Last sync: ${stats.lastSyncTime}`);
console.log(`Next sync in: ${stats.nextSyncIn}s`);
```

## Troubleshooting

### Permission Denied Errors

1. Check user role assignment:
   ```typescript
   const userPerm = syncService.getUserPermissions('user:default/john.doe');
   console.log(`Role: ${userPerm?.role}`);
   console.log(`Teams: ${userPerm?.teams}`);
   ```

2. Check audit logs:
   ```typescript
   const logs = await auditLogger.queryLogs({
     userId: 'user:default/john.doe',
     decision: 'DENY',
     limit: 10,
   });
   ```

3. Verify role configuration in `app-config.yaml`

4. Check GitHub team membership

### Permission Sync Issues

1. Verify GitHub token has correct permissions
2. Check organization name in config
3. Review sync service logs
4. Manually trigger sync (restart service)

### Audit Log Issues

1. Verify database connection
2. Check table exists: `permission_audit_logs`
3. Review retention policy
4. Check disk space

## Testing

Run RBAC tests:

```bash
# Unit tests
npm test -- rbac-policy-module.test.ts

# Integration tests
npm test -- rbac-integration.test.ts

# Property-based tests
npm test -- rbac-enforcement.test.ts
```

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 8.1**: Authentication through GitHub OAuth/Keycloak OIDC
- **Requirement 8.2**: Permission synchronization within 5 minutes
- **Requirement 8.4**: Audit logging for sensitive operations
- **Property 23**: Authentication enforcement
- **Property 24**: Permission synchronization
- **Property 26**: RBAC enforcement for sensitive resources

## Future Enhancements

1. **Multi-Provider Support**: Add LDAP, Active Directory, Okta
2. **Dynamic Policies**: Runtime policy updates without restart
3. **Advanced Analytics**: ML-based anomaly detection
4. **Policy Testing**: Dry-run mode for policy changes
5. **Self-Service**: User-facing permission request workflow
