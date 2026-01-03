#!/bin/bash

# Backup and Disaster Recovery Script for Backstage Internal Developer Platform
# This script provides automated backup and restore capabilities for production

set -euo pipefail

# Configuration
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-backstage-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-backstage}"
POSTGRES_DB="${POSTGRES_DB:-backstage}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    local deps=("aws" "pg_dump" "pg_restore" "kubectl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is required but not installed"
            exit 1
        fi
    done
    log_info "All dependencies are available"
}

# Database backup
backup_database() {
    log_info "Starting database backup..."
    
    local backup_file="database_backup_${TIMESTAMP}.sql"
    local compressed_file="${backup_file}.gz"
    
    # Create database backup
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        --file="${backup_file}"
    
    # Compress backup
    gzip "${backup_file}"
    
    # Upload to S3
    aws s3 cp "${compressed_file}" "s3://${BACKUP_S3_BUCKET}/database-backups/${compressed_file}" \
        --region "${AWS_REGION}" \
        --server-side-encryption AES256 \
        --metadata "backup-type=database,timestamp=${TIMESTAMP}"
    
    # Cleanup local file
    rm -f "${compressed_file}"
    
    log_info "Database backup completed: ${compressed_file}"
}

# Configuration backup
backup_configuration() {
    log_info "Starting configuration backup..."
    
    local config_backup_dir="config_backup_${TIMESTAMP}"
    local config_archive="${config_backup_dir}.tar.gz"
    
    # Create backup directory
    mkdir -p "${config_backup_dir}"
    
    # Backup configuration files
    cp -r app-config*.yaml "${config_backup_dir}/" 2>/dev/null || true
    cp -r rbac-policy.yaml "${config_backup_dir}/" 2>/dev/null || true
    cp -r k8s/ "${config_backup_dir}/" 2>/dev/null || true
    cp -r examples/ "${config_backup_dir}/" 2>/dev/null || true
    cp -r templates/ "${config_backup_dir}/" 2>/dev/null || true
    
    # Backup Kubernetes resources
    if command -v kubectl &> /dev/null; then
        kubectl get configmaps,secrets,deployments,services,ingresses \
            -n backstage -o yaml > "${config_backup_dir}/k8s-resources.yaml" 2>/dev/null || true
    fi
    
    # Create archive
    tar -czf "${config_archive}" "${config_backup_dir}"
    
    # Upload to S3
    aws s3 cp "${config_archive}" "s3://${BACKUP_S3_BUCKET}/config-backups/${config_archive}" \
        --region "${AWS_REGION}" \
        --server-side-encryption AES256 \
        --metadata "backup-type=configuration,timestamp=${TIMESTAMP}"
    
    # Cleanup
    rm -rf "${config_backup_dir}" "${config_archive}"
    
    log_info "Configuration backup completed: ${config_archive}"
}

# Restore database
restore_database() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file not specified"
        exit 1
    fi
    
    log_info "Starting database restore from: $backup_file"
    
    # Download backup from S3
    local local_backup="restore_${TIMESTAMP}.sql.gz"
    aws s3 cp "s3://${BACKUP_S3_BUCKET}/database-backups/${backup_file}" "${local_backup}" \
        --region "${AWS_REGION}"
    
    # Decompress
    gunzip "${local_backup}"
    local_backup="${local_backup%.gz}"
    
    # Restore database
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        "${local_backup}"
    
    # Cleanup
    rm -f "${local_backup}"
    
    log_info "Database restore completed"
}

# Restore configuration
restore_configuration() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file not specified"
        exit 1
    fi
    
    log_info "Starting configuration restore from: $backup_file"
    
    # Download backup from S3
    local local_backup="restore_config_${TIMESTAMP}.tar.gz"
    aws s3 cp "s3://${BACKUP_S3_BUCKET}/config-backups/${backup_file}" "${local_backup}" \
        --region "${AWS_REGION}"
    
    # Extract archive
    tar -xzf "${local_backup}"
    local extract_dir="${local_backup%.tar.gz}"
    
    # Restore configuration files
    if [[ -d "${extract_dir}" ]]; then
        cp -r "${extract_dir}"/* . 2>/dev/null || true
        log_info "Configuration files restored"
        
        # Apply Kubernetes resources if available
        if [[ -f "${extract_dir}/k8s-resources.yaml" ]] && command -v kubectl &> /dev/null; then
            kubectl apply -f "${extract_dir}/k8s-resources.yaml" -n backstage || true
            log_info "Kubernetes resources applied"
        fi
    fi
    
    # Cleanup
    rm -rf "${local_backup}" "${extract_dir}"
    
    log_info "Configuration restore completed"
}

# List available backups
list_backups() {
    log_info "Available database backups:"
    aws s3 ls "s3://${BACKUP_S3_BUCKET}/database-backups/" --region "${AWS_REGION}" | sort -r
    
    log_info "Available configuration backups:"
    aws s3 ls "s3://${BACKUP_S3_BUCKET}/config-backups/" --region "${AWS_REGION}" | sort -r
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
    
    # Calculate cutoff date
    local cutoff_date
    if [[ "$OSTYPE" == "darwin"* ]]; then
        cutoff_date=$(date -v-${BACKUP_RETENTION_DAYS}d +%Y-%m-%d)
    else
        cutoff_date=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%Y-%m-%d)
    fi
    
    # Cleanup database backups
    aws s3api list-objects-v2 \
        --bucket "${BACKUP_S3_BUCKET}" \
        --prefix "database-backups/" \
        --query "Contents[?LastModified<='${cutoff_date}'].Key" \
        --output text \
        --region "${AWS_REGION}" | \
    while read -r key; do
        if [[ -n "$key" ]]; then
            aws s3 rm "s3://${BACKUP_S3_BUCKET}/${key}" --region "${AWS_REGION}"
            log_info "Deleted old backup: ${key}"
        fi
    done
    
    # Cleanup configuration backups
    aws s3api list-objects-v2 \
        --bucket "${BACKUP_S3_BUCKET}" \
        --prefix "config-backups/" \
        --query "Contents[?LastModified<='${cutoff_date}'].Key" \
        --output text \
        --region "${AWS_REGION}" | \
    while read -r key; do
        if [[ -n "$key" ]]; then
            aws s3 rm "s3://${BACKUP_S3_BUCKET}/${key}" --region "${AWS_REGION}"
            log_info "Deleted old backup: ${key}"
        fi
    done
    
    log_info "Cleanup completed"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Check database connectivity
    if PGPASSWORD="${POSTGRES_PASSWORD}" pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"; then
        log_info "Database is accessible"
    else
        log_error "Database is not accessible"
        return 1
    fi
    
    # Check S3 bucket access
    if aws s3 ls "s3://${BACKUP_S3_BUCKET}/" --region "${AWS_REGION}" > /dev/null 2>&1; then
        log_info "S3 bucket is accessible"
    else
        log_error "S3 bucket is not accessible"
        return 1
    fi
    
    # Check Kubernetes connectivity
    if command -v kubectl &> /dev/null && kubectl cluster-info > /dev/null 2>&1; then
        log_info "Kubernetes cluster is accessible"
    else
        log_warn "Kubernetes cluster is not accessible"
    fi
    
    log_info "Health check completed"
}

# Disaster recovery test
disaster_recovery_test() {
    log_info "Starting disaster recovery test..."
    
    # Create test backup
    backup_database
    backup_configuration
    
    # List recent backups
    list_backups
    
    log_info "Disaster recovery test completed"
    log_warn "This was a test. To perform actual recovery, use the restore commands"
}

# Usage information
usage() {
    cat << EOF
Backup and Disaster Recovery Script for Backstage Internal Developer Platform

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    backup-db                   Backup database
    backup-config              Backup configuration files
    backup-all                 Backup both database and configuration
    restore-db <backup-file>   Restore database from backup
    restore-config <backup-file> Restore configuration from backup
    list                       List available backups
    cleanup                    Remove old backups
    health-check              Check system health
    dr-test                   Perform disaster recovery test

Environment Variables:
    BACKUP_S3_BUCKET          S3 bucket for backups (default: backstage-backups)
    AWS_REGION               AWS region (default: us-east-1)
    POSTGRES_HOST            PostgreSQL host (default: localhost)
    POSTGRES_PORT            PostgreSQL port (default: 5432)
    POSTGRES_USER            PostgreSQL user (default: backstage)
    POSTGRES_PASSWORD        PostgreSQL password (required)
    POSTGRES_DB              PostgreSQL database (default: backstage)
    BACKUP_RETENTION_DAYS    Backup retention in days (default: 30)

Examples:
    $0 backup-all
    $0 restore-db database_backup_20240103_120000.sql.gz
    $0 list
    $0 cleanup

EOF
}

# Main script logic
main() {
    case "${1:-}" in
        backup-db)
            check_dependencies
            backup_database
            ;;
        backup-config)
            check_dependencies
            backup_configuration
            ;;
        backup-all)
            check_dependencies
            backup_database
            backup_configuration
            ;;
        restore-db)
            check_dependencies
            restore_database "${2:-}"
            ;;
        restore-config)
            check_dependencies
            restore_configuration "${2:-}"
            ;;
        list)
            check_dependencies
            list_backups
            ;;
        cleanup)
            check_dependencies
            cleanup_old_backups
            ;;
        health-check)
            check_dependencies
            health_check
            ;;
        dr-test)
            check_dependencies
            disaster_recovery_test
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"