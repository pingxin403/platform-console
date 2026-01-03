# Getting Started

This guide will help you get started with the Internal Developer Platform.

## Prerequisites

- GitHub account with access to your organization
- Basic understanding of containerized applications
- Familiarity with Kubernetes concepts

## Accessing the Platform

1. Navigate to the platform URL: `https://your-platform.company.com`
2. Sign in with your GitHub account
3. Complete the onboarding checklist

## Creating Your First Service

### Using Golden Path Templates

1. Navigate to **Create** → **Choose a template**
2. Select the appropriate template for your technology stack:
   - **Java Service**: Spring Boot microservice with best practices
   - **Go Service**: Go HTTP service with observability
   - **React App**: Frontend application with CI/CD
   - **React Native App**: Mobile application template

3. Fill in the required information:
   - **Name**: Your service name (kebab-case)
   - **Description**: Brief description of the service
   - **Owner**: Your team name
   - **Repository**: GitHub repository details

4. Click **Create** to generate your service

### What Gets Created

The template will create:
- ✅ GitHub repository with complete project structure
- ✅ CI/CD pipeline with GitHub Actions
- ✅ Dockerfile and Kubernetes manifests
- ✅ Service catalog registration
- ✅ Monitoring and observability setup
- ✅ Documentation structure

## Exploring Your Service

After creation, your service will appear in the **Service Catalog** with:

### Overview Tab
- Service metadata and ownership
- Repository links and documentation
- Dependency graph and relationships

### CI/CD Tab
- Build pipeline status and history
- Deployment status across environments
- Manual deployment triggers

### Monitoring Tab
- Datadog dashboards and metrics
- Sentry error tracking
- Performance monitoring

### API Tab
- OpenAPI/GraphQL documentation
- Interactive API explorer
- SDK generation links

## Next Steps

1. **Clone your repository** and start developing
2. **Configure monitoring** by adding custom metrics
3. **Set up alerts** in Datadog for your service
4. **Add documentation** in the `/docs` directory
5. **Invite team members** to collaborate

## Common Tasks

### Adding Dependencies
Update your service's `catalog-info.yaml` to declare dependencies:

```yaml
spec:
  dependsOn:
    - component:user-service
    - resource:user-database
```

### Updating Documentation
Add Markdown files to your `/docs` directory. They'll automatically appear in TechDocs.

### Configuring Alerts
Use the Datadog integration to set up monitoring and alerting for your service.

## Getting Help

- **Documentation**: Browse the platform documentation
- **Slack**: Ask questions in #developer-platform
- **Office Hours**: Join weekly platform office hours
- **Issues**: Report bugs or request features