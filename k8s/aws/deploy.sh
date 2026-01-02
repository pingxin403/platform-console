#!/bin/bash

# AWS EKS Deployment Script for Backstage Internal Developer Platform
# Production-ready deployment with security best practices
set -e

# Configuration
CLUSTER_NAME="backstage-cluster"
REGION="us-west-2"
NAMESPACE="backstage"
HELM_RELEASE_NAME="backstage"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if eksctl is installed
    if ! command -v eksctl &> /dev/null; then
        error "eksctl is not installed. Please install it first."
        error "Visit: https://eksctl.io/installation/"
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install it first."
        error "Visit: https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "helm is not installed. Please install it first."
        error "Visit: https://helm.sh/docs/intro/install/"
        exit 1
    fi
    
    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    # Check if required environment variables are set
    if [[ -z "$GITHUB_TOKEN" || -z "$AUTH_GITHUB_CLIENT_ID" || -z "$AUTH_GITHUB_CLIENT_SECRET" ]]; then
        error "Required environment variables are not set."
        error "Please set: GITHUB_TOKEN, AUTH_GITHUB_CLIENT_ID, AUTH_GITHUB_CLIENT_SECRET"
        exit 1
    fi
    
    log "Prerequisites check passed!"
}

# Create EKS cluster with security best practices
create_cluster() {
    log "Creating EKS cluster with security hardening..."
    
    if eksctl get cluster --name $CLUSTER_NAME --region $REGION &> /dev/null; then
        warn "Cluster $CLUSTER_NAME already exists. Skipping cluster creation."
    else
        log "Creating cluster $CLUSTER_NAME in region $REGION..."
        eksctl create cluster -f eks-cluster.yaml
        log "Cluster created successfully!"
        
        # Enable logging
        log "Enabling cluster logging..."
        eksctl utils update-cluster-logging --enable-types=all --region=$REGION --cluster=$CLUSTER_NAME
    fi
    
    # Update kubeconfig
    log "Updating kubeconfig..."
    aws eks update-kubeconfig --region $REGION --name $CLUSTER_NAME
}

# Install essential cluster components
install_cluster_components() {
    log "Installing essential cluster components..."
    
    # Add Helm repositories
    helm repo add eks https://aws.github.io/eks-charts
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install AWS Load Balancer Controller
    install_alb_controller
    
    # Install cert-manager for TLS certificates
    install_cert_manager
    
    # Install metrics server
    install_metrics_server
}

# Install AWS Load Balancer Controller
install_alb_controller() {
    log "Installing AWS Load Balancer Controller..."
    
    if helm list -n kube-system | grep -q aws-load-balancer-controller; then
        warn "AWS Load Balancer Controller already installed. Skipping."
    else
        # Create IAM service account
        eksctl create iamserviceaccount \
            --cluster=$CLUSTER_NAME \
            --namespace=kube-system \
            --name=aws-load-balancer-controller \
            --role-name "AmazonEKSLoadBalancerControllerRole" \
            --attach-policy-arn=arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \
            --approve \
            --override-existing-serviceaccounts
        
        # Install controller
        helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
            -n kube-system \
            --set clusterName=$CLUSTER_NAME \
            --set serviceAccount.create=false \
            --set serviceAccount.name=aws-load-balancer-controller \
            --set region=$REGION \
            --set vpcId=$(aws eks describe-cluster --name $CLUSTER_NAME --region $REGION --query "cluster.resourcesVpcConfig.vpcId" --output text)
        
        log "AWS Load Balancer Controller installed successfully!"
    fi
}

# Install cert-manager for TLS certificate management
install_cert_manager() {
    log "Installing cert-manager..."
    
    if helm list -n cert-manager | grep -q cert-manager; then
        warn "cert-manager already installed. Skipping."
    else
        kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
        
        helm install cert-manager jetstack/cert-manager \
            --namespace cert-manager \
            --version v1.13.0 \
            --set installCRDs=true \
            --set global.leaderElection.namespace=cert-manager
        
        log "cert-manager installed successfully!"
    fi
}

# Install metrics server
install_metrics_server() {
    log "Installing metrics server..."
    
    if kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        warn "Metrics server already installed. Skipping."
    else
        kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
        log "Metrics server installed successfully!"
    fi
}

# Create namespace with security policies
create_namespace() {
    log "Creating namespace $NAMESPACE with security policies..."
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        warn "Namespace $NAMESPACE already exists. Skipping."
    else
        # Create namespace with security labels
        kubectl create namespace $NAMESPACE
        kubectl label namespace $NAMESPACE \
            pod-security.kubernetes.io/enforce=restricted \
            pod-security.kubernetes.io/audit=restricted \
            pod-security.kubernetes.io/warn=restricted
        
        log "Namespace $NAMESPACE created successfully with security policies!"
    fi
}

# Create secrets securely
create_secrets() {
    log "Creating Kubernetes secrets..."
    
    # Generate a secure backend secret if not provided
    if [[ -z "$BACKEND_SECRET" ]]; then
        BACKEND_SECRET=$(openssl rand -base64 32)
        warn "Generated random BACKEND_SECRET. Save this value: $BACKEND_SECRET"
    fi
    
    # Create backstage secrets
    kubectl create secret generic backstage-secrets \
        --from-literal=backend-secret="$BACKEND_SECRET" \
        --from-literal=github-client-id="$AUTH_GITHUB_CLIENT_ID" \
        --from-literal=github-client-secret="$AUTH_GITHUB_CLIENT_SECRET" \
        --from-literal=github-token="$GITHUB_TOKEN" \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "Secrets created successfully!"
}

# Install PostgreSQL with security hardening
install_postgresql() {
    log "Installing PostgreSQL with security hardening..."
    
    if helm list -n $NAMESPACE | grep -q postgresql; then
        warn "PostgreSQL already installed. Skipping."
    else
        # Generate secure password if not provided
        if [[ -z "$POSTGRES_PASSWORD" ]]; then
            POSTGRES_PASSWORD=$(openssl rand -base64 16)
            warn "Generated random PostgreSQL password. Save this value: $POSTGRES_PASSWORD"
        fi
        
        helm install postgresql bitnami/postgresql \
            -n $NAMESPACE \
            --set auth.postgresPassword="$POSTGRES_PASSWORD" \
            --set auth.username="backstage" \
            --set auth.password="$POSTGRES_PASSWORD" \
            --set auth.database="backstage" \
            --set primary.persistence.enabled=true \
            --set primary.persistence.size=20Gi \
            --set primary.persistence.storageClass=gp3 \
            --set primary.securityContext.enabled=true \
            --set primary.securityContext.runAsNonRoot=true \
            --set primary.securityContext.runAsUser=999 \
            --set primary.securityContext.fsGroup=999 \
            --set primary.containerSecurityContext.enabled=true \
            --set primary.containerSecurityContext.runAsNonRoot=true \
            --set primary.containerSecurityContext.runAsUser=999 \
            --set primary.containerSecurityContext.allowPrivilegeEscalation=false \
            --set primary.containerSecurityContext.readOnlyRootFilesystem=false \
            --set primary.containerSecurityContext.capabilities.drop[0]=ALL \
            --set metrics.enabled=true \
            --set metrics.serviceMonitor.enabled=true
        
        log "PostgreSQL installed successfully with security hardening!"
    fi
}

# Deploy Backstage with production configuration
deploy_backstage() {
    log "Deploying Backstage with production configuration..."
    
    # Build and push Docker image (if needed)
    if [[ "$BUILD_IMAGE" == "true" ]]; then
        log "Building and pushing Docker image..."
        docker build -t $ECR_REPOSITORY:latest -f packages/backend/Dockerfile .
        docker push $ECR_REPOSITORY:latest
    fi
    
    # Install/upgrade Backstage using Helm
    helm upgrade --install $HELM_RELEASE_NAME ../helm/backstage \
        -n $NAMESPACE \
        --set postgresql.enabled=false \
        --set externalPostgresql.host="postgresql.${NAMESPACE}.svc.cluster.local" \
        --set externalPostgresql.port=5432 \
        --set externalPostgresql.username="backstage" \
        --set externalPostgresql.password="$POSTGRES_PASSWORD" \
        --set externalPostgresql.database="backstage" \
        --set externalPostgresql.ssl="false" \
        --set image.repository="${ECR_REPOSITORY:-backstage}" \
        --set image.tag="${IMAGE_TAG:-latest}" \
        --set backstage.secrets.backendSecret="$BACKEND_SECRET" \
        --set backstage.secrets.githubClientId="$AUTH_GITHUB_CLIENT_ID" \
        --set backstage.secrets.githubClientSecret="$AUTH_GITHUB_CLIENT_SECRET" \
        --set backstage.secrets.githubToken="$GITHUB_TOKEN" \
        --wait --timeout=15m
    
    log "Backstage deployed successfully!"
}

# Setup monitoring and observability
setup_monitoring() {
    log "Setting up monitoring and observability..."
    
    # Install Prometheus and Grafana (optional)
    if [[ "$INSTALL_MONITORING" == "true" ]]; then
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        helm install prometheus prometheus-community/kube-prometheus-stack \
            -n monitoring \
            --create-namespace \
            --set grafana.adminPassword="admin123" \
            --set prometheus.prometheusSpec.retention=30d
        
        log "Monitoring stack installed successfully!"
    fi
}

# Get deployment status and access information
get_status() {
    log "Getting deployment status..."
    
    echo ""
    info "=== Cluster Information ==="
    kubectl cluster-info
    
    echo ""
    info "=== Backstage Pods ==="
    kubectl get pods -n $NAMESPACE -o wide
    
    echo ""
    info "=== Backstage Services ==="
    kubectl get services -n $NAMESPACE
    
    echo ""
    info "=== Backstage Ingress ==="
    kubectl get ingress -n $NAMESPACE
    
    echo ""
    info "=== PostgreSQL Status ==="
    kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=postgresql
    
    echo ""
    info "=== Secrets ==="
    kubectl get secrets -n $NAMESPACE
    
    echo ""
    log "To access Backstage:"
    INGRESS_URL=$(kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")
    if [[ "$INGRESS_URL" != "pending" ]]; then
        echo "  URL: https://$INGRESS_URL"
    else
        echo "  Ingress is still provisioning. Check status with:"
        echo "  kubectl get ingress -n $NAMESPACE"
    fi
    
    echo ""
    log "To check logs:"
    echo "  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=backstage -f"
    
    echo ""
    log "To port-forward for local access:"
    echo "  kubectl port-forward -n $NAMESPACE svc/backstage 7007:7007"
}

# Cleanup function
cleanup() {
    warn "Cleaning up resources..."
    
    # Delete Backstage
    helm uninstall $HELM_RELEASE_NAME -n $NAMESPACE || true
    
    # Delete PostgreSQL
    helm uninstall postgresql -n $NAMESPACE || true
    
    # Delete namespace
    kubectl delete namespace $NAMESPACE || true
    
    # Delete cluster (optional)
    if [[ "$DELETE_CLUSTER" == "true" ]]; then
        eksctl delete cluster --name $CLUSTER_NAME --region $REGION
    fi
    
    log "Cleanup completed!"
}

# Main deployment function
main() {
    case "${1:-deploy}" in
        "deploy")
            log "Starting Backstage deployment on AWS EKS..."
            check_prerequisites
            create_cluster
            install_cluster_components
            create_namespace
            create_secrets
            install_postgresql
            deploy_backstage
            setup_monitoring
            get_status
            log "Deployment completed successfully!"
            ;;
        "status")
            get_status
            ;;
        "cleanup")
            cleanup
            ;;
        *)
            echo "Usage: $0 [deploy|status|cleanup]"
            echo "  deploy  - Deploy Backstage (default)"
            echo "  status  - Show deployment status"
            echo "  cleanup - Clean up resources"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"