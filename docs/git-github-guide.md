# Git 和 GitHub 使用指南

## 目录

1. [Git 基础概念](#git-基础概念)
2. [当前项目的 Git 配置](#当前项目的-git-配置)
3. [Git 工作流最佳实践](#git-工作流最佳实践)
4. [GitHub 集成和协作](#github-集成和协作)
5. [提交规范](#提交规范)
6. [分支策略](#分支策略)
7. [常用命令速查](#常用命令速查)
8. [问题排查](#问题排查)

---

## Git 基础概念

### Git 是什么？

Git 是一个分布式版本控制系统，用于跟踪代码变更历史。每个开发者都有完整的代码仓库副本。

### 核心概念

- **Repository（仓库）**: 存储项目代码和历史记录的地方
- **Commit（提交）**: 代码变更的快照
- **Branch（分支）**: 独立的开发线
- **Remote（远程）**: 托管在服务器上的仓库（如 GitHub）
- **Working Directory（工作目录）**: 你当前编辑的文件
- **Staging Area（暂存区）**: 准备提交的变更
- **HEAD**: 当前分支的最新提交

### Git 工作流程

```
工作目录 → 暂存区 → 本地仓库 → 远程仓库
   ↓         ↓         ↓          ↓
  编辑    git add   git commit  git push
```

---

## 当前项目的 Git 配置

### 远程仓库信息

```bash
# 查看远程仓库
$ git remote -v
origin  git@github-163:pingxin403/platform-console.git (fetch)
origin  git@github-163:pingxin403/platform-console.git (push)
```

- **仓库名称**: `platform-console`
- **所有者**: `pingxin403`
- **连接方式**: SSH（使用 `github-163` 别名）

### 当前分支状态

```bash
$ git status
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

- **当前分支**: `main`
- **状态**: 与远程同步，工作目录干净

### 最近的提交历史

```bash
$ git log --oneline -10
02c41d3 (HEAD -> main, origin/main) fix: start error
2ab15a9 fix: start error
b27e8db fix: task 13.9 collaboration plugins integration test
f94de7e (tag: checkpoint-2) checkpoint: core platform MVP complete
89eede2 config: apply production best practices and security hardening
...
```

### 标签（Tags）

项目使用标签标记重要的检查点：

- `checkpoint-1`: Core catalog and scaffolder
- `checkpoint-2`: Core platform MVP complete
- `task-11-opencost-complete`: OpenCost plugin integration

---

## Git 工作流最佳实践

### 1. 日常开发流程

#### 开始工作前

```bash
# 1. 确保在正确的分支
git branch

# 2. 拉取最新代码
git pull origin main

# 3. 查看当前状态
git status
```

#### 进行开发

```bash
# 1. 创建功能分支（可选，用于大功能）
git checkout -b feature/search-functionality

# 2. 进行代码修改
# ... 编辑文件 ...

# 3. 查看修改
git status
git diff

# 4. 添加文件到暂存区
git add .                    # 添加所有修改
git add src/search.ts        # 添加特定文件
git add src/*.ts             # 添加特定模式的文件

# 5. 查看暂存的修改
git diff --staged

# 6. 提交修改
git commit -m "feat: implement search functionality"

# 7. 推送到远程
git push origin feature/search-functionality
```

#### 完成功能后

```bash
# 1. 合并到主分支（如果使用功能分支）
git checkout main
git merge feature/search-functionality

# 2. 推送到远程
git push origin main

# 3. 删除功能分支（可选）
git branch -d feature/search-functionality
git push origin --delete feature/search-functionality
```

### 2. 提交最佳实践

#### 频繁提交

- ✅ 完成一个子任务后立即提交
- ✅ 修复一个 bug 后立即提交
- ✅ 重构一个模块后立即提交
- ❌ 不要等到一天结束才提交
- ❌ 不要一次提交太多不相关的修改

#### 原子性提交

每个提交应该是一个逻辑单元：

```bash
# ✅ 好的提交
git commit -m "feat: add user authentication"
git commit -m "test: add tests for authentication"
git commit -m "docs: update authentication documentation"

# ❌ 不好的提交
git commit -m "add authentication, fix bugs, update docs"
```

#### 提交前检查

```bash
# 1. 运行测试
yarn test

# 2. 运行 lint
yarn lint

# 3. 构建项目
yarn build

# 4. 查看将要提交的内容
git diff --staged
```

### 3. 使用 Git Hooks 自动化

创建 `.git/hooks/pre-commit` 文件：

```bash
#!/bin/sh
# Pre-commit hook

echo "Running pre-commit checks..."

# Run linter
echo "Running linter..."
yarn lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed. Please fix errors before committing."
  exit 1
fi

# Run tests
echo "Running tests..."
yarn test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Please fix tests before committing."
  exit 1
fi

echo "✅ All checks passed!"
exit 0
```

使其可执行：

```bash
chmod +x .git/hooks/pre-commit
```

---

## GitHub 集成和协作

### 1. Pull Request（PR）工作流

#### 创建 Pull Request

```bash
# 1. 创建功能分支
git checkout -b feature/new-feature

# 2. 进行开发和提交
git add .
git commit -m "feat: implement new feature"

# 3. 推送到 GitHub
git push origin feature/new-feature

# 4. 在 GitHub 上创建 Pull Request
# 访问: https://github.com/pingxin403/platform-console/pulls
# 点击 "New pull request"
```

#### PR 描述模板

```markdown
## 描述

简要描述这个 PR 的目的和实现的功能。

## 相关 Issue

Closes #123

## 变更类型

- [ ] Bug 修复
- [x] 新功能
- [ ] 重大变更
- [ ] 文档更新

## 测试

- [x] 单元测试通过
- [x] 集成测试通过
- [ ] 手动测试完成

## 检查清单

- [x] 代码遵循项目规范
- [x] 已添加必要的测试
- [x] 已更新相关文档
- [x] 所有测试通过
```

#### 代码审查

```bash
# 1. 拉取 PR 分支进行本地测试
git fetch origin
git checkout feature/new-feature

# 2. 运行测试
yarn test

# 3. 在 GitHub 上添加评论和建议

# 4. 批准或请求修改
```

### 2. GitHub Actions 集成

项目已配置 GitHub Actions 用于 CI/CD。查看 `.github/workflows/` 目录。

#### 典型的 CI 工作流

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: yarn install
      - name: Run tests
        run: yarn test:all
      - name: Run linter
        run: yarn lint:all
      - name: Build
        run: yarn build:all
```

### 3. GitHub Issues 管理

#### 创建 Issue

```markdown
**标题**: [Bug] 搜索功能返回错误结果

**描述**:
当搜索包含特殊字符的服务名称时，搜索功能返回空结果。

**重现步骤**:

1. 访问搜索页面
2. 输入 "service-name@v1"
3. 点击搜索

**预期行为**:
应该返回匹配的服务

**实际行为**:
返回空结果

**环境**:

- 浏览器: Chrome 120
- 操作系统: macOS 14
- 版本: v1.0.0

**相关日志**:
```

Error: Invalid search query

```

#### Issue 标签

使用标签组织 Issues：

- `bug`: Bug 报告
- `enhancement`: 功能增强
- `documentation`: 文档相关
- `good first issue`: 适合新手
- `help wanted`: 需要帮助
- `priority: high`: 高优先级

### 4. GitHub Projects 看板

使用 GitHub Projects 管理任务：

1. **To Do**: 待办任务
2. **In Progress**: 进行中
3. **Review**: 代码审查中
4. **Done**: 已完成

---

## 提交规范

### Conventional Commits

项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```

<type>(<scope>): <subject>

<body>

<footer>
```

### 提交类型（Type）

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构（既不是新功能也不是 bug 修复）
- `perf`: 性能优化
- `test`: 添加或修改测试
- `build`: 构建系统或依赖变更
- `ci`: CI 配置变更
- `chore`: 其他不修改源代码的变更
- `revert`: 回滚之前的提交
- `config`: 配置文件变更
- `checkpoint`: 检查点提交

### 提交示例

#### 基本提交

```bash
# 新功能
git commit -m "feat: add search functionality to service catalog"

# Bug 修复
git commit -m "fix: resolve authentication timeout issue"

# 文档更新
git commit -m "docs: update deployment guide with EKS instructions"

# 配置变更
git commit -m "config: update PostgreSQL connection pool settings"

# 测试
git commit -m "test: add property tests for service discovery"
```

#### 带作用域的提交

```bash
git commit -m "feat(catalog): add dependency graph visualization"
git commit -m "fix(auth): handle token expiration gracefully"
git commit -m "test(search): add integration tests for search API"
```

#### 带详细描述的提交

```bash
git commit -m "feat: implement AI-powered code suggestions

- Add OpenAI integration for code generation
- Implement context building from service metadata
- Add rate limiting and error handling
- Include unit and integration tests

Closes #123"
```

#### 重大变更（Breaking Change）

```bash
git commit -m "feat!: migrate to new authentication system

BREAKING CHANGE: The authentication API has been completely redesigned.
All clients must update to use the new OAuth2 flow.

Migration guide: docs/migration/auth-v2.md"
```

### 检查点提交

在完成重要里程碑时创建检查点：

```bash
# 1. 提交所有变更
git add .
git commit -m "checkpoint: core platform MVP complete"

# 2. 创建标签
git tag -a "checkpoint-3" -m "Checkpoint 3: Complete MVP with all plugins"

# 3. 推送提交和标签
git push origin main
git push origin --tags
```

---

## 分支策略

### 1. 主分支策略（适合小团队）

```
main (生产分支)
  ↓
feature/* (功能分支)
```

**工作流程**:

```bash
# 1. 从 main 创建功能分支
git checkout main
git pull origin main
git checkout -b feature/search-functionality

# 2. 开发和提交
git add .
git commit -m "feat: implement search"

# 3. 推送功能分支
git push origin feature/search-functionality

# 4. 创建 Pull Request

# 5. 审查通过后合并到 main
git checkout main
git merge feature/search-functionality
git push origin main

# 6. 删除功能分支
git branch -d feature/search-functionality
git push origin --delete feature/search-functionality
```

### 2. Git Flow 策略（适合大团队）

```
main (生产分支)
  ↓
develop (开发分支)
  ↓
feature/* (功能分支)
release/* (发布分支)
hotfix/* (热修复分支)
```

**工作流程**:

```bash
# 1. 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# 2. 开发完成后合并回 develop
git checkout develop
git merge feature/new-feature

# 3. 准备发布时创建 release 分支
git checkout -b release/v1.1.0 develop

# 4. 测试和修复后合并到 main 和 develop
git checkout main
git merge release/v1.1.0
git tag -a v1.1.0 -m "Release v1.1.0"

git checkout develop
git merge release/v1.1.0

# 5. 紧急修复使用 hotfix 分支
git checkout -b hotfix/critical-bug main
# ... 修复 ...
git checkout main
git merge hotfix/critical-bug
git tag -a v1.1.1 -m "Hotfix v1.1.1"
```

### 3. 分支命名规范

```bash
# 功能分支
feature/user-authentication
feature/search-functionality
feature/ai-assistant

# Bug 修复分支
fix/authentication-timeout
fix/search-crash

# 热修复分支
hotfix/critical-security-issue

# 发布分支
release/v1.0.0
release/v1.1.0

# 实验性分支
experiment/new-architecture
```

---

## 常用命令速查

### 基础操作

```bash
# 初始化仓库
git init

# 克隆仓库
git clone git@github.com:pingxin403/platform-console.git

# 查看状态
git status

# 查看修改
git diff                    # 工作目录 vs 暂存区
git diff --staged           # 暂存区 vs 最后一次提交
git diff HEAD               # 工作目录 vs 最后一次提交

# 添加文件
git add file.txt            # 添加特定文件
git add .                   # 添加所有修改
git add -p                  # 交互式添加

# 提交
git commit -m "message"     # 提交暂存的修改
git commit -am "message"    # 添加并提交所有修改
git commit --amend          # 修改最后一次提交

# 推送
git push origin main        # 推送到远程
git push -u origin main     # 推送并设置上游分支
git push --tags             # 推送标签
```

### 分支操作

```bash
# 查看分支
git branch                  # 本地分支
git branch -r               # 远程分支
git branch -a               # 所有分支

# 创建分支
git branch feature-x        # 创建分支
git checkout -b feature-x   # 创建并切换

# 切换分支
git checkout main
git switch main             # 新语法

# 合并分支
git merge feature-x         # 合并到当前分支
git merge --no-ff feature-x # 强制创建合并提交

# 删除分支
git branch -d feature-x     # 删除本地分支
git push origin --delete feature-x  # 删除远程分支

# 重命名分支
git branch -m old-name new-name
```

### 远程操作

```bash
# 查看远程
git remote -v
git remote show origin

# 添加远程
git remote add origin <url>

# 拉取
git fetch origin            # 获取远程更新
git pull origin main        # 获取并合并
git pull --rebase origin main  # 获取并变基

# 推送
git push origin main
git push -f origin main     # 强制推送（危险！）
```

### 历史查看

```bash
# 查看提交历史
git log
git log --oneline           # 简洁模式
git log --graph             # 图形模式
git log --all --graph --oneline  # 所有分支图形模式

# 查看特定文件历史
git log -- file.txt
git log -p file.txt         # 包含差异

# 查看提交详情
git show <commit-hash>

# 查看谁修改了文件
git blame file.txt
```

### 撤销操作

```bash
# 撤销工作目录的修改
git checkout -- file.txt    # 旧语法
git restore file.txt        # 新语法

# 撤销暂存
git reset HEAD file.txt     # 旧语法
git restore --staged file.txt  # 新语法

# 撤销提交
git reset --soft HEAD~1     # 保留修改，撤销提交
git reset --mixed HEAD~1    # 保留修改，撤销提交和暂存
git reset --hard HEAD~1     # 丢弃所有修改（危险！）

# 回滚提交（创建新提交）
git revert <commit-hash>

# 清理未跟踪的文件
git clean -n                # 预览
git clean -f                # 删除文件
git clean -fd               # 删除文件和目录
```

### 标签操作

```bash
# 创建标签
git tag v1.0.0              # 轻量标签
git tag -a v1.0.0 -m "Release v1.0.0"  # 附注标签

# 查看标签
git tag
git show v1.0.0

# 推送标签
git push origin v1.0.0      # 推送特定标签
git push origin --tags      # 推送所有标签

# 删除标签
git tag -d v1.0.0           # 删除本地标签
git push origin --delete v1.0.0  # 删除远程标签

# 检出标签
git checkout v1.0.0
```

### 储藏（Stash）

```bash
# 储藏当前修改
git stash
git stash save "work in progress"

# 查看储藏列表
git stash list

# 应用储藏
git stash apply             # 应用最新储藏
git stash apply stash@{0}   # 应用特定储藏
git stash pop               # 应用并删除最新储藏

# 删除储藏
git stash drop stash@{0}
git stash clear             # 删除所有储藏
```

### 变基（Rebase）

```bash
# 变基到另一个分支
git rebase main

# 交互式变基（整理提交历史）
git rebase -i HEAD~3

# 继续/中止变基
git rebase --continue
git rebase --abort
```

---

## 问题排查

### 1. 合并冲突

```bash
# 1. 尝试合并时出现冲突
$ git merge feature-branch
Auto-merging file.txt
CONFLICT (content): Merge conflict in file.txt
Automatic merge failed; fix conflicts and then commit the result.

# 2. 查看冲突文件
$ git status
Unmerged paths:
  both modified:   file.txt

# 3. 编辑冲突文件
# 文件中会有冲突标记：
<<<<<<< HEAD
当前分支的内容
=======
要合并分支的内容
>>>>>>> feature-branch

# 4. 解决冲突后
git add file.txt
git commit -m "fix: resolve merge conflict in file.txt"
```

### 2. 撤销错误的提交

```bash
# 情况 1: 还没推送到远程
git reset --soft HEAD~1     # 撤销提交，保留修改
git reset --hard HEAD~1     # 撤销提交，丢弃修改

# 情况 2: 已经推送到远程
git revert <commit-hash>    # 创建新提交来撤销
git push origin main
```

### 3. 恢复删除的文件

```bash
# 恢复工作目录中删除的文件
git checkout HEAD -- file.txt

# 恢复之前提交中的文件
git checkout <commit-hash> -- file.txt
```

### 4. 找回丢失的提交

```bash
# 查看所有操作历史
git reflog

# 恢复到特定提交
git reset --hard <commit-hash>
```

### 5. 清理大文件

```bash
# 从历史中删除大文件
git filter-branch --tree-filter 'rm -f large-file.zip' HEAD

# 或使用 BFG Repo-Cleaner（更快）
bfg --delete-files large-file.zip
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 6. 同步 Fork 的仓库

```bash
# 1. 添加上游仓库
git remote add upstream <original-repo-url>

# 2. 获取上游更新
git fetch upstream

# 3. 合并到本地
git checkout main
git merge upstream/main

# 4. 推送到自己的 Fork
git push origin main
```

### 7. 修改提交作者信息

```bash
# 修改最后一次提交的作者
git commit --amend --author="Name <email@example.com>"

# 修改历史提交的作者
git rebase -i HEAD~3
# 将要修改的提交标记为 'edit'
git commit --amend --author="Name <email@example.com>"
git rebase --continue
```

---

## 高级技巧

### 1. 使用 Git Aliases

在 `~/.gitconfig` 中添加：

```ini
[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    unstage = reset HEAD --
    last = log -1 HEAD
    visual = log --all --graph --oneline --decorate
    amend = commit --amend --no-edit
```

使用：

```bash
git st              # 等同于 git status
git co main         # 等同于 git checkout main
git visual          # 图形化查看历史
```

### 2. 使用 .gitignore

项目已有 `.gitignore` 文件，确保不提交：

- `node_modules/`
- `.env`
- `dist/`
- `coverage/`
- 临时文件

### 3. 使用 Git Worktree

同时处理多个分支：

```bash
# 创建新的工作树
git worktree add ../platform-console-feature feature/new-feature

# 在新目录中工作
cd ../platform-console-feature

# 删除工作树
git worktree remove ../platform-console-feature
```

### 4. 使用 Git Bisect 查找 Bug

```bash
# 开始二分查找
git bisect start
git bisect bad                  # 当前版本有 bug
git bisect good <commit-hash>   # 某个旧版本没有 bug

# Git 会自动切换到中间的提交
# 测试后标记
git bisect good  # 或 git bisect bad

# 找到问题提交后
git bisect reset
```

### 5. 使用 Git Submodules

管理依赖的其他 Git 仓库：

```bash
# 添加子模块
git submodule add <repo-url> path/to/submodule

# 克隆包含子模块的仓库
git clone --recursive <repo-url>

# 更新子模块
git submodule update --remote
```

---

## 项目特定的 Git 工作流

### 1. 执行 Spec 任务时的提交流程

```bash
# 1. 开始任务前确保代码最新
git pull origin main

# 2. 实施任务（由 Kiro 自动完成）
# ... 代码修改 ...

# 3. 任务完成后提交
git add .
git commit -m "feat: implement Task 17 - search and discovery functionality"

# 4. 推送到远程
git push origin main
```

### 2. 检查点提交流程

```bash
# 1. 完成一组相关任务后
git add .
git commit -m "checkpoint: search and discovery complete"

# 2. 创建标签
git tag -a "checkpoint-4" -m "Checkpoint 4: Search and discovery"

# 3. 推送提交和标签
git push origin main
git push origin --tags
```

### 3. 发布版本流程

```bash
# 1. 更新版本号
# 编辑 package.json 中的 version 字段

# 2. 提交版本变更
git add package.json
git commit -m "chore: bump version to 1.1.0"

# 3. 创建发布标签
git tag -a "v1.1.0" -m "Release v1.1.0: Add search functionality"

# 4. 推送
git push origin main
git push origin v1.1.0

# 5. 在 GitHub 上创建 Release
# 访问: https://github.com/pingxin403/platform-console/releases/new
```

---

## 总结

### Git 最佳实践清单

- ✅ 频繁提交，每个提交是一个逻辑单元
- ✅ 使用清晰的提交消息（遵循 Conventional Commits）
- ✅ 提交前运行测试和 lint
- ✅ 使用分支进行功能开发
- ✅ 定期推送到远程仓库
- ✅ 使用 Pull Request 进行代码审查
- ✅ 在重要里程碑创建标签
- ✅ 保持 `.gitignore` 文件更新
- ✅ 不要提交敏感信息（密钥、密码等）
- ✅ 使用 Git Hooks 自动化检查

### GitHub 协作最佳实践清单

- ✅ 使用 Issues 跟踪任务和 Bug
- ✅ 使用 Pull Requests 进行代码审查
- ✅ 使用 Projects 看板管理工作流
- ✅ 使用 GitHub Actions 自动化 CI/CD
- ✅ 编写清晰的 PR 描述
- ✅ 及时响应代码审查意见
- ✅ 使用标签组织 Issues 和 PRs
- ✅ 保持 README 和文档更新

### 下一步

1. **配置 Git Hooks**: 设置 pre-commit hook 自动运行测试
2. **设置 GitHub Actions**: 配置 CI/CD 流水线
3. **创建 PR 模板**: 标准化 Pull Request 描述
4. **设置分支保护**: 保护 main 分支，要求代码审查
5. **配置 GitHub Projects**: 使用看板管理任务

---

## 参考资源

- [Git 官方文档](https://git-scm.com/doc)
- [GitHub 文档](https://docs.github.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Pro Git 书籍](https://git-scm.com/book/zh/v2)
