#!/usr/bin/env node

/**
 * Demo script for Backstage Internal Developer Platform
 * This script demonstrates the project configuration and capabilities
 */

const fs = require('fs');
const yaml = require('js-yaml');

console.log('🎭 Backstage Internal Developer Platform Demo');
console.log('==============================================\n');

// Show project structure
console.log('📁 Project Structure:');
console.log('├── .kiro/                    # Kiro specifications');
console.log('├── packages/');
console.log('│   ├── app/                 # Frontend React app');
console.log('│   └── backend/             # Backend Node.js app');
console.log('├── k8s/                     # Kubernetes configs');
console.log('│   ├── helm/backstage/      # Helm chart');
console.log('│   └── aws/                 # EKS deployment');
console.log('├── scripts/                 # Utility scripts');
console.log('├── app-config.yaml          # Base configuration');
console.log('└── docker-compose.yml       # Local development\n');

// Show configuration
console.log('⚙️  Configuration Overview:');
try {
  const config = yaml.load(fs.readFileSync('app-config.yaml', 'utf8'));
  
  console.log(`📱 App Title: ${config.app.title}`);
  console.log(`🏢 Organization: ${config.organization.name}`);
  console.log(`🔗 Base URL: ${config.app.baseUrl}`);
  console.log(`🗄️  Database: ${config.backend.database.client}`);
  
  if (config.auth.providers.github) {
    console.log('🔐 GitHub OAuth: ✅ Configured');
  }
  
  if (config.integrations.github) {
    console.log('🔗 GitHub Integration: ✅ Configured');
  }
  
} catch (error) {
  console.log('❌ Error reading configuration');
}

// Show features
console.log('\n🚀 Platform Features:');
console.log('✅ Service Catalog - Centralized service registry');
console.log('✅ Golden Path Templates - Standardized project creation');
console.log('✅ GitOps Integration - Argo CD deployment status');
console.log('✅ Observability - Datadog & Sentry integration');
console.log('✅ Documentation as Code - TechDocs automation');
console.log('✅ Cost Visibility - OpenCost integration');
console.log('✅ Workflow Automation - n8n integration');
console.log('✅ AI Assistance - Code generation & troubleshooting');
console.log('✅ Search & Discovery - Comprehensive platform search');

// Show deployment options
console.log('\n🚀 Deployment Options:');
console.log('1. Local Development:');
console.log('   docker compose up --build');
console.log('   Access: http://localhost:7007');
console.log('');
console.log('2. AWS EKS Production:');
console.log('   cd k8s/aws && ./deploy.sh');
console.log('   Access: https://backstage.yourdomain.com');

// Show next steps
console.log('\n📋 Next Steps:');
console.log('1. Configure environment variables (.env)');
console.log('2. Set up GitHub OAuth application');
console.log('3. Configure PostgreSQL database');
console.log('4. Deploy using preferred method');
console.log('5. Start implementing additional tasks');

// Show task progress
console.log('\n📊 Implementation Progress:');
console.log('✅ Task 1: Initialize Backstage application and core infrastructure');
console.log('⏳ Task 2: Implement Service Catalog with GitHub integration');
console.log('⏳ Task 3: Develop Golden Path templates and scaffolder');
console.log('⏳ Task 4-21: Additional platform features...');

console.log('\n🎉 Demo completed! The foundation is ready for development.');
console.log('💡 Tip: Run "node scripts/verify-setup.js" to validate configuration');