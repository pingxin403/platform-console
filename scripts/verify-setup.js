#!/usr/bin/env node

/**
 * Verification script for Backstage Internal Developer Platform setup
 * This script checks that all core components are properly configured
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('🔍 Verifying Backstage Internal Developer Platform setup...\n');

let errors = [];
let warnings = [];

// Check if required files exist
const requiredFiles = [
  'app-config.yaml',
  'app-config.production.yaml',
  'app-config.local.yaml',
  'packages/backend/src/index.ts',
  'packages/backend/package.json',
  'k8s/helm/backstage/Chart.yaml',
  'k8s/helm/backstage/values.yaml',
  'k8s/aws/eks-cluster.yaml',
  'k8s/aws/deploy.sh',
  '.env.example'
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}`);
    errors.push(`Missing required file: ${file}`);
  }
});

// Check app-config.yaml structure
console.log('\n⚙️  Checking app-config.yaml structure...');
try {
  const appConfig = yaml.load(fs.readFileSync('app-config.yaml', 'utf8'));
  
  // Check required sections
  const requiredSections = ['app', 'backend', 'auth', 'integrations', 'catalog'];
  requiredSections.forEach(section => {
    if (appConfig[section]) {
      console.log(`  ✅ ${section} section present`);
    } else {
      console.log(`  ❌ ${section} section missing`);
      errors.push(`Missing required section in app-config.yaml: ${section}`);
    }
  });

  // Check database configuration
  if (appConfig.backend && appConfig.backend.database) {
    if (appConfig.backend.database.client === 'pg') {
      console.log('  ✅ PostgreSQL database configured');
    } else {
      console.log('  ⚠️  Database client is not PostgreSQL');
      warnings.push('Database client should be PostgreSQL for production');
    }
  }

  // Check GitHub integration
  if (appConfig.integrations && appConfig.integrations.github) {
    console.log('  ✅ GitHub integration configured');
  } else {
    console.log('  ❌ GitHub integration missing');
    errors.push('GitHub integration not configured');
  }

  // Check auth providers
  if (appConfig.auth && appConfig.auth.providers) {
    if (appConfig.auth.providers.github) {
      console.log('  ✅ GitHub OAuth configured');
    } else {
      console.log('  ⚠️  GitHub OAuth not configured');
      warnings.push('GitHub OAuth should be configured for production');
    }
  }

} catch (error) {
  console.log('  ❌ Error reading app-config.yaml');
  errors.push(`Error reading app-config.yaml: ${error.message}`);
}

// Check backend dependencies
console.log('\n📦 Checking backend dependencies...');
try {
  const backendPackage = JSON.parse(fs.readFileSync('packages/backend/package.json', 'utf8'));
  
  const requiredDeps = [
    '@backstage/plugin-auth-backend-module-github-provider',
    'pg',
    '@backstage/plugin-catalog-backend',
    '@backstage/plugin-scaffolder-backend',
    '@backstage/plugin-techdocs-backend'
  ];

  requiredDeps.forEach(dep => {
    if (backendPackage.dependencies && backendPackage.dependencies[dep]) {
      console.log(`  ✅ ${dep}`);
    } else {
      console.log(`  ❌ ${dep}`);
      errors.push(`Missing backend dependency: ${dep}`);
    }
  });

} catch (error) {
  console.log('  ❌ Error reading backend package.json');
  errors.push(`Error reading backend package.json: ${error.message}`);
}

// Check Helm chart structure
console.log('\n⎈ Checking Helm chart structure...');
try {
  const chartYaml = yaml.load(fs.readFileSync('k8s/helm/backstage/Chart.yaml', 'utf8'));
  
  if (chartYaml.name === 'backstage') {
    console.log('  ✅ Chart name is correct');
  } else {
    console.log('  ❌ Chart name is incorrect');
    errors.push('Helm chart name should be "backstage"');
  }

  if (chartYaml.dependencies && chartYaml.dependencies.some(dep => dep.name === 'postgresql')) {
    console.log('  ✅ PostgreSQL dependency configured');
  } else {
    console.log('  ❌ PostgreSQL dependency missing');
    errors.push('PostgreSQL dependency not configured in Helm chart');
  }

} catch (error) {
  console.log('  ❌ Error reading Helm Chart.yaml');
  errors.push(`Error reading Helm Chart.yaml: ${error.message}`);
}

// Check environment example file
console.log('\n🔐 Checking environment configuration...');
try {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  
  const requiredEnvVars = [
    'BACKEND_SECRET',
    'POSTGRES_HOST',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'GITHUB_TOKEN',
    'AUTH_GITHUB_CLIENT_ID',
    'AUTH_GITHUB_CLIENT_SECRET'
  ];

  requiredEnvVars.forEach(envVar => {
    if (envExample.includes(envVar)) {
      console.log(`  ✅ ${envVar}`);
    } else {
      console.log(`  ❌ ${envVar}`);
      errors.push(`Missing environment variable in .env.example: ${envVar}`);
    }
  });

} catch (error) {
  console.log('  ❌ Error reading .env.example');
  errors.push(`Error reading .env.example: ${error.message}`);
}

// Check if deployment script is executable
console.log('\n🚀 Checking deployment configuration...');
try {
  const deployScript = 'k8s/aws/deploy.sh';
  const stats = fs.statSync(deployScript);
  
  if (stats.mode & parseInt('111', 8)) {
    console.log('  ✅ Deploy script is executable');
  } else {
    console.log('  ⚠️  Deploy script is not executable');
    warnings.push('Deploy script should be executable (chmod +x k8s/aws/deploy.sh)');
  }
} catch (error) {
  console.log('  ❌ Error checking deploy script');
  errors.push(`Error checking deploy script: ${error.message}`);
}

// Summary
console.log('\n📊 Setup Verification Summary');
console.log('================================');

if (errors.length === 0) {
  console.log('✅ All critical checks passed!');
} else {
  console.log(`❌ ${errors.length} error(s) found:`);
  errors.forEach(error => console.log(`   • ${error}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  ${warnings.length} warning(s):`);
  warnings.forEach(warning => console.log(`   • ${warning}`));
}

console.log('\n📋 Next Steps:');
console.log('1. Copy .env.example to .env and configure your values');
console.log('2. Set up GitHub OAuth application');
console.log('3. Configure PostgreSQL database');
console.log('4. For local development: docker-compose up');
console.log('5. For production: cd k8s/aws && ./deploy.sh');

if (errors.length > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 Setup verification completed successfully!');
  process.exit(0);
}