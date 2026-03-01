# CI/CD Integration Examples

This document provides examples of integrating the Production Readiness Gate into various CI/CD pipelines.

## GitHub Actions

### Basic Validation

```yaml
name: Production Deployment

on:
  push:
    branches: [main]

jobs:
  validate-readiness:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Collect service metadata
        id: metadata
        run: |
          # Collect metadata from various sources
          # This is a simplified example - in production, you'd collect real data
          cat > service-metadata.json <<EOF
          {
            "serviceId": "${{ github.repository }}",
            "name": "${{ github.event.repository.name }}",
            "owner": "${{ github.repository_owner }}",
            "team": "platform-team",
            "repositoryUrl": "${{ github.event.repository.html_url }}",
            "hasReadme": true,
            "hasTechDocs": true,
            "hasApiDocs": true,
            "hasRunbook": false,
            "hasUnitTests": true,
            "hasIntegrationTests": true,
            "codeCoverage": 85,
            "testsPassing": true,
            "hasMetrics": true,
            "hasAlerts": true,
            "hasLogging": true,
            "hasDashboard": true,
            "slosDefined": false,
            "hasSecurityScanning": true,
            "vulnerabilityCount": 3,
            "highSeverityVulnerabilities": 0,
            "dependenciesUpToDate": true,
            "secretsScanned": true,
            "withinBudget": true,
            "resourceUtilization": 75,
            "costTrend": "stable",
            "hasRightSizing": true
          }
          EOF
      
      - name: Validate Production Readiness
        id: validate
        run: |
          response=$(curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.BACKSTAGE_TOKEN }}" \
            -d @service-metadata.json \
            ${{ secrets.BACKSTAGE_URL }}/api/maturity/maturity/${{ github.repository }}/validate-readiness)
          
          echo "$response" > validation-result.json
          
          isReady=$(echo "$response" | jq -r '.validation.isReady')
          summary=$(echo "$response" | jq -r '.feedback.summary')
          
          echo "is_ready=$isReady" >> $GITHUB_OUTPUT
          echo "summary=$summary" >> $GITHUB_OUTPUT
          
          if [ "$isReady" != "true" ]; then
            echo "❌ Production Readiness Gate Failed"
            echo "$response" | jq -r '.feedback.detailed'
            exit 1
          fi
          
          echo "✅ Production Readiness Gate Passed"
          echo "Score: $(echo "$response" | jq -r '.scorecard.overallScore')"
      
      - name: Upload validation result
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: readiness-validation
          path: validation-result.json
  
  deploy:
    needs: validate-readiness
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: |
          echo "Deploying to production..."
          # Your deployment steps here
```

### With Approval Workflow

```yaml
name: Production Deployment with Approval

on:
  push:
    branches: [main]

jobs:
  validate-readiness:
    runs-on: ubuntu-latest
    outputs:
      is_ready: ${{ steps.validate.outputs.is_ready }}
      approval_url: ${{ steps.request_approval.outputs.approval_url }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Collect service metadata
        run: |
          # Collect metadata (same as above)
          cat > service-metadata.json <<EOF
          { ... }
          EOF
      
      - name: Validate Production Readiness
        id: validate
        continue-on-error: true
        run: |
          response=$(curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.BACKSTAGE_TOKEN }}" \
            -d @service-metadata.json \
            ${{ secrets.BACKSTAGE_URL }}/api/maturity/maturity/${{ github.repository }}/validate-readiness)
          
          isReady=$(echo "$response" | jq -r '.validation.isReady')
          echo "is_ready=$isReady" >> $GITHUB_OUTPUT
          
          if [ "$isReady" == "true" ]; then
            echo "✅ Production Readiness Gate Passed"
            exit 0
          else
            echo "⚠️  Production Readiness Gate Failed"
            echo "$response" | jq -r '.feedback.detailed'
            exit 1
          fi
      
      - name: Request Approval
        id: request_approval
        if: steps.validate.outcome == 'failure'
        run: |
          response=$(curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.BACKSTAGE_TOKEN }}" \
            -d @service-metadata.json \
            ${{ secrets.BACKSTAGE_URL }}/api/maturity/maturity/${{ github.repository }}/request-approval)
          
          approvalUrl=$(echo "$response" | jq -r '.approvalRequest.approvalUrl')
          echo "approval_url=$approvalUrl" >> $GITHUB_OUTPUT
          
          echo "📝 Approval request created: $approvalUrl"
  
  deploy-with-approval:
    needs: validate-readiness
    if: needs.validate-readiness.outputs.is_ready == 'false'
    runs-on: ubuntu-latest
    environment:
      name: production-with-approval
      url: ${{ needs.validate-readiness.outputs.approval_url }}
    steps:
      - name: Deploy to Production (with approval)
        run: |
          echo "Deploying to production with approval..."
          # Your deployment steps here
  
  deploy-direct:
    needs: validate-readiness
    if: needs.validate-readiness.outputs.is_ready == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: |
          echo "Deploying to production..."
          # Your deployment steps here
```

## GitLab CI

```yaml
stages:
  - validate
  - deploy

validate-readiness:
  stage: validate
  image: curlimages/curl:latest
  script:
    - |
      # Collect service metadata
      cat > service-metadata.json <<EOF
      {
        "serviceId": "$CI_PROJECT_PATH",
        "name": "$CI_PROJECT_NAME",
        "owner": "$CI_PROJECT_NAMESPACE",
        "team": "platform-team",
        "repositoryUrl": "$CI_PROJECT_URL",
        "hasReadme": true,
        "hasTechDocs": true,
        ...
      }
      EOF
    
    - |
      # Validate production readiness
      response=$(curl -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $BACKSTAGE_TOKEN" \
        -d @service-metadata.json \
        $BACKSTAGE_URL/api/maturity/maturity/$CI_PROJECT_PATH/validate-readiness)
      
      echo "$response" > validation-result.json
      
      isReady=$(echo "$response" | jq -r '.validation.isReady')
      
      if [ "$isReady" != "true" ]; then
        echo "❌ Production Readiness Gate Failed"
        echo "$response" | jq -r '.feedback.detailed'
        exit 1
      fi
      
      echo "✅ Production Readiness Gate Passed"
  artifacts:
    paths:
      - validation-result.json
    when: always

deploy-production:
  stage: deploy
  dependencies:
    - validate-readiness
  script:
    - echo "Deploying to production..."
    # Your deployment steps here
  only:
    - main
```

## Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        BACKSTAGE_URL = credentials('backstage-url')
        BACKSTAGE_TOKEN = credentials('backstage-token')
        SERVICE_ID = "${env.GIT_URL.replaceFirst(/^.*\/([^\/]+?).git$/, '$1')}"
    }
    
    stages {
        stage('Collect Metadata') {
            steps {
                script {
                    // Collect service metadata
                    def metadata = [
                        serviceId: SERVICE_ID,
                        name: env.JOB_NAME,
                        owner: 'platform-team',
                        team: 'platform-team',
                        repositoryUrl: env.GIT_URL,
                        hasReadme: true,
                        hasTechDocs: true,
                        // ... other metadata
                    ]
                    
                    writeJSON file: 'service-metadata.json', json: metadata
                }
            }
        }
        
        stage('Validate Production Readiness') {
            steps {
                script {
                    def response = sh(
                        script: """
                            curl -X POST \
                                -H "Content-Type: application/json" \
                                -H "Authorization: Bearer ${BACKSTAGE_TOKEN}" \
                                -d @service-metadata.json \
                                ${BACKSTAGE_URL}/api/maturity/maturity/${SERVICE_ID}/validate-readiness
                        """,
                        returnStdout: true
                    ).trim()
                    
                    def validation = readJSON text: response
                    
                    if (!validation.validation.isReady) {
                        echo "❌ Production Readiness Gate Failed"
                        echo validation.feedback.detailed
                        error("Service does not meet production readiness requirements")
                    }
                    
                    echo "✅ Production Readiness Gate Passed"
                    echo "Score: ${validation.scorecard.overallScore}"
                }
            }
        }
        
        stage('Deploy to Production') {
            steps {
                echo 'Deploying to production...'
                // Your deployment steps here
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'service-metadata.json', allowEmptyArchive: true
        }
    }
}
```

## Argo CD Pre-Sync Hook

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: readiness-gate-check
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
spec:
  template:
    spec:
      containers:
      - name: readiness-check
        image: curlimages/curl:latest
        command:
        - /bin/sh
        - -c
        - |
          # Collect service metadata
          cat > /tmp/metadata.json <<EOF
          {
            "serviceId": "${ARGOCD_APP_NAME}",
            "name": "${ARGOCD_APP_NAME}",
            "owner": "platform-team",
            "team": "platform-team",
            "repositoryUrl": "${ARGOCD_APP_SOURCE_REPO_URL}",
            ...
          }
          EOF
          
          # Validate production readiness
          response=$(curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${BACKSTAGE_TOKEN}" \
            -d @/tmp/metadata.json \
            ${BACKSTAGE_URL}/api/maturity/maturity/${ARGOCD_APP_NAME}/validate-readiness)
          
          isReady=$(echo "$response" | jq -r '.validation.isReady')
          
          if [ "$isReady" != "true" ]; then
            echo "❌ Production Readiness Gate Failed"
            echo "$response" | jq -r '.feedback.detailed'
            exit 1
          fi
          
          echo "✅ Production Readiness Gate Passed"
        env:
        - name: BACKSTAGE_URL
          valueFrom:
            secretKeyRef:
              name: backstage-config
              key: url
        - name: BACKSTAGE_TOKEN
          valueFrom:
            secretKeyRef:
              name: backstage-config
              key: token
      restartPolicy: Never
  backoffLimit: 1
```

## Best Practices

### 1. Metadata Collection

Automate metadata collection from various sources:

```bash
#!/bin/bash
# collect-metadata.sh

SERVICE_ID="$1"

# Check for README
HAS_README=$([ -f README.md ] && echo "true" || echo "false")

# Check for TechDocs
HAS_TECHDOCS=$([ -d docs ] && echo "true" || echo "false")

# Get test coverage from coverage report
CODE_COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')

# Check for security scanning
HAS_SECURITY_SCANNING=$(grep -q "security-scan" .github/workflows/*.yml && echo "true" || echo "false")

# Get vulnerability count from security scan results
VULN_COUNT=$(cat security-scan-results.json | jq '.vulnerabilities | length')

# Build metadata JSON
cat > service-metadata.json <<EOF
{
  "serviceId": "$SERVICE_ID",
  "hasReadme": $HAS_README,
  "hasTechDocs": $HAS_TECHDOCS,
  "codeCoverage": $CODE_COVERAGE,
  "hasSecurityScanning": $HAS_SECURITY_SCANNING,
  "vulnerabilityCount": $VULN_COUNT,
  ...
}
EOF
```

### 2. Caching Validation Results

Cache validation results to avoid redundant checks:

```yaml
- name: Cache validation result
  uses: actions/cache@v3
  with:
    path: validation-result.json
    key: readiness-${{ github.sha }}
    restore-keys: |
      readiness-
```

### 3. Gradual Rollout

Start with warnings, then enforce:

```yaml
- name: Validate Production Readiness
  continue-on-error: ${{ env.ENFORCE_GATE != 'true' }}
  run: |
    # Validation logic
```

### 4. Notification on Failure

Send notifications when gate fails:

```yaml
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Production Readiness Gate failed for ${{ github.repository }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "❌ *Production Readiness Gate Failed*\n\nService: ${{ github.repository }}\nScore: ${{ steps.validate.outputs.score }}\nRequired: 70"
            }
          }
        ]
      }
```

## Troubleshooting

### Common Issues

1. **Metadata collection fails**: Ensure all required tools are installed (jq, curl, etc.)
2. **Authentication errors**: Verify BACKSTAGE_TOKEN is valid and has correct permissions
3. **Network timeouts**: Increase timeout values or check network connectivity
4. **False positives**: Review and adjust check configurations in app-config.yaml

### Debug Mode

Enable debug output:

```bash
curl -v -X POST \
  -H "Content-Type: application/json" \
  -d @service-metadata.json \
  $BACKSTAGE_URL/api/maturity/maturity/$SERVICE_ID/validate-readiness \
  | jq '.'
```
