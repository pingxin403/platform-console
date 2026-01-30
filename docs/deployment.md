# 部署指南

本指南介绍如何将 Internal Developer Platform 部署到 AWS EKS 环境。

## 目录

1. [部署架构](#部署架构)
2. [前置要求](#前置要求)
3. [AWS 基础设施准备](#aws-基础设施准备)
4. [配置 GitHub Secrets](#配置-github-secrets)
5. [首次部署](#首次部署)
6. [验证部署](#验证部署)
7. [故障排查](#故障排查)

---

## 部署架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                         GitHub                               │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │  Source Code │────────▶│ GitHub Actions│                 │
│  └──────────────┘         └───────┬──────┘                 │
└────────────────────────────────────┼──────────────────────────┘
                                     │
                                     │ CI/CD Pipeline
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cloud                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Amazon EKS Cluster                       │  │
│  │                                                        │  │
│  │  ┌─────────────────┐      ┌─────────────────┐       │  │
│  │  │   Staging       │      │   Production    │       │  │
│  │  │   Namespace     │      │   Namespace     │       │  │
│  │  │                 │      │                 │       │  │
│  │  │  ┌───────────┐  │      │  ┌───────────┐ │       │  │
│  │  │  │ Backstage │  │      │  │ Backstage │ │       │  │
│  │  │  │   Pods    │  │      │  │   Pods    │ │       │  │
│  │  │  │  (2-5)    │  │      │  │  (3-10)   │ │       │  │
│  │  │  └───────────┘  │      │  └───────────┘ │       │  │
│  │  └─────────────────┘      └─────────────────┘       │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │  RDS PostgreSQL  │      │  S3 Buckets      │           │
│  │  - Staging       │      │  - TechDocs      │           │
│  │  - Production    │      │  - Backups       │           │
│  └──────────────────┘      └──────────────────┘           │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │  ALB Ingress     │      │  Secrets Manager │           │
│  │  - SSL/TLS       │      │  - Credentials   │           │
│  │  - WAF           │      │  - API Keys      │           │
│  └──────────────────┘      └──────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 环境说明

#### Staging 环境

- **用途**: 测试和验证新功能
- **URL**: https://backstage-staging.example.com
- **资源**: 较小配置，节省成本
- **副本数**: 2-5 个 Pod
- **数据库**: RDS PostgreSQL (单 AZ)
- **自动部署**: Push 到 `main` 分支

#### Production 环境

- **用途**: 生产环境，服务真实用户
- **URL**: https://backstage.example.com
- **资源**: 高配置，保证性能
- **副本数**: 3-10 个 Pod（自动扩展）
- **数据库**: RDS PostgreSQL (Multi-AZ)
- **部署方式**: 创建 `v*` 标签或手动触发

---

## 前置要求

### 必需工具

- **AWS CLI**: 2.x 或更高版本
- **kubectl**: 1.28 或更高版本
- **Helm**: 3.x 或更高版本
- **Docker**: 最新版本
- **Git**: 最新版本

### 安装工具

```bash
# macOS
brew install awscli kubectl helm docker git

# 验证安装
aws --version
kubectl version --client
helm version
docker --version
git --version
```

### AWS 权限要求

部署用户需要以下 AWS 权限：

- EKS 集群管理
- RDS 数据库管理
- S3 存储桶管理
- IAM 角色和策略管理
- ACM 证书管理
- ALB 和 WAF 管理

---

## AWS 基础设施准备

### 1. 创建 EKS 集群

#### Staging 集群

```bash
# 创建 Staging EKS 集群
eksctl create cluster \
  --name backstage-cluster-staging \
  --region us-west-2 \
  --version 1.28 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed

# 配置 kubectl
aws eks update-kubeconfig \
  --region us-west-2 \
  --name backstage-cluster-staging
```

#### Production 集群

```bash
# 创建 Production EKS 集群
eksctl create cluster \
  --name backstage-cluster-production \
  --region us-west-2 \
  --version 1.28 \
  --nodegroup-name standard-workers \
  --node-type m5.large \
  --nodes 3 \
  --nodes-min 3 \
  --nodes-max 10 \
  --managed

# 配置 kubectl
aws eks update-kubeconfig \
  --region us-west-2 \
  --name backstage-cluster-production
```

### 2. 创建 RDS PostgreSQL 数据库

#### Staging 数据库

```bash
# 创建 Staging RDS 实例
aws rds create-db-instance \
  --db-instance-identifier backstage-staging \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username backstage \
  --master-user-password "YOUR_SECURE_PASSWORD" \
  --allocated-storage 50 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name backstage-subnet-group \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --storage-encrypted \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --tags Key=Environment,Value=staging Key=Application,Value=backstage
```

#### Production 数据库

```bash
# 创建 Production RDS 实例（Multi-AZ）
aws rds create-db-instance \
  --db-instance-identifier backstage-production \
  --db-instance-class db.m5.large \
  --engine postgres \
  --engine-version 15.4 \
  --master-username backstage \
  --master-user-password "YOUR_SECURE_PASSWORD" \
  --allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name backstage-subnet-group \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --multi-az \
  --storage-encrypted \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --tags Key=Environment,Value=production Key=Application,Value=backstage
```

### 3. 创建 S3 存储桶

```bash
# TechDocs 存储桶 - Staging
aws s3 mb s3://backstage-techdocs-staging --region us-west-2
aws s3api put-bucket-encryption \
  --bucket backstage-techdocs-staging \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# TechDocs 存储桶 - Production
aws s3 mb s3://backstage-techdocs-production --region us-west-2
aws s3api put-bucket-encryption \
  --bucket backstage-techdocs-production \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# 备份存储桶 - Staging
aws s3 mb s3://backstage-backups-staging --region us-west-2
aws s3api put-bucket-versioning \
  --bucket backstage-backups-staging \
  --versioning-configuration Status=Enabled

# 备份存储桶 - Production
aws s3 mb s3://backstage-backups-production --region us-west-2
aws s3api put-bucket-versioning \
  --bucket backstage-backups-production \
  --versioning-configuration Status=Enabled
```

### 4. 创建 IAM 角色（IRSA）

```bash
# 为 Backstage 创建 IAM 角色
eksctl create iamserviceaccount \
  --name backstage-staging \
  --namespace backstage-staging \
  --cluster backstage-cluster-staging \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess \
  --approve \
  --override-existing-serviceaccounts

eksctl create iamserviceaccount \
  --name backstage-production \
  --namespace backstage-production \
  --cluster backstage-cluster-production \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess \
  --approve \
  --override-existing-serviceaccounts
```

### 5. 配置 ALB Ingress Controller

```bash
# 安装 AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm repo update

# Staging
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=backstage-cluster-staging \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# Production
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=backstage-cluster-production \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 6. 申请 SSL 证书

```bash
# 使用 AWS Certificate Manager 申请证书
aws acm request-certificate \
  --domain-name backstage-staging.example.com \
  --validation-method DNS \
  --region us-west-2

aws acm request-certificate \
  --domain-name backstage.example.com \
  --validation-method DNS \
  --region us-west-2

# 记录返回的证书 ARN，后续需要配置到 GitHub Secrets
```

---

## 配置 GitHub Secrets

### 访问 GitHub 仓库设置

1. 访问: https://github.com/pingxin403/platform-console
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**

### 必需的 Secrets

#### AWS 相关

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-west-2
```

#### Kubernetes 相关

```
EKS_CLUSTER_NAME=backstage-cluster
BACKSTAGE_SERVICE_ACCOUNT_ROLE_ARN_STAGING=arn:aws:iam::123456789012:role/...
BACKSTAGE_SERVICE_ACCOUNT_ROLE_ARN_PRODUCTION=arn:aws:iam::123456789012:role/...
```

#### 证书相关

```
CERTIFICATE_ARN_STAGING=arn:aws:acm:us-west-2:123456789012:certificate/...
CERTIFICATE_ARN_PRODUCTION=arn:aws:acm:us-west-2:123456789012:certificate/...
WAF_ACL_ARN=arn:aws:wafv2:us-west-2:123456789012:webacl/...
```

#### 数据库相关

```
POSTGRES_PASSWORD_STAGING=your-secure-password-staging
POSTGRES_PASSWORD_PRODUCTION=your-secure-password-production
```

#### Backstage 相关

```
BACKEND_SECRET_STAGING=your-backend-secret-minimum-24-characters-staging
BACKEND_SECRET_PRODUCTION=your-backend-secret-minimum-24-characters-production
ORGANIZATION_NAME=Your Organization Name
```

#### GitHub 集成

```
GITHUB_TOKEN=ghp_your_github_personal_access_token
GITHUB_ORG=your-github-organization
AUTH_GITHUB_CLIENT_ID_STAGING=your-github-oauth-client-id-staging
AUTH_GITHUB_CLIENT_SECRET_STAGING=your-github-oauth-client-secret-staging
AUTH_GITHUB_CLIENT_ID_PRODUCTION=your-github-oauth-client-id-production
AUTH_GITHUB_CLIENT_SECRET_PRODUCTION=your-github-oauth-client-secret-production
```

#### 可选集成

```
ARGOCD_TOKEN_STAGING=your-argocd-token-staging
ARGOCD_TOKEN_PRODUCTION=your-argocd-token-production
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
CODECOV_TOKEN=your-codecov-token
```

---

## 首次部署

### 1. 创建 Kubernetes Secrets

在部署之前，需要在 Kubernetes 集群中创建必要的 Secrets。

#### Staging 环境

```bash
# 切换到 Staging 集群
aws eks update-kubeconfig \
  --region us-west-2 \
  --name backstage-cluster-staging

# 创建命名空间
kubectl create namespace backstage-staging

# 创建数据库密码 Secret
kubectl create secret generic backstage-postgres-staging \
  --from-literal=password='your-postgres-password-staging' \
  -n backstage-staging

# 创建 Backstage Secrets
kubectl create secret generic backstage-secrets-staging \
  --from-literal=backend-secret='your-backend-secret-staging' \
  --from-literal=github-client-id='your-github-client-id-staging' \
  --from-literal=github-client-secret='your-github-client-secret-staging' \
  --from-literal=github-token='your-github-token' \
  --from-literal=argocd-token='your-argocd-token-staging' \
  --from-literal=datadog-api-key='your-datadog-api-key' \
  --from-literal=datadog-app-key='your-datadog-app-key' \
  -n backstage-staging
```

#### Production 环境

```bash
# 切换到 Production 集群
aws eks update-kubeconfig \
  --region us-west-2 \
  --name backstage-cluster-production

# 创建命名空间
kubectl create namespace backstage-production

# 创建数据库密码 Secret
kubectl create secret generic backstage-postgres-production \
  --from-literal=password='your-postgres-password-production' \
  -n backstage-production

# 创建 Backstage Secrets
kubectl create secret generic backstage-secrets-production \
  --from-literal=backend-secret='your-backend-secret-production' \
  --from-literal=github-client-id='your-github-client-id-production' \
  --from-literal=github-client-secret='your-github-client-secret-production' \
  --from-literal=github-token='your-github-token' \
  --from-literal=argocd-token='your-argocd-token-production' \
  --from-literal=datadog-api-key='your-datadog-api-key' \
  --from-literal=datadog-app-key='your-datadog-app-key' \
  -n backstage-production
```

### 2. 触发首次部署

#### 部署到 Staging

```bash
# 方法 1: Push 到 main 分支（自动触发）
git checkout main
git pull origin main
git push origin main

# 方法 2: 手动触发
gh workflow run cd.yml --ref main -f environment=staging
```

#### 部署到 Production

```bash
# 方法 1: 创建版本标签（推荐）
git tag -a v1.0.0 -m "Release v1.0.0: Initial production deployment"
git push origin v1.0.0

# 方法 2: 手动触发
gh workflow run cd.yml --ref main -f environment=production
```

### 3. 监控部署进度

```bash
# 在 GitHub Actions 中查看
# 访问: https://github.com/pingxin403/platform-console/actions

# 或使用 kubectl 监控
kubectl get pods -n backstage-staging -w
kubectl get pods -n backstage-production -w

# 查看部署状态
kubectl rollout status deployment/backstage-staging -n backstage-staging
kubectl rollout status deployment/backstage-production -n backstage-production
```

---

## 验证部署

### 1. 检查 Pod 状态

```bash
# Staging
kubectl get pods -n backstage-staging
kubectl logs -n backstage-staging -l app=backstage-staging --tail=100

# Production
kubectl get pods -n backstage-production
kubectl logs -n backstage-production -l app=backstage-production --tail=100
```

### 2. 检查服务和 Ingress

```bash
# Staging
kubectl get svc -n backstage-staging
kubectl get ingress -n backstage-staging

# Production
kubectl get svc -n backstage-production
kubectl get ingress -n backstage-production
```

### 3. 测试应用访问

```bash
# 检查健康端点
curl https://backstage-staging.example.com/healthcheck
curl https://backstage.example.com/healthcheck

# 检查 Catalog API
curl https://backstage-staging.example.com/api/catalog/health
curl https://backstage.example.com/api/catalog/health
```

### 4. 浏览器访问

- **Staging**: https://backstage-staging.example.com
- **Production**: https://backstage.example.com

使用 GitHub OAuth 登录并验证功能。

---

## 故障排查

### Pod 无法启动

```bash
# 查看 Pod 详情
kubectl describe pod <pod-name> -n backstage-staging

# 查看日志
kubectl logs <pod-name> -n backstage-staging --previous

# 检查事件
kubectl get events -n backstage-staging --sort-by='.lastTimestamp'
```

### 数据库连接失败

```bash
# 测试数据库连接
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h backstage-staging.rds.amazonaws.com -U backstage -d backstage_staging

# 检查安全组规则
aws ec2 describe-security-groups --group-ids sg-xxxxxxxx
```

### Ingress 无法访问

```bash
# 检查 ALB 状态
kubectl describe ingress backstage-staging -n backstage-staging

# 查看 ALB Controller 日志
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# 检查 DNS 解析
nslookup backstage-staging.example.com
```

### 回滚部署

```bash
# 查看 Helm 发布历史
helm history backstage-staging -n backstage-staging

# 回滚到上一个版本
helm rollback backstage-staging -n backstage-staging

# 回滚到特定版本
helm rollback backstage-staging 3 -n backstage-staging
```

---

## 下一步

- 阅读 [本地开发指南](local-development.md)
- 查看 [CI/CD 指南](ci-cd-guide.md)
- 了解 [Git & GitHub 使用指南](git-github-guide.md)

---

## 参考资源

- [AWS EKS 文档](https://docs.aws.amazon.com/eks/)
- [Helm 文档](https://helm.sh/docs/)
- [Backstage 部署文档](https://backstage.io/docs/deployment/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
