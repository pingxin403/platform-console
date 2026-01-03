# Contributing to the Internal Developer Platform

We welcome contributions to improve the platform! This guide will help you get started.

## Getting Started

### Prerequisites

- **Node.js** 18+ and **Yarn** 4+
- **Docker** and **Docker Compose**
- **Git** with access to the organization
- **PostgreSQL** (or use Docker Compose)

### Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/platform-console.git
   cd platform-console
   ```

2. **Install Dependencies**
   ```bash
   yarn install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Development Environment**
   ```bash
   # Start PostgreSQL and other services
   docker-compose up -d postgres
   
   # Start the backend
   yarn workspace backend start
   
   # In another terminal, start the frontend
   yarn workspace app start
   ```

5. **Access the Platform**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:7007

## Development Workflow

### Branch Strategy

We use **GitFlow** with the following branches:

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `hotfix/*`: Critical production fixes
- `release/*`: Release preparation branches

### Making Changes

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow the coding standards below
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   # Run all tests
   yarn test
   
   # Run linting
   yarn lint
   
   # Run type checking
   yarn tsc
   
   # Test the build
   yarn build
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request on GitHub
   ```

## Coding Standards

### TypeScript Guidelines

- Use **strict TypeScript** configuration
- Prefer **interfaces** over types for object shapes
- Use **explicit return types** for functions
- Avoid **any** type - use proper typing

```typescript
// Good
interface UserService {
  getUser(id: string): Promise<User>;
  createUser(data: CreateUserRequest): Promise<User>;
}

// Bad
const userService: any = {
  getUser: (id) => fetch(`/users/${id}`),
  createUser: (data) => fetch('/users', { method: 'POST', body: data })
};
```

### React Guidelines

- Use **functional components** with hooks
- Prefer **composition** over inheritance
- Use **TypeScript** for all components
- Follow **accessibility** best practices

```tsx
// Good
interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
  const handleEdit = useCallback(() => {
    onEdit(user);
  }, [user, onEdit]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{user.name}</Typography>
        <Button onClick={handleEdit} aria-label={`Edit ${user.name}`}>
          Edit
        </Button>
      </CardContent>
    </Card>
  );
};
```

### Backend Guidelines

- Use **dependency injection** for services
- Implement **proper error handling**
- Add **comprehensive logging**
- Follow **REST API** conventions

```typescript
// Good
@Injectable()
export class UserService {
  constructor(
    private readonly logger: Logger,
    private readonly userRepository: UserRepository,
  ) {}

  async getUser(id: string): Promise<User> {
    try {
      this.logger.info(`Fetching user ${id}`);
      const user = await this.userRepository.findById(id);
      
      if (!user) {
        throw new NotFoundError(`User ${id} not found`);
      }
      
      return user;
    } catch (error) {
      this.logger.error(`Failed to fetch user ${id}:`, error);
      throw error;
    }
  }
}
```

## Testing Guidelines

### Unit Tests

- **Test behavior**, not implementation
- Use **descriptive test names**
- Follow **AAA pattern** (Arrange, Act, Assert)
- Mock **external dependencies**

```typescript
describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    userService = new UserService(mockLogger, mockRepository);
  });

  describe('getUser', () => {
    it('should return user when user exists', async () => {
      // Arrange
      const userId = 'user-123';
      const expectedUser = createMockUser({ id: userId });
      mockRepository.findById.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.getUser(userId);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getUser(userId)).rejects.toThrow(NotFoundError);
    });
  });
});
```

### Integration Tests

- Test **complete workflows**
- Use **test databases**
- Clean up **test data** after each test

```typescript
describe('User API Integration', () => {
  let app: INestApplication;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = await createTestApp(testDb);
  });

  afterAll(async () => {
    await app.close();
    await testDb.cleanup();
  });

  afterEach(async () => {
    await testDb.clearData();
  });

  it('should create and retrieve user', async () => {
    // Create user
    const createResponse = await request(app.getHttpServer())
      .post('/api/users')
      .send({ name: 'John Doe', email: 'john@example.com' })
      .expect(201);

    const userId = createResponse.body.id;

    // Retrieve user
    const getResponse = await request(app.getHttpServer())
      .get(`/api/users/${userId}`)
      .expect(200);

    expect(getResponse.body).toMatchObject({
      id: userId,
      name: 'John Doe',
      email: 'john@example.com'
    });
  });
});
```

## Documentation

### Code Documentation

- Use **JSDoc** for functions and classes
- Document **complex algorithms**
- Explain **business logic** and **edge cases**

```typescript
/**
 * Calculates the user's access level based on their role and permissions.
 * 
 * @param user - The user object containing role and permissions
 * @param resource - The resource being accessed
 * @returns The calculated access level (read, write, admin)
 * 
 * @example
 * ```typescript
 * const accessLevel = calculateAccessLevel(user, 'user-management');
 * if (accessLevel === 'admin') {
 *   // Allow admin operations
 * }
 * ```
 */
export function calculateAccessLevel(
  user: User, 
  resource: string
): AccessLevel {
  // Implementation details...
}
```

### API Documentation

- Use **OpenAPI** specifications
- Include **examples** for all endpoints
- Document **error responses**

```yaml
# api-spec.yaml
paths:
  /api/users/{id}:
    get:
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
              example:
                id: "123e4567-e89b-12d3-a456-426614174000"
                name: "John Doe"
                email: "john@example.com"
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

## Plugin Development

### Creating New Plugins

1. **Use the Plugin Template**
   ```bash
   yarn create @backstage/plugin --name my-plugin
   ```

2. **Follow Plugin Structure**
   ```
   plugins/my-plugin/
   ├── src/
   │   ├── components/
   │   ├── hooks/
   │   ├── api/
   │   └── index.ts
   ├── package.json
   └── README.md
   ```

3. **Export Plugin Components**
   ```typescript
   // src/index.ts
   export { myPlugin, MyPluginPage } from './plugin';
   export { MyComponent } from './components';
   ```

### Plugin Best Practices

- **Keep plugins focused** on a single responsibility
- **Use Backstage APIs** for consistency
- **Provide configuration options** for flexibility
- **Include comprehensive tests**

## Commit Message Format

We use **Conventional Commits** for consistent commit messages:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(catalog): add service dependency visualization
fix(auth): resolve token refresh issue
docs(api): update OpenAPI specification
test(user-service): add integration tests
chore(deps): update backstage to v1.20.0
```

## Release Process

### Version Management

We use **Semantic Versioning** (SemVer):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Create Release Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.2.0
   ```

2. **Update Version Numbers**
   ```bash
   # Update package.json versions
   yarn version --new-version 1.2.0
   ```

3. **Update Changelog**
   ```bash
   # Add release notes to CHANGELOG.md
   ```

4. **Create Release PR**
   ```bash
   git push origin release/v1.2.0
   # Create PR to main branch
   ```

5. **Tag Release**
   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0
   ```

## Getting Help

### Communication Channels

- **Slack**: #developer-platform channel
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Office Hours**: Weekly platform office hours

### Reporting Issues

When reporting bugs, please include:

- **Steps to reproduce** the issue
- **Expected behavior**
- **Actual behavior**
- **Environment details** (OS, browser, versions)
- **Screenshots** or logs if applicable

### Requesting Features

For feature requests, please provide:

- **Use case** and business justification
- **Proposed solution** or approach
- **Alternative solutions** considered
- **Additional context** or examples

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- **Be respectful** and professional
- **Be collaborative** and helpful
- **Be inclusive** and welcoming to newcomers
- **Focus on constructive feedback**
- **Respect different viewpoints** and experiences

Thank you for contributing to the Internal Developer Platform! 🚀