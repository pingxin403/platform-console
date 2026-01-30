# 本地 Kubernetes 快速启动指南

快速在本地 Kubernetes 集群中部署和测试 Backstage MVP。

## 🚀 一键部署

### 前提条件

1. **安装 Minikube**（推荐）
   ```bash
   brew install minikube
   minikube start --cpus=4 --memory=8192
   minikube addons enable ingress
   ```

2. **准备环境变量**
   ```bash
   cp .env.example .env.local
   # 编辑 .env.local，至少设置：
   # - BACKEND_SECRET (最少24字符)
   # - GITHUB_TOKEN (可选，用于 GitHub 集成)
   ```

### 自动部署

```bash
# 一键部署到本地 Kubernetes
./scripts/local-k8s-deploy.sh
```

脚本会自动：
- ✅ 构建 Docker 镜像
- ✅ 加载镜像到集群
- ✅ 创建命名空间和 Secrets
- ✅ 使用 Helm 部署 Backstage
- ✅ 等待 Pod 就绪

### 访问 Backstage

部署完成后：

```bash
# 方案 1: 使用 Minikube service（推荐）
minikube service backstage -n backstage

# 方案 2: 使用 Port Forward
kubectl port-forward svc/backstage 7007:7007 -n backstage
# 然后访问 http://localhost:7007
```

## 📋 验证清单

### 基础功能
- [ ] 前端可以访问
- [ ] 可以使用 Guest 登录
- [ ] Catalog 页面正常显示
- [ ] 可以搜索组件

### 数据库
```bash
# 检查 PostgreSQL
kubectl get pods -l app.kubernetes.io/name=postgresql -n backstage

# 连接数据库
kubectl exec -it backstage-postgresql-0 -n backstage -- \
  psql -U backstage -d backstage -c "SELECT COUNT(*) FROM entities;"
```

### 日志查看
```bash
# 查看 Backstage 日志
kubectl logs -f deployment/backstage -n backstage

# 查看所有 Pod
kubectl get pods -n backstage
```

## 🔧 常见问题

### Pod 无法启动

```bash
# 查看 Pod 状态
kubectl describe pod -l app.kubernetes.io/name=backstage -n backstage

# 查看事件
kubectl get events -n backstage --sort-by='.lastTimestamp'
```

**解决方案**：
- 确保 Minikube 有足够资源（4 CPU, 8GB RAM）
- 检查镜像是否正确加载：`minikube image ls | grep backstage`
- 查看 Secret 是否创建：`kubectl get secrets -n backstage`

### 数据库连接失败

```bash
# 检查 PostgreSQL 状态
kubectl get pods -l app.kubernetes.io/name=postgresql -n backstage

# 查看 PostgreSQL 日志
kubectl logs -l app.kubernetes.io/name=postgresql -n backstage
```

**解决方案**：
- 等待 PostgreSQL Pod 变为 Ready
- 检查密码是否正确：`kubectl get secret backstage-postgres -n backstage -o yaml`

### 无法访问服务

```bash
# 检查 Service
kubectl get svc backstage -n backstage

# 测试服务连接
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n backstage -- \
  curl http://backstage:7007/api/catalog/health
```

## 🧹 清理环境

### 完全清理
```bash
# 卸载 Backstage
helm uninstall backstage -n backstage

# 删除命名空间
kubectl delete namespace backstage

# 停止 Minikube
minikube stop
```

### 保留数据重新部署
```bash
# 只卸载应用
helm uninstall backstage -n backstage

# 重新部署（会使用现有 PVC）
./scripts/local-k8s-deploy.sh
```

## 📚 详细文档

完整的测试指南和故障排查，请查看：
- [本地 Kubernetes 测试指南](docs/local-kubernetes-testing.md)
- [本地开发指南](docs/local-development.md)
- [部署指南](docs/deployment.md)

## 🎯 下一步

测试完成后，你可以：

1. **调整配置**：修改 `k8s/helm/backstage/values-local.yaml`
2. **添加集成**：配置 GitHub、Argo CD、Datadog 等
3. **测试模板**：使用 Scaffolder 创建新项目
4. **准备生产**：使用 `values-production.yaml` 部署到生产环境

## 💡 有用的命令

```bash
# 查看所有资源
kubectl get all -n backstage

# 查看 Helm release
helm list -n backstage

# 查看 Helm values
helm get values backstage -n backstage

# 升级部署
helm upgrade backstage ./k8s/helm/backstage \
  -f k8s/helm/backstage/values-local.yaml \
  -n backstage

# 查看 Pod 资源使用
kubectl top pods -n backstage
```

## 🆘 获取帮助

如果遇到问题：
1. 查看 [故障排查指南](docs/local-kubernetes-testing.md#常见问题排查)
2. 检查 Pod 日志：`kubectl logs -f deployment/backstage -n backstage`
3. 查看事件：`kubectl get events -n backstage`
4. 在项目中创建 Issue
