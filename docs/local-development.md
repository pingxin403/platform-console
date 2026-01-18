# 本地开发指南

本指南将帮助你在本地环境中运行和验证 Internal Developer Platform (IDP)。

## 目录

1. [前置要求](#前置要求)
2. [快速开始](#快速开始)
3. [环境配置](#环境配置)
4. [启动应用](#启动应用)
5. [验证功能](#验证功能)
6. [常见问题](#常见问题)
7. [开发工作流](#开发工作流)

---

## 前置要求

### 必需软件

- **Node.js**: 22 或 24 (推荐使用 nvm 管理版本)
- **Yarn**: 4.4.1 (项目使用 Yarn Berry)
- **Docker**: 最新版本 (用于运行 PostgreSQL)
- **Docker Compose**: 最新版本
- **Git**: 最新版本

### 可选软件

- **PostgreSQL**: 15+ (如果不使用 Docker)
- **VS Code**: 推荐的 IDE
- **Postman/Insomnia**: API 测试工具

### 检查环境

```bash
# 检查 Node.js 版本
node --version  # 应该是 v22.x 或 v24.x

# 检查 Yarn 版本
yarn --version  # 应该是 4.4.1

# 检查 Docker
docker --version
docker-compose --version

# 检查 Git
git --version
```

---

## 快速开始

### 方法 1: 使用 Docker Compose（推荐）

这是最简单的方式，会自动启动 PostgreSQL 和 Backstage。

```bash
# 1. 克隆仓库（如果还没有）
git clone git@github-163:pingxin403/platform-console.git
cd platform-console

# 2. 安装依赖
yarn install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，至少配置以下变量：
# - GITHUB_TOKEN
# - AUTH_GITHUB_CLIENT_ID
# - AUTH_GITHUB_CLIENT_SECRET

# 4. 使用 Docker Compose 启动
docker-compose up --build

# 5. 访问应用
# 打开浏览器访问: http://localhost:7007
```

### 方法 2: 本地开发模式

如果你想在本地开发和调试，使用这种方式。

```bash
# 1. 启动 PostgreSQL（使用 Docker）
docker-compose up postgres -d

# 2. 安装依赖
yarn install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 4. 启动开发服务器
yarn start

# 应用会在以下地址启动：
# - Frontend: http://localhost:3000
# - Backend: http://localhost:7007
```

---

## 环境配置

### 1. 创建 .env 文件

```bash
cp .env.example .env
```

### 2. 配置必需的环境变量

编辑 `.env` 文件，配置以下变量：

#### 基础配置

```bash
# Backend 密钥（至少 24 个字符）
BACKEND_SECRET=your-backend-secret-here-minimum-24-characters

# 数据库配置
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=backstage
POSTGRES_PASSWORD=backstage123
POSTGRES_DB=backstage
POSTGRES_SSL=false
```

#### GitHub 集成（必需）

```bash
# GitHub Personal Access Token
# 创建方法: https://github.com/settings/tokens
# 需要的权限: repo, read:org, read:user
GITHUB_TOKEN=ghp_your_github_personal_access_token

# GitHub 组织名称
GITHUB_ORG=your-github-organization-name

# GitHub OAuth 应用
# 创建方法: https://github.com/settings/developers
AUTH_GITHUB_CLIENT_ID=your-github-oauth-client-id
AUTH_GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
```

#### 可选集成

```bash
# Argo CD
ARGOCD_API_URL=https://argocd.example.com
ARGOCD_TOKEN=your-argocd-token

# Datadog
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-application-key

# Sentry
SENTRY_ORG=your-sentry-organization
SENTRY_TOKEN=your-sentry-token

# OpenCost
OPENCOST_URL=http://opencost-svc.opencost:9003

# 日志级别
LOG_LEVEL=info
```

### 3. 创建 GitHub OAuth 应用

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - **Application name**: Internal Developer Platform (Local)
   - **Homepage URL**: http://localhost:3000
   - **Authorization callback URL**: http://localhost:7007/api/auth/github/handler/frame
4. 创建后，复制 Client ID 和 Client Secret 到 `.env` 文件

### 4. 创建 GitHub Personal Access Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 选择以下权限：
   - `repo` (完整权限)
   - `read:org`
   - `read:user`
   - `user:email`
4. 生成后，复制 token 到 `.env` 文件的 `GITHUB_TOKEN`

---

## 启动应用

### 使用 Docker Compose

```bash
# 启动所有服务（PostgreSQL + Backstage）
docker-compose up --build

# 后台运行
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 停止并删除数据
docker-compose down -v
```

### 使用本地开发模式

```bash
# 1. 启动 PostgreSQL
docker-compose up postgres -d

# 2. 启动 Backstage 开发服务器
yarn start

# 或者分别启动前端和后端
yarn workspace app start        # 前端: http://localhost:3000
yarn workspace backend start    # 后端: http://localhost:7007
```

### 构建生产版本

```bash
# 构建所有包
yarn build:all

# 只构建后端
yarn build:backend

# 构建 Docker 镜像
yarn build-image
```

---

## 验证功能

### 1. 访问应用

打开浏览器访问:
- **开发模式**: http://localhost:3000
- **Docker Compose**: http://localhost:7007

### 2. 登录

使用 GitHub OAuth 登录。

### 3. 验证核心功能

#### Service Catalog（服务目录）

1. 访问 "Catalog" 页面
2. 应该能看到已注册的服务
3. 点击一个服务，查看详细信息

#### Golden Path Templates（项目模板）

1. 访问 "Create" 页面
2. 应该能看到 Java、Go、React、React Native 模板
3. 尝试创建一个测试项目

#### TechDocs（文档）

1. 访问一个服务的 "Docs" 标签
2. 应该能看到自动生成的文档

#### Search（搜索）

1. 使用顶部搜索栏
2. 搜索服务、文档或 API

### 4. 运行测试

```bash
# 运行所有测试
yarn test

# 运行测试并生成覆盖率报告
yarn test:all

# 运行端到端测试
yarn test:e2e

# 运行 lint 检查
yarn lint:all

# 自动修复 lint 问题
yarn fix
```

### 5. 检查健康状态

```bash
# 检查后端健康状态
curl http://localhost:7007/healthcheck

# 检查数据库连接
curl http://localhost:7007/api/catalog/health

# 查看 Prometheus 指标
curl http://localhost:7007/metrics
```

---

## 常见问题

### 1. 端口已被占用

**问题**: `Error: listen EADDRINUSE: address already in use :::7007`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :7007

# 杀死进程
kill -9 <PID>

# 或者修改端口
# 编辑 app-config.yaml 中的 backend.listen.port
```

### 2. 数据库连接失败

**问题**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**解决方案**:
```bash
# 检查 PostgreSQL 是否运行
docker-compose ps

# 重启 PostgreSQL
docker-compose restart postgres

# 查看 PostgreSQL 日志
docker-compose logs postgres
```

### 3. GitHub Token 权限不足

**问题**: `Error: Resource not accessible by integration`

**解决方案**:
- 确保 GitHub Token 有正确的权限（repo, read:org, read:user）
- 重新生成 token 并更新 `.env` 文件
- 重启应用

### 4. Yarn 安装失败

**问题**: `Error: Cannot find module`

**解决方案**:
```bash
# 清理缓存
yarn cache clean

# 删除 node_modules 和 lock 文件
rm -rf node_modules yarn.lock

# 重新安装
yarn install
```

### 5. Docker 构建失败

**问题**: `ERROR [internal] load metadata for docker.io/library/node:18`

**解决方案**:
```bash
# 清理 Docker 缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache
```

### 6. 前端无法连接后端

**问题**: 前端显示 "Failed to fetch"

**解决方案**:
- 检查 `app-config.yaml` 中的 `backend.baseUrl` 是否正确
- 确保后端正在运行: `curl http://localhost:7007/healthcheck`
- 检查 CORS 配置

---

## 开发工作流

### 1. 日常开发流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装新依赖（如果有）
yarn install

# 3. 启动开发服务器
yarn start

# 4. 进行开发
# ... 编辑代码 ...

# 5. 运行测试
yarn test

# 6. 运行 lint
yarn lint

# 7. 提交代码
git add .
git commit -m "feat: your feature description"
git push origin main
```

### 2. 添加新插件

```bash
# 1. 创建新插件
yarn new

# 2. 选择插件类型
# - plugin: 前端插件
# - backend-plugin: 后端插件
# - backend-plugin-module: 后端插件模块

# 3. 按照提示输入插件信息

# 4. 插件会创建在 plugins/ 目录下

# 5. 在 packages/app 或 packages/backend 中引入插件
```

### 3. 更新依赖

```bash
# 查看过时的依赖
yarn outdated

# 更新所有依赖到最新版本
yarn upgrade-interactive

# 更新 Backstage 依赖
yarn backstage-cli versions:bump
```

### 4. 调试技巧

#### 后端调试

```bash
# 使用 Node.js 调试器
node --inspect-brk packages/backend/dist/index.js

# 或者在 VS Code 中配置 launch.json
```

#### 前端调试

- 使用浏览器开发者工具
- React DevTools 扩展
- Redux DevTools 扩展（如果使用 Redux）

#### 数据库调试

```bash
# 连接到 PostgreSQL
docker-compose exec postgres psql -U backstage -d backstage

# 查看表
\dt

# 查询数据
SELECT * FROM entities LIMIT 10;

# 退出
\q
```

### 5. 性能分析

```bash
# 生成性能报告
yarn build:all --profile

# 分析 bundle 大小
yarn workspace app analyze

# 查看内存使用
node --inspect packages/backend/dist/index.js
# 然后在 Chrome 中访问 chrome://inspect
```

---

## 下一步

- 阅读 [Git & GitHub 使用指南](git-github-guide.md)
- 查看 [项目概览](project-overview.md)
- 了解 [部署指南](deployment.md)
- 参与 [贡献](contributing.md)

---

## 获取帮助

如果遇到问题：

1. 查看 [Backstage 官方文档](https://backstage.io/docs/)
2. 搜索 [GitHub Issues](https://github.com/pingxin403/platform-console/issues)
3. 查看应用日志: `docker-compose logs -f`
4. 运行验证脚本: `node scripts/verify-setup.js`
5. 在团队 Slack 频道提问

---

## 附录

### VS Code 推荐扩展

创建 `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-azuretools.vscode-docker",
    "eamodio.gitlens",
    "github.copilot",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### VS Code 调试配置

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/packages/backend/dist/index.js",
      "outFiles": ["${workspaceFolder}/packages/backend/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### 有用的命令

```bash
# 清理所有构建产物
yarn clean

# 类型检查
yarn tsc

# 完整类型检查（包括依赖）
yarn tsc:full

# 格式化代码
yarn prettier --write .

# 检查代码格式
yarn prettier:check

# 创建新的 Backstage 组件
yarn new

# 查看所有可用脚本
yarn run
```
