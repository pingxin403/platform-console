# Local Kubernetes Testing Guide

本指南帮助你在本地 Kubernetes 集群中部署和测试 Backstage MVP 版本。

## 前提条件

### 1. 安装本地 Kubernetes 集群

选择以下任一方案：

#### 方案 A: Minikube（推荐）
```bash
# macOS
brew install minikube

# 启动 Minikube
minikube start --cpus=4 --memory=8192 --driver=docker

# 启用 Ingress
minikube addons enable ingress

# 启用 Metrics Server
minikube addons enable metrics-server
```

#### 方案 B: Kind (Kubernetes in Docker)
```bash
# macOS
brew install kind

# 创建集群
cat <<EOF | kind create cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF

# 安装 Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
```

#### 方案 C: Docker Desktop Kubernetes
```bash
# 在 Docker Desktop 设置中启用 Kubernetes
# Settings -> Kubernetes -> Enable Kubernetes
```

### 2. 安装 Helm
```bash
# macOS
brew install helm

# 验证安装
helm version
```

### 3. 安装 kubectl
```bash
# macOS
brew install kubectl

# 验证安装
kubectl version --client
```

---

## 快速开始

### 步骤 1: 准备环境变量

创建本地测试用的环境变量文件：

```bash
# 复制示例文件
cp .env.example .env.local

# 编辑 .env.local，设置最小必需的变量
cat > .env.local <<EOF
# 最小配置用于本地测试
BACKEND_SECRET=local-test-secret-minimum-24-characters-long
POSTGRES_HOST=backstage-postgresql
POSTGRES_PORT=5432
POSTGRES_USER=backstage
POSTGRES_PASSWORD=backstage123
POSTGRES_DB=backstage
POSTGRES_SSL=false
GITHUB_TOKEN=your-github-token-here
GITHUB_ORG=your-org
EOF
```

### 步骤 2: 构建 Docker 镜像

```bash
# 构建 backend 镜像
docker build -f packages/backend/Dockerfile -t backstage:local .

# 如果使用 Minikube，加载镜像到 Minikube
minikube image load backstage:local

# 如果使用 Kind，加载镜像到 Kind
kind load docker-image backstage:local
```

### 步骤 3: 创建 Kubernetes 命名空间

```bash
# 创建命名空间
kubectl create namespace backstage

# 设置为默认命名空间（可选）
kubectl config set-context --current --namespace=backstage
```

### 步骤 4: 创建 Secrets

```bash
# 从 .env.local 创建 Secret
kubectl create secret generic backstage-secrets \
  --from-literal=backend-secret="local-test-secret-minimum-24-characters-long" \
  --from-literal=github-token="your-github-token-here" \
  --from-literal=github-client-id="" \
  --from-literal=github-client-secret="" \
  --from-literal=argocd-token="" \
  --from-literal=datadog-api-key="" \
  --from-literal=datadog-app-key="" \
  -n backstage

# 创建 PostgreSQL Secret
kubectl create secret generic backstage-postgres \
  --from-literal=password="backstage123" \
  -n backstage
```

### 步骤 5: 创建简化的 Helm Values

创建 `k8s/helm/backstage/values-local.yaml`：

```yaml
# 本地测试用的简化配置
replicaCount: 1

image:
  repository: backstage
  pullPolicy: IfNotPresent
  tag: 'local'

serviceAccount:
  create: true
  annotations: {}

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: false
  capabilities:
    drop:
      - ALL

service:
  type: NodePort
  port: 7007
  nodePort: 30007

ingress:
  enabled: false  # 本地测试不需要 Ingress

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: false

podDisruptionBudget:
  enabled: false

networkPolicy:
  enabled: false

nodeSelector: {}
tolerations: []
affinity: {}

# PostgreSQL 配置
postgresql:
  enabled: true
  auth:
    postgresPassword: backstage123
    username: backstage
    password: backstage123
    database: backstage
  primary:
    persistence:
      enabled: true
      size: 1Gi
    resources:
      limits:
        cpu: 500m
        memory: 512Mi
      requests:
        cpu: 250m
        memory: 256Mi
    securityContext:
      enabled: true
      runAsNonRoot: true
      runAsUser: 999
      fsGroup: 999

# 环境变量
env:
  - name: NODE_ENV
    value: development
  - name: LOG_LEVEL
    value: debug
  - name: POSTGRES_HOST
    value: backstage-postgresql
  - name: POSTGRES_PORT
    value: '5432'
  - name: POSTGRES_USER
    value: backstage
  - name: POSTGRES_PASSWORD
    valueFrom:
      secretKeyRef:
        name: backstage-postgres
        key: password
  - name: POSTGRES_DB
    value: backstage
  - name: POSTGRES_SSL
    value: 'false'
  - name: BACKEND_SECRET
    valueFrom:
      secretKeyRef:
        name: backstage-secrets
        key: backend-secret
  - name: GITHUB_TOKEN
    valueFrom:
      secretKeyRef:
        name: backstage-secrets
        key: github-token

monitoring:
  serviceMonitor:
    enabled: false
  grafanaDashboard:
    enabled: false

backup:
  enabled: false
```

### 步骤 6: 部署到 Kubernetes

```bash
# 使用 Helm 部署
helm install backstage ./k8s/helm/backstage \
  -f k8s/helm/backstage/values-local.yaml \
  -n backstage

# 查看部署状态
kubectl get pods -n backstage -w

# 查看日志
kubectl logs -f deployment/backstage -n backstage
```

### 步骤 7: 访问 Backstage

#### 方案 A: 使用 NodePort（推荐用于本地测试）
```bash
# 获取 NodePort
kubectl get svc backstage -n backstage

# 如果使用 Minikube
minikube service backstage -n backstage

# 如果使用 Kind 或 Docker Desktop
# 访问 http://localhost:30007
```

#### 方案 B: 使用 Port Forward
```bash
# 端口转发
kubectl port-forward svc/backstage 7007:7007 -n backstage

# 访问 http://localhost:7007
```

---

## 验证清单

### 1. 基础功能验证

- [ ] **应用启动**: Backstage 前端和后端都正常启动
- [ ] **数据库连接**: PostgreSQL 连接成功
- [ ] **认证**: Guest 认证可以登录
- [ ] **目录**: 可以查看 Catalog 中的组件

### 2. 核心插件验证

#### Catalog 插件
```bash
# 检查 catalog 是否正常
curl http://localhost:7007/api/catalog/entities | jq
```

- [ ] 可以查看组件列表
- [ ] 可以查看组件详情
- [ ] 可以搜索组件

#### TechDocs 插件
- [ ] 可以查看文档
- [ ] 文档渲染正常

#### Scaffolder 插件
- [ ] 可以查看模板列表
- [ ] 可以创建新项目（如果配置了 GitHub token）

### 3. 集成验证

#### GitHub 集成
```bash
# 测试 GitHub API 连接
kubectl exec -it deployment/backstage -n backstage -- \
  curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user
```

- [ ] GitHub token 有效
- [ ] 可以访问 GitHub API

#### 数据库验证
```bash
# 连接到 PostgreSQL
kubectl exec -it backstage-postgresql-0 -n backstage -- \
  psql -U backstage -d backstage

# 查看表
\dt

# 查看 catalog 数据
SELECT * FROM entities LIMIT 5;
```

- [ ] 数据库表已创建
- [ ] Catalog 数据已导入

---

## 常见问题排查

### 问题 1: Docker 构建失败 - "Could not resolve entry module src/index.ts"

**错误信息**:
```
Error: RollupError: Could not resolve entry module "src/index.ts".
```

**原因**: `.dockerignore` 文件排除了 `packages/*/src`，导致 backend 源代码没有被复制到 Docker 镜像中。

**解决方案**: 已修复。确保 `.dockerignore` 文件内容如下：
```
.git
.yarn/cache
.yarn/install-state.gz
node_modules
packages/*/node_modules
plugins
*.local.yaml
# Exclude app src but keep backend src for building
packages/app/src
```

### 问题 2: Pod 无法启动

```bash
# 查看 Pod 状态
kubectl describe pod -l app.kubernetes.io/name=backstage -n backstage

# 查看事件
kubectl get events -n backstage --sort-by='.lastTimestamp'

# 查看日志
kubectl logs -l app.kubernetes.io/name=backstage -n backstage --tail=100
```

**常见原因**:
- 镜像拉取失败：确保镜像已加载到本地集群
- 资源不足：增加 Minikube 的 CPU 和内存
- Secret 缺失：检查 Secret 是否正确创建

### 问题 2: 数据库连接失败

```bash
# 检查 PostgreSQL Pod
kubectl get pods -l app.kubernetes.io/name=postgresql -n backstage

# 查看 PostgreSQL 日志
kubectl logs -l app.kubernetes.io/name=postgresql -n backstage

# 测试数据库连接
kubectl run -it --rm debug --image=postgres:15 --restart=Never -n backstage -- \
  psql -h backstage-postgresql -U backstage -d backstage
```

**常见原因**:
- PostgreSQL 未就绪：等待 Pod 变为 Ready
- 密码错误：检查 Secret 中的密码
- 网络策略：如果启用了 NetworkPolicy，确保允许连接

### 问题 3: 无法访问服务

```bash
# 检查 Service
kubectl get svc backstage -n backstage

# 检查 Endpoints
kubectl get endpoints backstage -n backstage

# 测试服务连接
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n backstage -- \
  curl http://backstage:7007/api/catalog/health
```

**常见原因**:
- Service 配置错误：检查 Service 的 selector
- Pod 未就绪：等待 Pod 健康检查通过
- 端口映射错误：检查 NodePort 或 Port Forward 配置

### 问题 4: GitHub Token 无效

```bash
# 测试 GitHub token
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# 检查 token 权限
# Token 需要以下权限：
# - repo (完整权限)
# - workflow
# - read:org
# - read:user
# - user:email
```

---

## 性能优化建议

### 1. 增加资源限制

如果遇到性能问题，可以增加资源：

```yaml
# values-local.yaml
resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 1000m
    memory: 1Gi
```

### 2. 使用本地镜像缓存

```bash
# Minikube 使用本地 Docker daemon
eval $(minikube docker-env)

# 重新构建镜像
docker build -f packages/backend/Dockerfile -t backstage:local .
```

### 3. 启用持久化存储

```yaml
# values-local.yaml
postgresql:
  primary:
    persistence:
      enabled: true
      size: 5Gi
      storageClass: standard  # Minikube 默认 StorageClass
```

---

## 清理环境

### 完全清理

```bash
# 卸载 Helm release
helm uninstall backstage -n backstage

# 删除命名空间（会删除所有资源）
kubectl delete namespace backstage

# 删除 PVC（如果需要）
kubectl delete pvc --all -n backstage

# 停止 Minikube
minikube stop

# 删除 Minikube 集群
minikube delete
```

### 保留数据的清理

```bash
# 只卸载应用，保留 PVC
helm uninstall backstage -n backstage

# 重新部署时会使用现有的 PVC
helm install backstage ./k8s/helm/backstage \
  -f k8s/helm/backstage/values-local.yaml \
  -n backstage
```

---

## 下一步

完成本地测试后，你可以：

1. **调整配置**: 根据测试结果调整 `values-local.yaml`
2. **添加插件**: 测试新的 Backstage 插件
3. **集成外部服务**: 配置 Argo CD、Datadog 等集成
4. **准备生产部署**: 使用 `values-production.yaml` 部署到生产环境

---

## 参考资料

- [Backstage 官方文档](https://backstage.io/docs)
- [Kubernetes 官方文档](https://kubernetes.io/docs)
- [Helm 官方文档](https://helm.sh/docs)
- [Minikube 文档](https://minikube.sigs.k8s.io/docs)
- [Kind 文档](https://kind.sigs.k8s.io)
