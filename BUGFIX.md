# Bug Fixes - CI/CD and Build Issues

## 修复日期

2026-01-18

## 修复的问题

### 1. 新增 Lint Fix 命令

**问题描述**: 缺少自动修复 lint 和格式化问题的命令。

**解决方案**: 在 `package.json` 中添加了以下命令：

- `yarn lint:fix` - 自动修复 ESLint 问题
- `yarn prettier:fix` - 自动格式化代码

**使用方法**:

```bash
# 修复 lint 问题
yarn lint:fix

# 修复格式化问题
yarn prettier:fix

# 或者一起使用
yarn lint:fix && yarn prettier:fix
```

---

### 2. 修复 Docker 构建失败

**问题描述**:
Docker 构建时 TypeScript 编译失败，错误信息：

```
error TS18003: No inputs were found in config file '/app/tsconfig.json'
```

**根本原因**:
根目录的 `tsconfig.json` 配置了 `include` 路径，但在 Docker 构建阶段，某些 workspace 包可能不存在或未完全复制，导致 TypeScript 找不到任何输入文件。

**解决方案**:
移除 Dockerfile 中的 `yarn tsc` 步骤，因为：

1. `yarn build:backend` 会自己处理 TypeScript 编译
2. 根级别的 tsc 检查需要所有 workspace 包都存在
3. 在生产构建中，我们只需要 backend 包的编译结果

**修改文件**: `packages/backend/Dockerfile`

**修改内容**:

```dockerfile
# 之前
RUN yarn tsc && \
    yarn build:backend --config ../../app-config.yaml && \
    yarn cache clean && \
    find packages/backend/dist -name "*.map" -delete

# 之后
# Note: Skip root-level tsc check as it requires all workspace packages
# The backend build will handle its own TypeScript compilation
RUN yarn build:backend --config ../../app-config.yaml && \
    yarn cache clean && \
    find packages/backend/dist -name "*.map" -delete
```

---

### 3. 修复 GitHub Actions 安全扫描权限问题

**问题描述**:
安全扫描 job 无法上传 SARIF 结果到 GitHub Security，错误信息：

```
Warning: Resource not accessible by integration
Error: Resource not accessible by integration
```

同时收到 CodeQL Action v3 即将弃用的警告。

**根本原因**:

1. GitHub Actions 工作流缺少 `security-events: write` 权限
2. 使用了即将弃用的 CodeQL Action v3

**解决方案**:

#### 3.1 添加工作流级别权限

在 `.github/workflows/ci.yml` 顶部添加：

```yaml
permissions:
  contents: read
  security-events: write
  actions: read
```

#### 3.2 为 security job 添加显式权限

```yaml
security:
  name: Security Scan
  runs-on: ubuntu-latest
  permissions:
    contents: read
    security-events: write
```

#### 3.3 升级 CodeQL Action 到 v4

```yaml
# 之前
- name: Upload Trivy results to GitHub Security
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'

# 之后
- name: Upload Trivy results to GitHub Security
  uses: github/codeql-action/upload-sarif@v4
  if: always()
  with:
    sarif_file: 'trivy-results.sarif'
```

#### 3.4 添加 `if: always()` 条件

确保即使前面的步骤失败，也会尝试上传安全扫描结果。

---

## 验证步骤

### 验证 Lint Fix 命令

```bash
# 测试 lint fix
yarn lint:fix

# 测试 prettier fix
yarn prettier:fix
```

### 验证 Docker 构建

```bash
# 本地构建测试
docker build -f packages/backend/Dockerfile -t backstage:test .

# 或使用 docker-compose
docker-compose -f docker-compose.simple.yml build
```

### 验证 CI/CD 工作流

1. 提交这些更改到 GitHub
2. 查看 Actions 标签页
3. 确认所有 jobs 都成功运行
4. 检查 Security 标签页是否收到 Trivy 扫描结果

---

## 相关文件

- `package.json` - 添加 lint fix 命令
- `packages/backend/Dockerfile` - 修复构建流程
- `.github/workflows/ci.yml` - 修复权限和升级 CodeQL Action

---

## 后续建议

1. **定期运行 lint fix**: 在提交前运行 `yarn lint:fix && yarn prettier:fix`
2. **配置 pre-commit hook**: 考虑使用 husky 和 lint-staged 自动化代码质量检查
3. **监控安全扫描结果**: 定期查看 GitHub Security 标签页的漏洞报告
4. **保持依赖更新**: 定期运行 `yarn upgrade-interactive` 更新依赖

---

## 参考链接

- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)
- [CodeQL Action v4 Migration](https://github.blog/changelog/2025-10-28-upcoming-deprecation-of-codeql-action-v3/)
- [Backstage CLI Documentation](https://backstage.io/docs/local-dev/cli-commands)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy)
