#!/bin/bash

# AWS EKS Deployment Script for Backstage Internal Developer Platform
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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if eksctl is installed
    if ! command -v eksctl &> /dev/null; then
        error "eksctl is not installed. Please install it first."
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install it first."
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "helm is not installed. Please install it first."
        exit 1
    fi
    
    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log "Prerequisites check passed!"
}

# Create EKS cluster
create_cluster() {
    log "Creating EKS cluster..."
    
    if eksctl get cluster --name $CLUSTER_NAME --region $REGION &> /dev/null; then
        warn "Cluster $CLUSTER_NAME already exists. Skipping cluster creation."
    else
        log "Creating cluster $CLUSTER_NAME in region $REGION..."
        eksctl create cluster -f eks-cluster.yaml
        log "Cluster created successfully!"
    fi
    
    # Update kubeconfig
    log "Updating kubeconfig..."
    aws eks update-kubeconfig --region $REGION --name $CLUSTER_NAME
}

# Install AWS Load Balancer Controller
install_alb_controller() {
    log "Installing AWS Load Balancer Controller..."
    
    # Add EKS Helm repository
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    
    # Install AWS Load Balancer Controller
    if helm list -n kube-system | grep -q aws-load-balancer-controller; then
        warn "AWS Load Balancer Controller already installed. Skipping."
    else
        helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
            -n kube-system \
            --set clusterName=$CLUSTER_NAME \
            --set serviceAccount.create=false \
            --set serviceAccount.name=aws-load-balancer-controller
        log "AWS Load Balancer Controller installed successfully!"
    fi
}

# Create namespace
create_namespace() {
    log "Creating namespace $NAMESPACE..."
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        warn "Namespace $NAMESPACE already exists. Skipping."
    else
        kubectl create namespace $NAMESPACE
        log "Namespace $NAMESPACE created successfully!"
    fi
}

# Install PostgreSQL using Bitnami Helm chart
install_postgresql() {
    log "Installing PostgreSQL..."
    
    # Add Bitnami Helm repository
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo update
    
    # Install PostgreSQL
    if helm list -n $NAMESPACE | grep -q postgresql; then
        warn "PostgreSQL already installed. Skipping."
    else
        helm install postgresql bitnami/postgresql \
            -n $NAMESPACE \
            --set auth.postgresPassword="backstage123" \
            --set auth.username="backstage" \
            --set auth.password="backstage123" \
            --set auth.database="backstage" \
            --set primary.persistence.enabled=true \
            --set primary.persistence.size=20Gi \
            --set primary.persistence.storageClass=gp3
        log "PostgreSQL installed successfully!"
    fi
}

# Deploy Backstage
deploy_backstage() {
    log "Deploying Backstage..."
    
    # Create secrets (these should be replaced with actual values)
    kubectl create secret generic backstage-secrets \
        --from-literal=backend-secret="your-backend-secret-here" \
        --from-literal=github-client-id="your-github-client-id" \
        --from-literal=github-client-secret="your-github-client-secret" \
        --from-literal=github-token="your-github-token" \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Install/upgrade Backstage using Helm
    helm upgrade --install $HELM_RELEASE_NAME ../helm/backstage \
        -n $NAMESPACE \
        --set postgresql.enabled=false \
        --set externalPostgresql.host="postgresql.${NAMESPACE}.svc.cluster.local" \
        --set externalPostgresql.port=5432 \
        --set externalPostgresql.username="backstage" \
        --set externalPostgresql.password="backstage123" \
        --set externalPostgresql.database="backstage" \
        --set externalPostgresql.ssl="false" \
        --wait --timeout=10m
    
    log "Backstage deployed successfully!"
}

# Get deployment status
get_status() {
    log "Getting deployment status..."
    
    echo ""
    log "Cluster Info:"
    kubectl cluster-info
    
    echo ""
    log "Backstage Pods:"
    kubectl get pods -n $NAMESPACE
    
    echo ""
    log "Backstage Services:"
    kubectl get services -n $NAMESPACE
    
    echo ""
    log "Backstage Ingress:"
    kubectl get ingress -n $NAMESPACE
    
    echo ""
    log "To access Backstage, get the Load Balancer URL:"
    echo "kubectl get ingress -n $NAMESPACE"
}

# Main deployment function
main() {
    log "Starting Backstage deployment on AWS EKS..."
    
    check_prerequisites
    create_cluster
    install_alb_controller
    create_namespace
    install_postgresql
    deploy_backstage
    get_status
    
    log "Deployment completed successfully!"
    warn "Please update the secrets in the backstage-secrets secret with your actual values:"
    warn "kubectl edit secret backstage-secrets -n $NAMESPACE"
}

# Run main function
main "$@"