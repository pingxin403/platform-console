#!/bin/bash

# Local Kubernetes Deployment Script for Backstage
# This script helps you quickly deploy Backstage to a local Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="backstage"
RELEASE_NAME="backstage"
IMAGE_NAME="backstage:local"
HELM_CHART="./k8s/helm/backstage"
VALUES_FILE="./k8s/helm/backstage/values-local.yaml"

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# Check prerequisites
print_info "Checking prerequisites..."
check_command kubectl
check_command helm
check_command docker

# Detect Kubernetes environment
if kubectl config current-context | grep -q "minikube"; then
    K8S_ENV="minikube"
    print_info "Detected Minikube environment"
elif kubectl config current-context | grep -q "kind"; then
    K8S_ENV="kind"
    print_info "Detected Kind environment"
elif kubectl config current-context | grep -q "docker-desktop"; then
    K8S_ENV="docker-desktop"
    print_info "Detected Docker Desktop environment"
else
    K8S_ENV="unknown"
    print_warn "Unknown Kubernetes environment, proceeding anyway..."
fi

# Step 1: Build Docker image
print_info "Building Docker image (this may take 5-10 minutes)..."
if ! docker build -f packages/backend/Dockerfile -t $IMAGE_NAME .; then
    print_error "Docker build failed. Please check the error messages above."
    print_info "Common issues:"
    print_info "  - Network timeout: Try again or use a VPN"
    print_info "  - Insufficient resources: Increase Docker memory/CPU limits"
    print_info "  - Build errors: Check that all source files are present"
    exit 1
fi

# Step 2: Load image to cluster
if [ "$K8S_ENV" = "minikube" ]; then
    print_info "Loading image to Minikube..."
    minikube image load $IMAGE_NAME
elif [ "$K8S_ENV" = "kind" ]; then
    print_info "Loading image to Kind..."
    kind load docker-image $IMAGE_NAME
else
    print_info "Skipping image load (not needed for Docker Desktop)"
fi

# Step 3: Create namespace
print_info "Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Step 4: Create secrets
print_info "Creating secrets..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    print_warn ".env.local not found, creating from .env.example..."
    cp .env.example .env.local
    print_warn "Please edit .env.local with your configuration"
    exit 1
fi

# Source environment variables
source .env.local

# Create backstage-secrets
kubectl create secret generic backstage-secrets \
    --from-literal=backend-secret="${BACKEND_SECRET:-local-test-secret-minimum-24-characters-long}" \
    --from-literal=github-token="${GITHUB_TOKEN:-}" \
    --from-literal=github-client-id="${AUTH_GITHUB_CLIENT_ID:-}" \
    --from-literal=github-client-secret="${AUTH_GITHUB_CLIENT_SECRET:-}" \
    --from-literal=argocd-token="${ARGOCD_TOKEN:-}" \
    --from-literal=datadog-api-key="${DATADOG_API_KEY:-}" \
    --from-literal=datadog-app-key="${DATADOG_APP_KEY:-}" \
    -n $NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

# Create postgres secret
kubectl create secret generic backstage-postgres \
    --from-literal=password="${POSTGRES_PASSWORD:-backstage123}" \
    -n $NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

print_info "Secrets created successfully"

# Step 5: Deploy with Helm
print_info "Deploying Backstage with Helm..."
helm upgrade --install $RELEASE_NAME $HELM_CHART \
    -f $VALUES_FILE \
    -n $NAMESPACE \
    --wait \
    --timeout 10m

# Step 6: Wait for pods to be ready
print_info "Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod \
    -l app.kubernetes.io/name=backstage \
    -n $NAMESPACE \
    --timeout=300s

# Step 7: Display access information
print_info "Deployment completed successfully!"
echo ""
print_info "Access Backstage:"

if [ "$K8S_ENV" = "minikube" ]; then
    echo "  Run: minikube service $RELEASE_NAME -n $NAMESPACE"
    echo "  Or: kubectl port-forward svc/$RELEASE_NAME 7007:7007 -n $NAMESPACE"
elif [ "$K8S_ENV" = "kind" ] || [ "$K8S_ENV" = "docker-desktop" ]; then
    echo "  Run: kubectl port-forward svc/$RELEASE_NAME 7007:7007 -n $NAMESPACE"
    echo "  Then visit: http://localhost:7007"
else
    NODE_PORT=$(kubectl get svc $RELEASE_NAME -n $NAMESPACE -o jsonpath='{.spec.ports[0].nodePort}')
    echo "  NodePort: $NODE_PORT"
    echo "  Run: kubectl port-forward svc/$RELEASE_NAME 7007:7007 -n $NAMESPACE"
fi

echo ""
print_info "Useful commands:"
echo "  View logs: kubectl logs -f deployment/$RELEASE_NAME -n $NAMESPACE"
echo "  View pods: kubectl get pods -n $NAMESPACE"
echo "  View services: kubectl get svc -n $NAMESPACE"
echo "  Uninstall: helm uninstall $RELEASE_NAME -n $NAMESPACE"
echo ""
