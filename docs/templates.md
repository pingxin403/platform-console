# Golden Path Templates

Golden Path Templates provide pre-configured project structures that follow best practices and organizational standards.

## Available Templates

### Java Service Template

**Technology Stack**: Spring Boot, Maven, Docker, Kubernetes

**Features**:

- ✅ Spring Boot 3.x with best practices
- ✅ Maven build configuration
- ✅ Docker multi-stage build
- ✅ Kubernetes deployment manifests
- ✅ GitHub Actions CI/CD pipeline
- ✅ Datadog and Sentry integration
- ✅ OpenAPI documentation
- ✅ Health checks and metrics

**Use Cases**:

- Microservices and REST APIs
- Backend services with database integration
- Event-driven architectures

### Go Service Template

**Technology Stack**: Go 1.21+, Docker, Kubernetes

**Features**:

- ✅ Go HTTP server with Gin framework
- ✅ Structured logging and metrics
- ✅ Docker containerization
- ✅ Kubernetes deployment
- ✅ GitHub Actions pipeline
- ✅ Observability integration
- ✅ Health and readiness probes

**Use Cases**:

- High-performance APIs
- System services and utilities
- Cloud-native applications

### React App Template

**Technology Stack**: React 18, TypeScript, Vite

**Features**:

- ✅ Modern React with TypeScript
- ✅ Vite build system
- ✅ ESLint and Prettier configuration
- ✅ Testing setup with Vitest
- ✅ Docker containerization
- ✅ GitHub Actions deployment
- ✅ Performance monitoring

**Use Cases**:

- Web applications and dashboards
- Admin interfaces
- Customer-facing applications

### React Native App Template

**Technology Stack**: React Native, TypeScript, Expo

**Features**:

- ✅ React Native with TypeScript
- ✅ Expo managed workflow
- ✅ Navigation and state management
- ✅ Testing configuration
- ✅ CI/CD for app stores
- ✅ Crash reporting integration

**Use Cases**:

- Mobile applications
- Cross-platform apps
- Rapid prototyping

## Template Structure

Each template includes:

### Project Files

```
my-service/
├── src/                    # Source code
├── tests/                  # Test files
├── docs/                   # Documentation
├── k8s/                    # Kubernetes manifests
├── .github/workflows/      # CI/CD pipelines
├── Dockerfile             # Container definition
├── catalog-info.yaml      # Service catalog metadata
├── README.md              # Project documentation
└── package.json           # Dependencies (if applicable)
```

### CI/CD Pipeline

All templates include a complete GitHub Actions workflow:

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: make test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
        run: make build-push

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to staging
        run: make deploy-staging
```

### Kubernetes Manifests

Production-ready Kubernetes configurations:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: { { .Values.name } }
spec:
  replicas: { { .Values.replicas } }
  selector:
    matchLabels:
      app: { { .Values.name } }
  template:
    metadata:
      labels:
        app: { { .Values.name } }
    spec:
      containers:
        - name: { { .Values.name } }
          image: { { .Values.image } }
          ports:
            - containerPort: 8080
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
```

## Using Templates

### Creating a New Service

1. **Navigate to Create**

   - Go to **Create** → **Choose a template**
   - Select the appropriate template

2. **Fill Template Parameters**

   ```yaml
   Name: my-awesome-service
   Description: A service that does awesome things
   Owner: team-backend
   Repository:
     Organization: myorg
     Name: my-awesome-service
   ```

3. **Review Generated Files**

   - Check the preview of generated files
   - Verify configuration matches requirements

4. **Create Repository**
   - Template creates GitHub repository
   - Pushes initial code and configuration
   - Registers service in catalog

### Customizing Templates

Templates can be customized through parameters:

#### Common Parameters

- **name**: Service name (kebab-case)
- **description**: Service description
- **owner**: Team or individual owner
- **system**: System this service belongs to
- **lifecycle**: production, experimental, deprecated

#### Technology-Specific Parameters

- **javaVersion**: Java version (8, 11, 17, 21)
- **springBootVersion**: Spring Boot version
- **nodeVersion**: Node.js version
- **reactVersion**: React version

#### Infrastructure Parameters

- **database**: PostgreSQL, MySQL, MongoDB
- **cache**: Redis, Memcached
- **messaging**: Kafka, RabbitMQ, SQS

## Template Development

### Creating Custom Templates

1. **Template Structure**

   ```
   template/
   ├── template.yaml          # Template definition
   ├── skeleton/             # Template files
   │   ├── src/
   │   ├── ${{values.name}}.md
   │   └── catalog-info.yaml
   └── docs/                 # Template documentation
   ```

2. **Template Definition**
   ```yaml
   apiVersion: scaffolder.backstage.io/v1beta3
   kind: Template
   metadata:
     name: my-custom-template
     title: My Custom Service Template
     description: Custom template for our specific needs
   spec:
     owner: platform-team
     type: service
     parameters:
       - title: Service Information
         required:
           - name
           - description
         properties:
           name:
             title: Name
             type: string
             pattern: '^[a-z0-9-]+$'
           description:
             title: Description
             type: string
     steps:
       - id: fetch
         name: Fetch Template
         action: fetch:template
         input:
           url: ./skeleton
           values:
             name: ${{ parameters.name }}
             description: ${{ parameters.description }}
   ```

### Best Practices

#### Template Design

- **Keep templates minimal** but complete
- **Include comprehensive documentation**
- **Follow organizational standards**
- **Provide sensible defaults**

#### Parameter Validation

- **Use JSON Schema** for parameter validation
- **Provide clear descriptions** for all parameters
- **Set appropriate constraints** and patterns

#### Testing Templates

- **Test template generation** regularly
- **Validate generated projects** build successfully
- **Check all integrations** work correctly

## Troubleshooting

### Template Not Appearing

1. Check template registration in catalog
2. Verify template.yaml syntax
3. Check template location configuration
4. Review catalog processing logs

### Generation Failures

1. Check parameter validation
2. Verify template file syntax
3. Review scaffolder action logs
4. Test template locally

### Integration Issues

1. Verify GitHub permissions
2. Check repository creation settings
3. Test catalog registration
4. Validate CI/CD pipeline configuration
