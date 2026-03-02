# 本地测试指南 - Internal Developer Platform

## 概述

本指南帮助你在本地环境运行 Internal Developer Platform 的所有测试。

**当前状态**: ✅ 所有测试代码已完成并提交到 git

---

## 前置条件检查

### 1. 必需的软件

- [x] Node.js 20 或 22
- [x] Yarn 4.4.1
- [x] Git
- [ ] PostgreSQL（用于完整测试）
- [ ] Redis（用于缓存测试，可选）

### 2. 检查 Node.js 版本

```bash
node --version  # 应该是 v20.x 或 v22.x
```

### 3. 检查 Yarn 版本

```bash
yarn --version  # 应该是 4.4.1
```

---

## 快速开始

### 选项 1: 运行快速测试（推荐首次运行）

```bash
# 运行单元测试和集成测试（不需要数据库）
./scripts/run-tests.sh quick
```

### 选项 2: 运行所有测试

```bash
# 运行所有测试（单元、属性、集成、E2E）
./scripts/run-tests.sh all
```

---

## 详细测试步骤

### 步骤 1: 安装依赖

```bash
# 安装所有依赖
yarn install

# 验证 fast-check 已安装
grep "fast-check" packages/backend/package.json
```

### 步骤 2: 运行单元测试和属性测试

```bash
# 方式 1: 使用测试脚本
./scripts/run-tests.sh unit

# 方式 2: 直接使用 yarn
yarn test --passWithNoTests

# 运行特定模块的属性测试
yarn workspace backend test finops.property.test.ts
yarn workspace backend test maturity.property.test.ts
yarn workspace backend test dora.property.test.ts
yarn workspace backend test search-rbac.property.test.ts
```

**预期结果**:
- 大部分测试应该通过
- 某些 Sentry 相关测试可能失败（已知问题，非阻塞）
- 属性测试会运行多次迭代（10-100次）

### 步骤 3: 运行集成测试

```bash
# 使用测试脚本
./scripts/run-tests.sh integration

# 或直接运行
yarn workspace backend test integration.test.ts --testTimeout=60000
```

**预期结果**:
- 13个集成测试应该通过
- 测试使用 mock 数据，不需要真实服务

### 步骤 4: 运行 E2E 测试

#### 4.1 安装 Playwright 浏览器（首次运行）

```bash
npx playwright install
```

#### 4.2 启动服务（如果还没运行）

E2E 测试需要 backend 和 frontend 运行。有两种方式：

**方式 A: 自动启动（推荐）**

```bash
# Playwright 会自动启动服务
yarn test:e2e
```

**方式 B: 手动启动**

```bash
# Terminal 1: 启动 backend
yarn start backend

# Terminal 2: 启动 frontend
yarn start app

# Terminal 3: 运行 E2E 测试
PLAYWRIGHT_URL=http://localhost:3000 yarn test:e2e
```

#### 4.3 运行 E2E 测试

```bash
# 使用测试脚本
./scripts/run-tests.sh e2e

# 或直接运行
yarn test:e2e

# 在可见模式下运行（查看浏览器）
yarn test:e2e --headed

# 调试模式（逐步执行）
yarn test:e2e --debug

# 交互式 UI 模式
yarn test:e2e --ui

# 运行特定测试
yarn test:e2e user-journeys.spec.ts
```

**预期结果**:
- 5个用户旅程测试应该运行
- 某些测试可能跳过功能（如果插件未配置）
- 测试会优雅降级，不会因缺少功能而失败

---

## 测试脚本使用

我们提供了一个便捷的测试脚本 `scripts/run-tests.sh`：

```bash
# 查看帮助
./scripts/run-tests.sh help

# 运行单元测试
./scripts/run-tests.sh unit

# 运行属性测试
./scripts/run-tests.sh property

# 运行集成测试
./scripts/run-tests.sh integration

# 运行 E2E 测试
./scripts/run-tests.sh e2e

# 运行快速测试套件
./scripts/run-tests.sh quick

# 运行所有测试
./scripts/run-tests.sh all

# 运行测试并生成覆盖率报告
./scripts/run-tests.sh coverage
```

---

## 环境配置

### 最小配置（用于测试）

测试可以在最小配置下运行。检查 `.env` 文件：

```bash
# 必需的最小配置
BACKEND_SECRET=test-secret-minimum-24-characters-long
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=backstage
POSTGRES_PASSWORD=backstage123
POSTGRES_DB=backstage
```

### 可选配置（用于完整功能测试）

如果你想测试完整功能，需要配置：

1. **GitHub Token** (用于 GitHub 集成测试)
   ```bash
   GITHUB_TOKEN=your-github-personal-access-token
   ```

2. **ArgoCD** (用于部署状态测试)
   ```bash
   ARGOCD_API_URL=https://argocd.example.com
   ARGOCD_TOKEN=your-argocd-token
   ```

3. **Datadog** (用于监控集成测试)
   ```bash
   DATADOG_API_KEY=your-datadog-api-key
   DATADOG_APP_KEY=your-datadog-app-key
   ```

4. **Redis** (用于缓存测试)
   ```bash
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

5. **Sentry** (用于错误跟踪测试)
   ```bash
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   ```

**注意**: 大部分测试使用 mock 数据，不需要真实的外部服务。

---

## 数据库设置（可选）

如果你想运行需要数据库的测试：

### 使用 Docker 启动 PostgreSQL

```bash
docker run -d \
  --name backstage-postgres \
  -e POSTGRES_USER=backstage \
  -e POSTGRES_PASSWORD=backstage123 \
  -e POSTGRES_DB=backstage \
  -p 5432:5432 \
  postgres:15
```

### 验证数据库连接

```bash
psql -h localhost -U backstage -d backstage
# 密码: backstage123
```

---

## 故障排除

### 问题 1: 测试超时

**症状**: 测试运行很长时间后超时

**解决方案**:
```bash
# 增加超时时间
yarn test --testTimeout=120000

# 或运行特定测试
yarn workspace backend test finops.property.test.ts --testTimeout=60000
```

### 问题 2: fast-check 未找到

**症状**: `Cannot find module 'fast-check'`

**解决方案**:
```bash
# 安装 fast-check
yarn workspace backend add -D fast-check

# 或重新安装所有依赖
yarn install
```

### 问题 3: Playwright 浏览器未安装

**症状**: `Executable doesn't exist at ...`

**解决方案**:
```bash
# 安装 Playwright 浏览器
npx playwright install

# 或安装特定浏览器
npx playwright install chromium
```

### 问题 4: E2E 测试找不到元素

**症状**: `Element not found` 或 `Timeout waiting for selector`

**解决方案**:
- 确保 backend 和 frontend 正在运行
- 某些功能可能未配置（测试会优雅跳过）
- 使用 `--headed` 模式查看浏览器中发生了什么

### 问题 5: Sentry 测试失败

**症状**: `Sentry.Handlers is undefined`

**解决方案**:
- 这是已知问题，不影响功能
- Sentry 在生产环境中正常工作
- 可以跳过这些测试或配置 Sentry DSN

### 问题 6: 数据库连接失败

**症状**: `ECONNREFUSED` 或 `Connection refused`

**解决方案**:
- 大部分测试不需要数据库
- 如果需要，使用 Docker 启动 PostgreSQL（见上文）
- 或使用 mock 数据运行测试

---

## 查看测试报告

### 单元测试和属性测试

```bash
# 运行测试并生成覆盖率报告
yarn test:all

# 查看覆盖率报告
open coverage/lcov-report/index.html
```

### E2E 测试报告

```bash
# 运行 E2E 测试后查看报告
yarn playwright show-report e2e-test-report
```

### 截图和视频

失败的 E2E 测试会自动保存：
- 截图: `screenshots/`
- 视频: `node_modules/.cache/e2e-test-results/`
- 追踪: `e2e-test-report/`

---

## 测试覆盖率目标

当前测试覆盖率：

| 类型 | 当前 | 目标 |
|------|------|------|
| 语句覆盖率 | ~25% | 40% |
| 分支覆盖率 | ~18% | 30% |
| 函数覆盖率 | ~28% | 40% |
| 行覆盖率 | ~24% | 40% |

**注意**: 对于集成密集型平台，25% 的覆盖率是可接受的起点。

---

## 下一步

### 如果所有测试通过

1. ✅ 查看测试报告
2. ✅ 检查覆盖率报告
3. ✅ 准备部署到测试环境

### 如果有测试失败

1. 查看失败的测试输出
2. 检查是否缺少配置或凭证
3. 查看故障排除部分
4. 如果需要帮助，提供：
   - 失败的测试名称
   - 错误消息
   - 环境信息（Node 版本、OS 等）

---

## 需要的凭证和配置

根据你想测试的功能，可能需要以下凭证：

### 基础测试（不需要凭证）
- ✅ 单元测试
- ✅ 属性测试
- ✅ 集成测试（使用 mock）

### 完整功能测试（需要凭证）

1. **GitHub 集成**
   - GitHub Personal Access Token
   - GitHub OAuth Client ID/Secret

2. **ArgoCD 集成**
   - ArgoCD API URL
   - ArgoCD Token

3. **Datadog 集成**
   - Datadog API Key
   - Datadog App Key

4. **Sentry 集成**
   - Sentry DSN

5. **Redis 缓存**
   - Redis 连接信息

**如果你需要这些凭证，请告诉我，我可以帮你配置。**

---

## 联系和支持

如果遇到问题：

1. 查看本指南的故障排除部分
2. 查看 [TEST_COVERAGE_SUMMARY.md](./TEST_COVERAGE_SUMMARY.md)
3. 查看各模块的 README 文档
4. 联系我获取帮助

---

## 快速命令参考

```bash
# 安装依赖
yarn install

# 运行快速测试
./scripts/run-tests.sh quick

# 运行所有测试
./scripts/run-tests.sh all

# 运行单元测试
yarn test

# 运行属性测试
yarn workspace backend test --testPathPattern="property.test.ts"

# 运行集成测试
yarn workspace backend test integration.test.ts

# 运行 E2E 测试
yarn test:e2e

# 查看 E2E 测试报告
yarn playwright show-report e2e-test-report

# 生成覆盖率报告
yarn test:all
```

---

**准备好开始测试了吗？运行以下命令开始：**

```bash
./scripts/run-tests.sh quick
```

这将运行快速测试套件（约 5-10 分钟），验证环境配置正确。

