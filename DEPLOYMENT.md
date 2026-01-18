# Backstage Internal Developer Platform - Deployment Guide

This guide covers the deployment of the Backstage Internal Developer Platform on AWS EKS with PostgreSQL database and GitHub OAuth authentication.

## Prerequisites

### Local Development

- Node.js 18+ and Yarn
- Docker and Docker Compose
- Git

### AWS Production Deployment

- AWS CLI configured with appropriate permissions
- eksctl (for EKS cluster management)
- kubectl (for Kubernetes management)
- Helm 3+ (for package management)
- Docker (for building images)

## Configuration

### 1. Environment Variables

Copy the example environment file and configure your values:

```bash
cp .env.example .env
```

Update the following variables:

#### Required for all environments:

- `BACKEND_SECRET`: A secure random string (minimum 24 characters)
- `GITHUB_TOKEN`: GitHub Personal Access Token with repo access
- `AUTH_GITHUB_CLIENT_ID`: GitHub OAuth App Client ID
- `AUTH_GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret

#### Required for production:

- `POSTGRES_HOST`: PostgreSQL host (managed by Helm chart)
- `POSTGRES_USER`: PostgreSQL username
- `POSTGRES_PASSWORD`: PostgreSQL password
- `POSTGRES_DB`: PostgreSQL database name
- `AWS_REGION`: AWS region for deployment
- `DOMAIN_NAME`: Your domain name for the platform
- `CERTIFICATE_ARN`: AWS ACM certificate ARN for HTTPS

### 2. GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App with:
   - Application name: "Internal Developer Platform"
   - Homepage URL: `https://backstage.yourdomain.com` (production) or `http://localhost:3000` (local)
   - Authorization callback URL: `https://backstage.yourdomain.com/api/auth/github/handler/frame` (production) or `http://localhost:7007/api/auth/github/handler/frame` (local)
3. Note the Client ID and Client Secret for your environment variables

### 3. GitHub Personal Access Token

Create a GitHub Personal Access Token with the following scopes:

- `repo` (for repository access)
- `read:org` (for organization access)
- `read:user` (for user information)
- `user:email` (for user email access)

## Local Development

### Option 1: Docker Compose (Recommended)

1. Build and start the services:

```bash
docker-compose up --build
```

2. Access the platform at `http://localhost:7007`

### Option 2: Native Development

1. Install dependencies:

```bash
yarn install
```

2. Start PostgreSQL (using Docker):

```bash
docker run --name postgres -e POSTGRES_USER=backstage -e POSTGRES_PASSWORD=backstage123 -e POSTGRES_DB=backstage -p 5432:5432 -d postgres:15
```

3. Start the backend:

```bash
yarn dev
```

4. Access the platform at `http://localhost:3000`

## Production Deployment on AWS EKS

### 1. Prepare AWS Environment

Ensure your AWS CLI is configured with appropriate permissions:

```bash
aws configure
aws sts get-caller-identity
```

### 2. Deploy to EKS

Navigate to the AWS deployment directory and run the deployment script:

```bash
cd k8s/aws
./deploy.sh
```

This script will:

- Create an EKS cluster with the configuration in `eks-cluster.yaml`
- Install the AWS Load Balancer Controller
- Create the backstage namespace
- Install PostgreSQL using Bitnami Helm chart
- Deploy Backstage using the custom Helm chart

### 3. Update Secrets

After deployment, update the secrets with your actual values:

```bash
kubectl edit secret backstage-secrets -n backstage
```

Update the base64-encoded values for:

- `backend-secret`
- `github-client-id`
- `github-client-secret`
- `github-token`

### 4. Configure DNS

1. Get the Load Balancer URL:

```bash
kubectl get ingress -n backstage
```

2. Create a CNAME record in your DNS provider pointing your domain to the Load Balancer URL

### 5. Verify Deployment

Check the deployment status:

```bash
kubectl get pods -n backstage
kubectl get services -n backstage
kubectl logs -f deployment/backstage -n backstage
```

## Configuration Files

### Key Configuration Files:

- `app-config.yaml`: Base configuration for all environments
- `app-config.local.yaml`: Local development overrides
- `app-config.production.yaml`: Production configuration
- `k8s/helm/backstage/values.yaml`: Helm chart values for Kubernetes deployment
- `k8s/aws/eks-cluster.yaml`: EKS cluster configuration

### Database Configuration:

- Local: SQLite in-memory (development)
- Production: PostgreSQL on AWS RDS or in-cluster PostgreSQL

### Authentication:

- Local: Guest authentication (optional GitHub OAuth)
- Production: GitHub OAuth with organization access

## Monitoring and Maintenance

### Health Checks

The application includes health check endpoints:

- `/healthcheck`: Basic health check
- Kubernetes liveness and readiness probes are configured

### Logs

View application logs:

```bash
# Local (Docker Compose)
docker-compose logs -f backstage

# Production (Kubernetes)
kubectl logs -f deployment/backstage -n backstage
```

### Database Maintenance

- PostgreSQL backups are handled by AWS RDS (if using managed RDS)
- For in-cluster PostgreSQL, configure backup strategies using Velero or similar tools

## Troubleshooting

### Common Issues:

1. **Database Connection Issues**

   - Verify PostgreSQL is running and accessible
   - Check connection parameters in environment variables
   - Ensure database exists and user has proper permissions

2. **GitHub OAuth Issues**

   - Verify OAuth app configuration in GitHub
   - Check callback URLs match your deployment
   - Ensure GitHub token has required scopes

3. **Kubernetes Deployment Issues**

   - Check pod logs: `kubectl logs -f deployment/backstage -n backstage`
   - Verify secrets are properly configured
   - Ensure Load Balancer Controller is installed and working

4. **Build Issues**
   - Clear yarn cache: `yarn cache clean`
   - Remove node_modules and reinstall: `rm -rf node_modules && yarn install`
   - Check Node.js version compatibility

### Getting Help

- Check Backstage documentation: https://backstage.io/docs/
- Review application logs for specific error messages
- Verify all environment variables are properly set

## Security Considerations

1. **Secrets Management**

   - Use AWS Secrets Manager or Kubernetes secrets for sensitive data
   - Rotate secrets regularly
   - Never commit secrets to version control

2. **Network Security**

   - Configure security groups to restrict database access
   - Use HTTPS in production with valid certificates
   - Implement proper RBAC in Kubernetes

3. **Authentication**
   - Configure GitHub OAuth with organization restrictions
   - Implement proper user role management
   - Regular audit of user access

## Scaling

The deployment is configured for horizontal scaling:

- Adjust `replicaCount` in Helm values for more instances
- Configure HPA (Horizontal Pod Autoscaler) for automatic scaling
- Monitor resource usage and adjust resource requests/limits as needed
