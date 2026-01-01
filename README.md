# Internal Developer Platform

This is a [Backstage](https://backstage.io) application configured as an Internal Developer Platform (IDP) for a 50-person SaaS development company. The platform provides self-service capabilities, standardized workflows, observability integration, and AI-powered development assistance.

## Features

- **Service Catalog**: Centralized registry of all services, APIs, and components
- **Golden Path Templates**: Standardized project templates for Java, Go, React, and React Native
- **GitOps Integration**: Real-time deployment status from Argo CD
- **Observability**: Integrated monitoring with Datadog and Sentry
- **Documentation as Code**: Automated documentation generation with TechDocs
- **Cost Visibility**: Resource cost tracking with OpenCost integration
- **Workflow Automation**: Self-service operations with n8n integration
- **AI Assistance**: Code generation, documentation, and troubleshooting support
- **Search & Discovery**: Comprehensive search across all platform resources

## Quick Start

### Prerequisites

- Node.js 18+ and Yarn
- Docker and Docker Compose
- PostgreSQL (for production)
- GitHub OAuth App (for authentication)

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd platform-console
   yarn install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

4. **Access the platform**:
   Open http://localhost:7007

### Verify Setup

Run the verification script to ensure everything is configured correctly:

```bash
node scripts/verify-setup.js
```

## Production Deployment

For production deployment on AWS EKS, see [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Configuration

### Required Environment Variables

- `BACKEND_SECRET`: Secure random string (minimum 24 characters)
- `GITHUB_TOKEN`: GitHub Personal Access Token
- `AUTH_GITHUB_CLIENT_ID`: GitHub OAuth App Client ID
- `AUTH_GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret
- `POSTGRES_*`: PostgreSQL connection details

### GitHub OAuth Setup

1. Create a GitHub OAuth App in your organization settings
2. Set the callback URL to: `http://localhost:7007/api/auth/github/handler/frame` (local) or `https://your-domain.com/api/auth/github/handler/frame` (production)
3. Configure the Client ID and Secret in your environment variables

## Architecture

The platform is built on Backstage with the following key components:

- **Frontend**: React-based UI with Material-UI components
- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL for catalog and configuration data
- **Authentication**: GitHub OAuth with organization access
- **Deployment**: Kubernetes on AWS EKS with Helm charts
- **Integrations**: GitHub, Argo CD, Datadog, Sentry, OpenCost, n8n

## Development

### Project Structure

```
platform-console/
├── .kiro/            # Kiro specifications and configuration
├── packages/
│   ├── app/          # Frontend React application
│   └── backend/      # Backend Node.js application
├── plugins/          # Custom plugins
├── k8s/             # Kubernetes deployment configurations
│   ├── helm/        # Helm charts
│   └── aws/         # AWS EKS deployment scripts
├── scripts/         # Utility scripts
├── examples/        # Example catalog entities
├── app-config.yaml  # Base configuration
├── docker-compose.yml # Local development setup
└── README.md        # This file
```

### Adding Custom Plugins

1. Create a new plugin in the `plugins/` directory
2. Add the plugin to the backend in `packages/backend/src/index.ts`
3. Configure the plugin in `app-config.yaml`

### Building and Testing

```bash
# Build all packages
yarn build

# Build backend only
yarn build:backend

# Run tests
yarn test

# Lint code
yarn lint
```

## Integrations

### GitHub
- Repository discovery and catalog management
- OAuth authentication
- Scaffolder integration for project creation

### Argo CD
- Real-time deployment status
- GitOps workflow integration
- Multi-environment support

### Datadog
- Dashboard embedding
- Metrics and alerting integration
- Log aggregation

### Sentry
- Error tracking and monitoring
- Issue management integration

### OpenCost
- Kubernetes cost visibility
- Resource optimization recommendations

### n8n
- Workflow automation
- Self-service operations
- Approval processes

## Support

For issues and questions:

1. Check the [Backstage documentation](https://backstage.io/docs/)
2. Review the [DEPLOYMENT.md](./DEPLOYMENT.md) guide
3. Run the verification script: `node scripts/verify-setup.js`
4. Check application logs for specific error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.
