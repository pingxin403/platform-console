# CI/CD 指南

本指南介绍如何使用 GitHub Actions 实现 Internal Developer Platform 的持续集成和持续部署。

## 目录

1. [CI/CD 概览](#cicd-概览)
2. [CI 流程](#ci-流程)
3. [CD 流程](#cd-流程)
4. [配置 GitHub Secrets](#配置-github-secrets)
5. [部署环境](#部署环境)
6. [手动触发部署](#手动触发部署)
7. [监控和回滚](#监控和回滚)
8. [最佳实践](#最佳实践)

---

## CI/CD 概览

### 工作流文件

项目包含两个主要的 GitHub Actions 工作流：

1. **`.github/workflows/ci.yml`** - 持续集成
   - 代码检查（Lint）
   - 类型检查（TypeScript）
   - 单元测试
   - 构建验证
   - 安全扫描
   - Docker 镜像构建

2. **`.github/workflows/cd.yml`** - 持续部署
   - 构建和推送 Docker 镜像
   - 部署到 Staging 环境
   - 部署到 Production 环境
   - 部署后测试
   - 通知

### 触发条件

#### CI 工作流触发条件

- Push 到 `main` 或 `develop` 分支
- 创建 Pull Request 到 `main` 或 `develop` 分支

#### CD 工作流触发条件

- Push 到 `main` 分支 → 自动部署到 Staging
- 创建 `v*` 标签 → 自动部署到 Production
- 手动触发 → 选择部署到 Staging 或 Production

---

## CI 流程

### 1. Lint 和类型检查

```yaml
jobs:
  lint:
    - ESLint 检查
    - Prettier 格式检查
    - TypeScript 类型检查
```

**本地运行**:
```bash
yarn lint:all
yarn prettier:check
yarn tsc
```

### 2. 单元测试

```yaml
jobs:
  test:
    - 启动 PostgreSQL 服务
    - 运行所有测试
    - 生成覆盖率报告
    - 上传到 Codecov
```

**本地运行**:
```bash
# 启动 PostgreSQL
docker-compose up postgres -d

# 运行测试
yarn test:all
```

### 3. 构建

```yaml
jobs:
  build:
    - 构建所有包
    - 上传构建产物
```

**本地运行**:
```bash
yarn build:all
```

### 4. E2E 测试（仅 main 分支）

```yaml
jobs:
  e2e:
    - 安装 Playwright
    - 运行端到端测试
    - 上传测试结果
```

**本地运行**:
```bash
yarn test:e2e
```

### 5. 安全扫描

```yaml
jobs:
  security:
    - Trivy 漏洞扫描
    - npm audit 检查
    - 上传结果到 GitHub Security
```

**本地运行**:
```bash
# 安装 Trivy
brew install trivy

# 运行扫描
trivy fs .

# npm audit
yarn npm audit --all --recursive
```

### 6. Docker 构建（仅 main 分支）

```yaml
jobs:
  docker:
    - 构建 Docker 镜像
    - 推送到 GitHub Container Registry
    - 使用缓存加速构建
```

**本地运行**:
```bash
docker build -t backstage:local -f packages/backend/Dockerfile .
```

---

## CD 流程

### 部署流程图

```
┌─────────────────┐
│  Push to main   │
│  or create tag  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build & Push    │
│ Docker Image    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deploy to       │
│ Staging         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Run Smoke Tests │
└────────┬────────┘
         │
         ▼ (if tag v*)
┌─────────────────┐
│ Deploy to       │
│ Production      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Post-Deployment │
│ Tests           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Notify          │
│ Stakeholders    │
└─────────────────┘
```

### 1. 构建和推送镜像

```yaml
jobs:
  build-and-push:
    - 构建 Docker 镜像
    - 推送到 ghcr.io
    - 生成 SBOM（软件物料清单）
```

**镜像标签策略**:
- `main` 分支 → `latest`, `main-<sha>`
- `v1.2.3` 标签 → `v1.2.3`, `1.2`, `latest`
- 其他分支 → `<branch>-<sha>`

### 2. 部署到 Staging

```yaml
jobs:
  deploy-staging:
    - 配置 AWS 凭证
    - 更新 kubeconfig
    - 使用 Helm 部署
    - 验证部署
    - 运行冒烟测试
```

**Staging 环境**:
- URL: https://backstage-staging.example.com
- Kubernetes 命名空间: `backstage-staging`
- 自动部署: Push 到 `main` 分支

### 3. 部署到 Production

```yaml
jobs:
  deploy-production:
    - 创建备份
    - 使用 Helm 部署
    - 验证部署
    - 运行冒烟测试
    - 监控 5 分钟
    - 失败时自动回滚
```

**Production 环境**:
- URL: https://backstage.example.com
- Kubernetes 命名空间: `backstage-production`
- 触发条件: 创建 `v*` 标签或手动触发

### 4. 部署后测试

```yaml
jobs:
  post-deployment-tests:
    - 集成测试
    - 性能测试
    - 更新监控仪表板
```

---

## 配置 GitHub Secrets

### 必需的 Secrets

在 GitHub 仓库设置中配置以下 Secrets：

#### AWS 凭证

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

**创建方法**:
1. 在 AWS IAM 中创建用户
2. 附加策略: `AmazonEKSClusterPolicy`, `AmazonEC2ContainerRegistryPowerUser`
3. 创建访问密钥

#### GitHub Token（自动提供）

```
GITHUB_TOKEN  # GitHub Actions 自动提供
```

#### 可选 Secrets

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
CODECOV_TOKEN=...
DATADOG_API_KEY=...
```

### 配置 Secrets

1. 访问 GitHub 仓库: https://github.com/pingxin403/platform-console
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加 Secret 名称和值
5. 点击 **Add secret**

### 必需的 Secrets 列表

以下是需要在 GitHub 仓库中配置的所有 Secrets：

#### AWS 相关
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-west-2
```

#### Kubernetes 相关
```
EKS_CLUSTER_NAME=backstage-cluster
BACKSTAGE_SERVICE_ACCOUNT_ROLE_ARN_STAGING=arn:aws:iam::...
BACKSTAGE_SERVICE_ACCOUNT_ROLE_ARN_PRODUCTION=arn:aws:iam::...
```

#### 证书相关
```
CERTIFICATE_ARN_STAGING=arn:aws:acm::...
CERTIFICATE_ARN_PRODUCTION=arn:aws:acm::...
WAF_ACL_ARN=arn:aws:wafv2::...
```

#### 数据库相关
```
POSTGRES_PASSWORD_STAGING=...
POSTGRES_PASSWORD_PRODUCTION=...
```

#### Backstage 相关
```
BACKEND_SECRET_STAGING=... (至少 24 个字符)
BACKEND_SECRET_PRODUCTION=... (至少 24 个字符)
ORGANIZATION_NAME=Your Organization
```

#### GitHub 集成
```
GITHUB_TOKEN=ghp_...
GITHUB_ORG=your-github-org
AUTH_GITHUB_CLIENT_ID_STAGING=...
AUTH_GITHUB_CLIENT_SECRET_STAGING=...
AUTH_GITHUB_CLIENT_ID_PRODUCTION=...
AUTH_GITHUB_CLIENT_SECRET_PRODUCTION=...
```

#### 可选集成
```
ARGOCD_TOKEN_STAGING=...
ARGOCD_TOKEN_PRODUCTION=...
DATADOG_API_KEY=...
DATADOG_APP_KEY=...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
CODECOV_TOKEN=...
```

---

## 部署环境

### Staging 环境

**用途**: 测试和验证新功能

**配置**:
- Kubernetes 集群: `backstage-cluster-staging`
- 命名空间: `backstage-staging`
- URL: https://backstage-staging.example.com
- 数据库: PostgreSQL RDS (staging)
- 资源限制: 较小（节省成本）

**Helm Values** (`k8s/helm/backstage/values-staging.yaml`):
```yaml
replicaCount: 2

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

ingress:
  enabled: true
  host: backstage-staging.example.com
  tls:
    enabled: true

database:
  host: backstage-staging.rds.amazonaws.com
  name: backstage_staging
```

### Production 环境

**用途**: 生产环境，服务真实用户

**配置**:
- Kubernetes 集群: `backstage-cluster-production`
- 命名空间: `backstage-production`
- URL: https://backstage.example.com
- 数据库: PostgreSQL RDS (production, 多 AZ)
- 资源限制: 较大（保证性能）
- 高可用: 多副本 + 自动扩展

**Helm Values** (`k8s/helm/backstage/values-production.yaml`):
```yaml
replicaCount: 3

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 1000m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  host: backstage.example.com
  tls:
    enabled: true

database:
  host: backstage-production.rds.amazonaws.com
  name: backstage_production
  multiAZ: true

monitoring:
  enabled: true
  datadog:
    enabled: true
```

---

## 手动触发部署

### 使用 GitHub UI

1. 访问 GitHub 仓库
2. 进入 **Actions** 标签
3. 选择 **CD - Deploy to Staging/Production** 工作流
4. 点击 **Run workflow**
5. 选择分支和环境
6. 点击 **Run workflow**

### 使用 GitHub CLI

```bash
# 安装 GitHub CLI
brew install gh

# 登录
gh auth login

# 触发部署到 Staging
gh workflow run cd.yml \
  --ref main \
  -f environment=staging

# 触发部署到 Production
gh workflow run cd.yml \
  --ref main \
  -f environment=production
```

### 使用 Git 标签部署到 Production

```bash
# 创建版本标签
git tag -a v1.0.0 -m "Release v1.0.0"

# 推送标签
git push origin v1.0.0

# 这会自动触发部署到 Production
```

---

## 监控和回滚

### 监控部署

#### 查看 GitHub Actions 日志

1. 访问 **Actions** 标签
2. 选择工作流运行
3. 查看每个 Job 的日志

#### 查看 Kubernetes 状态

```bash
# 配置 kubectl
aws eks update-kubeconfig \
  --region us-west-2 \
  --name backstage-cluster-production

# 查看 Pod 状态
kubectl get pods -n backstage-production

# 查看部署状态
kubectl rollout status deployment/backstage-production \
  -n backstage-production

# 查看日志
kubectl logs -n backstage-production \
  -l app=backstage-production \
  --tail=100 \
  -f
```

#### 查看应用健康状态

```bash
# 检查健康端点
curl https://backstage.example.com/healthcheck

# 检查 Catalog API
curl https://backstage.example.com/api/catalog/health

# 检查认证
curl https://backstage.example.com/api/auth/github
```

### 回滚部署

#### 自动回滚

CD 工作流会在部署失败时自动回滚：

```yaml
- name: Rollback on failure
  if: failure()
  run: |
    helm rollback backstage-production \
      --namespace backstage-production \
      --wait
```

#### 手动回滚

```bash
# 查看 Helm 发布历史
helm history backstage-production -n backstage-production

# 回滚到上一个版本
helm rollback backstage-production -n backstage-production

# 回滚到特定版本
helm rollback backstage-production 5 -n backstage-production

# 验证回滚
kubectl rollout status deployment/backstage-production \
  -n backstage-production
```

#### 使用 Git 回滚

```bash
# 回滚代码
git revert <commit-hash>
git push origin main

# 或者创建新的修复标签
git tag -a v1.0.1 -m "Hotfix: rollback changes"
git push origin v1.0.1
```

---

## 最佳实践

### 1. 分支策略

```
main (生产分支)
  ↓
  ├─ feature/* (功能分支)
  ├─ fix/* (修复分支)
  └─ hotfix/* (热修复分支)
```

**工作流**:
1. 从 `main` 创建功能分支
2. 开发和测试
3. 创建 Pull Request
4. CI 自动运行测试
5. 代码审查
6. 合并到 `main`
7. 自动部署到 Staging
8. 验证后创建标签
9. 自动部署到 Production

### 2. 版本管理

使用语义化版本（Semantic Versioning）：

```
v<major>.<minor>.<patch>

例如:
v1.0.0 - 初始发布
v1.1.0 - 新功能
v1.1.1 - Bug 修复
v2.0.0 - 重大变更
```

**创建版本**:
```bash
# 更新 package.json 版本
yarn version --new-version 1.1.0

# 创建标签
git tag -a v1.1.0 -m "Release v1.1.0: Add search functionality"

# 推送
git push origin main --tags
```

### 3. 环境变量管理

**不同环境使用不同的配置**:

```
.env.example          # 示例配置
.env                  # 本地开发（不提交）
values-staging.yaml   # Staging 配置
values-production.yaml # Production 配置
```

**敏感信息管理**:
- 使用 GitHub Secrets 存储敏感信息
- 使用 AWS Secrets Manager 或 Vault
- 不要在代码中硬编码密钥

### 4. 测试策略

**测试金字塔**:
```
       /\
      /E2E\        少量端到端测试
     /------\
    /Integr.\     中等数量集成测试
   /----------\
  /   Unit     \  大量单元测试
 /--------------\
```

**CI 中的测试**:
- 每次 PR: 单元测试 + Lint
- 合并到 main: 单元测试 + 集成测试
- 部署前: E2E 测试
- 部署后: 冒烟测试

### 5. 部署策略

**蓝绿部署**（推荐）:
- 保持两个相同的生产环境
- 新版本部署到"绿"环境
- 验证后切换流量
- 出问题快速切回"蓝"环境

**金丝雀部署**:
- 先部署到少量实例
- 监控指标
- 逐步增加流量
- 发现问题立即回滚

**滚动更新**（当前使用）:
- Kubernetes 默认策略
- 逐个替换 Pod
- 零停机时间

### 6. 监控和告警

**关键指标**:
- 部署成功率
- 部署时间
- 错误率
- 响应时间
- 资源使用率

**告警设置**:
- 部署失败 → 立即通知
- 错误率上升 → 警告
- 响应时间慢 → 警告
- 资源不足 → 警告

### 7. 文档和沟通

**部署清单**:
- [ ] 代码审查通过
- [ ] 所有测试通过
- [ ] 更新 CHANGELOG
- [ ] 更新文档
- [ ] 通知团队
- [ ] 准备回滚计划

**部署通知**:
- Slack 通知团队
- 更新状态页面
- 记录部署日志

---

## 故障排查

### CI 失败

#### Lint 失败

```bash
# 本地修复
yarn lint:all --fix
yarn prettier --write .

# 提交修复
git add .
git commit -m "fix: lint errors"
git push
```

#### 测试失败

```bash
# 本地运行测试
yarn test:all

# 查看详细错误
yarn test --verbose

# 修复后重新提交
```

#### 构建失败

```bash
# 清理缓存
yarn clean

# 重新安装依赖
rm -rf node_modules yarn.lock
yarn install

# 重新构建
yarn build:all
```

### CD 失败

#### Docker 构建失败

```bash
# 本地测试构建
docker build -t backstage:test -f packages/backend/Dockerfile .

# 检查 Dockerfile
# 检查依赖是否正确
```

#### Helm 部署失败

```bash
# 检查 Helm chart
helm lint k8s/helm/backstage

# 模拟部署
helm install backstage-test ./k8s/helm/backstage \
  --dry-run --debug

# 检查 Kubernetes 资源
kubectl get all -n backstage-production
kubectl describe pod <pod-name> -n backstage-production
```

#### 健康检查失败

```bash
# 检查 Pod 日志
kubectl logs -n backstage-production \
  -l app=backstage-production \
  --tail=100

# 检查事件
kubectl get events -n backstage-production \
  --sort-by='.lastTimestamp'

# 进入 Pod 调试
kubectl exec -it <pod-name> -n backstage-production -- /bin/sh
```

---

## 下一步

- 阅读 [本地开发指南](local-development.md)
- 查看 [部署指南](deployment.md)
- 了解 [Git & GitHub 使用指南](git-github-guide.md)

---

## 参考资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Helm 文档](https://helm.sh/docs/)
- [Kubernetes 文档](https://kubernetes.io/docs/)
- [AWS EKS 文档](https://docs.aws.amazon.com/eks/)
- [Backstage 部署文档](https://backstage.io/docs/deployment/)
