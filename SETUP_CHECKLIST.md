# Setup Checklist - Internal Developer Platform

本文档提供了设置和部署 Internal Developer Platform 的完整检查清单。

## 📋 前置准备

### 本地开发环境

- [ ] 安装 Node.js 22 或 24
- [ ] 安装 Yarn 4.4.1
- [ ] 安装 Docker 和 Docker Compose
- [ ] 安装 Git
- [ ] 克隆仓库: `git clone git@github.com:pingxin403/platform-console.git`

### AWS 账户和权限

- [ ] 拥有 AWS 账户
- [ ] 配置 AWS CLI
- [ ] 创建 IAM 用户并获取访问密钥
- [ ] 确认 IAM 用户有以下权限:
  - EKS 集群管理
  - RDS 数据库管理
  - S3 存储桶管理
  - IAM 角色和策略管理
  - ACM 证书管理
  - ALB 和 WAF 管理

### GitHub 配置

- [ ] 拥有 GitHub 账户
- [ ] Fork 或访问项目仓库
- [ ] 创建 GitHub Personal Access Token (权限: repo, read:org, read:user)
- [ ] 创建 GitHub OAuth 应用（本地开发）
- [ ] 创建 GitHub OAuth 应用（Staging 环境）
- [ ] 创建 GitHub OAuth 应用（Production 环境）

---

## 🏗️ AWS 基础设施设置

### 1. EKS 集群

#### Staging 集群

- [ ] 创建 EKS 集群: `backstage-cluster-staging`
- [ ] 配置节点组 (t3.medium, 2-5 节点)
- [ ] 配置 kubectl 访问
- [ ] 安装 AWS Load Balancer Controller
- [ ] 创建命名空间: `backstage-staging`

#### Production 集群

- [ ] 创建 EKS 集群: `backstage-cluster-production`
- [ ] 配置节点组 (m5.large, 3-10 节点)
- [ ] 配置 kubectl 访问
- [ ] 安装 AWS Load Balancer Controller
- [ ] 创建命名空间: `backstage-production`

### 2. RDS PostgreSQL 数据库

#### Staging 数据库

- [ ] 创建 RDS 实例: `backstage-staging`
- [ ] 实例类型: db.t3.medium
- [ ] 存储: 50GB gp3
- [ ] 启用加密
- [ ] 配置安全组允许 EKS 访问
- [ ] 记录数据库端点和凭证

#### Production 数据库

- [ ] 创建 RDS 实例: `backstage-production`
- [ ] 实例类型: db.m5.large
- [ ] 存储: 100GB gp3
- [ ] 启用 Multi-AZ
- [ ] 启用加密
- [ ] 配置安全组允许 EKS 访问
- [ ] 记录数据库端点和凭证

### 3. S3 存储桶

- [ ] 创建 TechDocs 存储桶 (Staging): `backstage-techdocs-staging`
- [ ] 创建 TechDocs 存储桶 (Production): `backstage-techdocs-production`
- [ ] 创建备份存储桶 (Staging): `backstage-backups-staging`
- [ ] 创建备份存储桶 (Production): `backstage-backups-production`
- [ ] 为所有存储桶启用加密
- [ ] 为备份存储桶启用版本控制

### 4. IAM 角色 (IRSA)

- [ ] 为 Staging 创建 Service Account IAM 角色
- [ ] 为 Production 创建 Service Account IAM 角色
- [ ] 附加 S3 访问策略
- [ ] 记录角色 ARN

### 5. SSL 证书

- [ ] 使用 ACM 申请 Staging 证书: `backstage-staging.example.com`
- [ ] 使用 ACM 申请 Production 证书: `backstage.example.com`
- [ ] 完成 DNS 验证
- [ ] 记录证书 ARN

### 6. DNS 配置

- [ ] 配置 Staging 域名: `backstage-staging.example.com`
- [ ] 配置 Production 域名: `backstage.example.com`
- [ ] 验证 DNS 解析

---

## 🔐 GitHub Secrets 配置

访问: https://github.com/pingxin403/platform-console/settings/secrets/actions

### AWS 相关

- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_REGION` (us-west-2)

### Kubernetes 相关

- [ ] `EKS_CLUSTER_NAME` (backstage-cluster)
- [ ] `BACKSTAGE_SERVICE_ACCOUNT_ROLE_ARN_STAGING`
- [ ] `BACKSTAGE_SERVICE_ACCOUNT_ROLE_ARN_PRODUCTION`

### 证书相关

- [ ] `CERTIFICATE_ARN_STAGING`
- [ ] `CERTIFICATE_ARN_PRODUCTION`
- [ ] `WAF_ACL_ARN` (可选)

### 数据库相关

- [ ] `POSTGRES_PASSWORD_STAGING`
- [ ] `POSTGRES_PASSWORD_PRODUCTION`

### Backstage 相关

- [ ] `BACKEND_SECRET_STAGING` (至少 24 个字符)
- [ ] `BACKEND_SECRET_PRODUCTION` (至少 24 个字符)
- [ ] `ORGANIZATION_NAME`

### GitHub 集成

- [ ] `GITHUB_TOKEN`
- [ ] `GITHUB_ORG`
- [ ] `AUTH_GITHUB_CLIENT_ID_STAGING`
- [ ] `AUTH_GITHUB_CLIENT_SECRET_STAGING`
- [ ] `AUTH_GITHUB_CLIENT_ID_PRODUCTION`
- [ ] `AUTH_GITHUB_CLIENT_SECRET_PRODUCTION`

### 可选集成

- [ ] `ARGOCD_TOKEN_STAGING` (可选)
- [ ] `ARGOCD_TOKEN_PRODUCTION` (可选)
- [ ] `DATADOG_API_KEY` (可选)
- [ ] `DATADOG_APP_KEY` (可选)
- [ ] `SLACK_WEBHOOK_URL` (可选)
- [ ] `CODECOV_TOKEN` (可选)

---

## 🔑 Kubernetes Secrets 创建

### Staging 环境

```bash
# 切换到 Staging 集群
aws eks update-kubeconfig --region us-west-2 --name backstage-cluster-staging

# 创建数据库密码 Secret
kubectl create secret generic backstage-postgres-staging \
  --from-literal=password='YOUR_POSTGRES_PASSWORD_STAGING' \
  -n backstage-staging

# 创建 Backstage Secrets
kubectl create secret generic backstage-secrets-staging \
  --from-literal=backend-secret='YOUR_BACKEND_SECRET_STAGING' \
  --from-literal=github-client-id='YOUR_GITHUB_CLIENT_ID_STAGING' \
  --from-literal=github-client-secret='YOUR_GITHUB_CLIENT_SECRET_STAGING' \
  --from-literal=github-token='YOUR_GITHUB_TOKEN' \
  -n backstage-staging
```

- [ ] 创建 `backstage-postgres-staging` Secret
- [ ] 创建 `backstage-secrets-staging` Secret
- [ ] 验证 Secrets 创建成功

### Production 环境

```bash
# 切换到 Production 集群
aws eks update-kubeconfig --region us-west-2 --name backstage-cluster-production

# 创建数据库密码 Secret
kubectl create secret generic backstage-postgres-production \
  --from-literal=password='YOUR_POSTGRES_PASSWORD_PRODUCTION' \
  -n backstage-production

# 创建 Backstage Secrets
kubectl create secret generic backstage-secrets-production \
  --from-literal=backend-secret='YOUR_BACKEND_SECRET_PRODUCTION' \
  --from-literal=github-client-id='YOUR_GITHUB_CLIENT_ID_PRODUCTION' \
  --from-literal=github-client-secret='YOUR_GITHUB_CLIENT_SECRET_PRODUCTION' \
  --from-literal=github-token='YOUR_GITHUB_TOKEN' \
  -n backstage-production
```

- [ ] 创建 `backstage-postgres-production` Secret
- [ ] 创建 `backstage-secrets-production` Secret
- [ ] 验证 Secrets 创建成功

---

## 🚀 本地开发环境设置

### 1. 安装依赖

```bash
cd platform-console
yarn install
```

- [ ] 依赖安装成功

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置必需的环境变量
```

- [ ] 创建 `.env` 文件
- [ ] 配置 `GITHUB_TOKEN`
- [ ] 配置 `AUTH_GITHUB_CLIENT_ID`
- [ ] 配置 `AUTH_GITHUB_CLIENT_SECRET`
- [ ] 配置 `BACKEND_SECRET`
- [ ] 配置数据库连接信息

### 3. 启动本地环境

```bash
# 方法 1: 使用 Docker Compose
docker-compose up --build

# 方法 2: 本地开发模式
docker-compose up postgres -d
yarn start
```

- [ ] PostgreSQL 启动成功
- [ ] Backstage 启动成功
- [ ] 访问 http://localhost:7007 或 http://localhost:3000
- [ ] GitHub OAuth 登录成功

### 4. 验证功能

- [ ] Service Catalog 显示正常
- [ ] 可以创建新项目（使用模板）
- [ ] TechDocs 显示正常
- [ ] 搜索功能正常

---

## 🌐 部署到 Staging

### 1. 触发部署

```bash
# 方法 1: Push 到 main 分支
git checkout main
git pull origin main
git push origin main

# 方法 2: 手动触发
gh workflow run cd.yml --ref main -f environment=staging
```

- [ ] GitHub Actions 工作流触发
- [ ] CI 检查通过
- [ ] Docker 镜像构建成功
- [ ] 部署到 Staging 成功

### 2. 验证部署

```bash
# 检查 Pod 状态
kubectl get pods -n backstage-staging

# 检查日志
kubectl logs -n backstage-staging -l app=backstage-staging --tail=100

# 测试健康端点
curl https://backstage-staging.example.com/healthcheck
```

- [ ] Pod 运行正常
- [ ] 日志无错误
- [ ] 健康检查通过
- [ ] 浏览器访问成功
- [ ] 功能验证通过

---

## 🏭 部署到 Production

### 1. 创建版本标签

```bash
# 创建版本标签
git tag -a v1.0.0 -m "Release v1.0.0: Initial production deployment"
git push origin v1.0.0
```

- [ ] 版本标签创建成功
- [ ] GitHub Actions 工作流触发

### 2. 监控部署

```bash
# 监控 Pod 状态
kubectl get pods -n backstage-production -w

# 查看部署状态
kubectl rollout status deployment/backstage-production -n backstage-production
```

- [ ] 部署成功
- [ ] Pod 运行正常
- [ ] 健康检查通过

### 3. 验证 Production

```bash
# 测试健康端点
curl https://backstage.example.com/healthcheck

# 测试 Catalog API
curl https://backstage.example.com/api/catalog/health
```

- [ ] 健康检查通过
- [ ] Catalog API 正常
- [ ] 浏览器访问成功
- [ ] GitHub OAuth 登录成功
- [ ] 所有功能正常

---

## 📊 监控和维护

### 设置监控

- [ ] 配置 Prometheus 监控
- [ ] 配置 Grafana 仪表板
- [ ] 配置 Datadog 集成（可选）
- [ ] 设置告警规则
- [ ] 配置日志聚合

### 备份配置

- [ ] 验证数据库自动备份
- [ ] 验证 S3 备份配置
- [ ] 测试恢复流程

### 文档更新

- [ ] 更新团队文档
- [ ] 记录部署信息
- [ ] 分享访问链接
- [ ] 培训团队成员

---

## ✅ 完成检查

### 本地开发

- [ ] 本地环境可以正常运行
- [ ] 所有测试通过
- [ ] 代码质量检查通过

### Staging 环境

- [ ] Staging 部署成功
- [ ] 所有功能正常工作
- [ ] 性能测试通过

### Production 环境

- [ ] Production 部署成功
- [ ] 所有功能正常工作
- [ ] 监控和告警配置完成
- [ ] 备份和恢复流程验证

### 团队准备

- [ ] 团队成员可以访问平台
- [ ] 文档已分享给团队
- [ ] 培训已完成
- [ ] 支持渠道已建立

---

## 📚 相关文档

- [本地开发指南](docs/local-development.md)
- [部署指南](docs/deployment.md)
- [CI/CD 指南](docs/ci-cd-guide.md)
- [Git & GitHub 使用指南](docs/git-github-guide.md)
- [项目概览](docs/project-overview.md)

---

## 🆘 获取帮助

如果遇到问题：

1. 查看 [故障排查](docs/deployment.md#故障排查) 部分
2. 检查 [GitHub Issues](https://github.com/pingxin403/platform-console/issues)
3. 查看应用日志
4. 在团队 Slack 频道提问

---

## 🎉 恭喜！

完成所有检查项后，你的 Internal Developer Platform 就可以投入使用了！

**下一步**:

- 开始使用 Service Catalog 注册服务
- 使用 Golden Path Templates 创建新项目
- 探索平台的各种功能
- 收集团队反馈并持续改进
