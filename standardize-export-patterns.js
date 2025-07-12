/**
 * Standardize Export Patterns Script
 * 
 * Analyzes and standardizes export patterns across all services in src/services/
 * to ensure consistency and proper integration with ServiceFactory.
 */

const fs = require('fs');
const path = require('path');

// Results tracking
const analysis = {
  services: [],
  patterns: {
    classExports: [],
    instanceExports: [],
    defaultExports: [],
    namedExports: [],
    inconsistencies: []
  },
  recommendations: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : '📋';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function analyzeServiceFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.ts');
    
    const serviceAnalysis = {
      fileName,
      filePath,
      hasClassExport: false,
      hasInstanceExport: false,
      hasDefaultExport: false,
      classNames: [],
      instanceNames: [],
      exportPattern: 'unknown',
      isBaseServiceExtension: false,
      issues: []
    };

    // Check for class exports
    const classExportMatches = content.match(/export class (\w+)/g);
    if (classExportMatches) {
      serviceAnalysis.hasClassExport = true;
      serviceAnalysis.classNames = classExportMatches.map(match => match.replace('export class ', ''));
    }

    // Check for instance exports (const exports)
    const instanceExportMatches = content.match(/export const (\w+)/g);
    if (instanceExportMatches) {
      serviceAnalysis.hasInstanceExport = true;
      serviceAnalysis.instanceNames = instanceExportMatches.map(match => match.replace('export const ', ''));
    }

    // Check for default exports
    if (content.includes('export default')) {
      serviceAnalysis.hasDefaultExport = true;
    }

    // Check if extends BaseService or its subclasses
    if (content.includes('extends BaseService') || 
        content.includes('extends AIBaseService') ||
        content.includes('extends MediaBaseService') ||
        content.includes('extends RealtimeBaseService')) {
      serviceAnalysis.isBaseServiceExtension = true;
    }

    // Determine export pattern
    if (serviceAnalysis.hasClassExport && serviceAnalysis.hasInstanceExport) {
      serviceAnalysis.exportPattern = 'class-and-instance';
    } else if (serviceAnalysis.hasClassExport) {
      serviceAnalysis.exportPattern = 'class-only';
    } else if (serviceAnalysis.hasInstanceExport) {
      serviceAnalysis.exportPattern = 'instance-only';
    } else if (serviceAnalysis.hasDefaultExport) {
      serviceAnalysis.exportPattern = 'default-only';
    }

    // Check for issues
    if (serviceAnalysis.isBaseServiceExtension && !serviceAnalysis.hasInstanceExport) {
      serviceAnalysis.issues.push('BaseService extension should export singleton instance');
    }

    if (serviceAnalysis.hasClassExport && serviceAnalysis.hasInstanceExport) {
      // Check if instance follows naming convention
      const expectedInstanceName = serviceAnalysis.classNames[0]?.toLowerCase().replace('service', '') + 'ServiceMigrated';
      if (!serviceAnalysis.instanceNames.some(name => name.toLowerCase().includes('service'))) {
        serviceAnalysis.issues.push('Instance export should follow naming convention');
      }
    }

    if (serviceAnalysis.hasDefaultExport && (serviceAnalysis.hasClassExport || serviceAnalysis.hasInstanceExport)) {
      serviceAnalysis.issues.push('Should not mix default exports with named exports');
    }

    return serviceAnalysis;
  } catch (error) {
    log(`Error analyzing ${filePath}: ${error.message}`, 'error');
    return null;
  }
}

function analyzeAllServices() {
  log('🔍 Analyzing export patterns in all services...');
  
  const servicesDir = path.resolve(__dirname, 'src/services');
  const serviceFiles = fs.readdirSync(servicesDir)
    .filter(file => file.endsWith('.ts') && !file.includes('.test.') && !file.includes('.spec.'))
    .map(file => path.join(servicesDir, file));

  for (const filePath of serviceFiles) {
    const serviceAnalysis = analyzeServiceFile(filePath);
    if (serviceAnalysis) {
      analysis.services.push(serviceAnalysis);
      
      // Categorize patterns
      if (serviceAnalysis.hasClassExport) {
        analysis.patterns.classExports.push(serviceAnalysis);
      }
      if (serviceAnalysis.hasInstanceExport) {
        analysis.patterns.instanceExports.push(serviceAnalysis);
      }
      if (serviceAnalysis.hasDefaultExport) {
        analysis.patterns.defaultExports.push(serviceAnalysis);
      }
      if (serviceAnalysis.issues.length > 0) {
        analysis.patterns.inconsistencies.push(serviceAnalysis);
      }
    }
  }
}

function generateRecommendations() {
  log('📋 Generating standardization recommendations...');

  // Standard pattern for migrated services
  analysis.recommendations.push({
    type: 'standard-pattern',
    title: 'Recommended Export Pattern for Migrated Services',
    description: 'All migrated services should export both class and singleton instance',
    example: `
export class UserServiceMigrated extends BaseService {
  // Implementation
}

// Singleton instance for easy consumption
export const userServiceMigrated = new UserServiceMigrated();
    `.trim()
  });

  // Naming conventions
  analysis.recommendations.push({
    type: 'naming-convention',
    title: 'Naming Convention',
    description: 'Follow consistent naming patterns',
    rules: [
      'Class names: [Service]Migrated (e.g., UserServiceMigrated)',
      'Instance names: [service]Migrated (e.g., userServiceMigrated)',
      'File names: [Service]Migrated.ts (e.g., UserServiceMigrated.ts)'
    ]
  });

  // ServiceFactory integration
  analysis.recommendations.push({
    type: 'service-factory',
    title: 'ServiceFactory Integration',
    description: 'Ensure all migrated services work with ServiceFactory',
    requirements: [
      'Export class for instantiation in ServiceFactory',
      'Export singleton instance for direct consumption',
      'Extend appropriate BaseService class',
      'Follow feature flag patterns'
    ]
  });

  // Identify specific fixes needed
  const servicesNeedingFixes = analysis.patterns.inconsistencies;
  if (servicesNeedingFixes.length > 0) {
    analysis.recommendations.push({
      type: 'specific-fixes',
      title: 'Services Requiring Fixes',
      services: servicesNeedingFixes.map(service => ({
        file: service.fileName,
        issues: service.issues,
        currentPattern: service.exportPattern
      }))
    });
  }
}

function generateStandardizationScript() {
  log('🔧 Generating standardization script...');
  
  const fixes = [];
  
  for (const service of analysis.patterns.inconsistencies) {
    if (service.isBaseServiceExtension && !service.hasInstanceExport && service.hasClassExport) {
      const className = service.classNames[0];
      const instanceName = className.charAt(0).toLowerCase() + className.slice(1);
      
      fixes.push({
        file: service.filePath,
        action: 'add-instance-export',
        className,
        instanceName,
        code: `\n// Singleton instance for easy consumption\nexport const ${instanceName} = new ${className}();\n`
      });
    }
  }
  
  return fixes;
}

function printAnalysisReport() {
  log('\n📊 Export Pattern Analysis Report');
  log('=====================================');
  
  log(`\n📁 Total services analyzed: ${analysis.services.length}`);
  log(`📋 Services with class exports: ${analysis.patterns.classExports.length}`);
  log(`📋 Services with instance exports: ${analysis.patterns.instanceExports.length}`);
  log(`📋 Services with default exports: ${analysis.patterns.defaultExports.length}`);
  log(`⚠️  Services with inconsistencies: ${analysis.patterns.inconsistencies.length}`);

  if (analysis.patterns.inconsistencies.length > 0) {
    log('\n⚠️  Services with issues:');
    for (const service of analysis.patterns.inconsistencies) {
      log(`   - ${service.fileName}: ${service.issues.join(', ')}`);
    }
  }

  log('\n✅ Services following standard pattern:');
  const standardServices = analysis.services.filter(s => 
    s.hasClassExport && s.hasInstanceExport && s.isBaseServiceExtension && s.issues.length === 0
  );
  for (const service of standardServices) {
    log(`   - ${service.fileName}: Class + Instance exports`);
  }

  log('\n📋 Recommendations:');
  for (const rec of analysis.recommendations) {
    log(`\n${rec.title}:`);
    if (rec.description) log(`   ${rec.description}`);
    if (rec.rules) {
      rec.rules.forEach(rule => log(`   • ${rule}`));
    }
    if (rec.requirements) {
      rec.requirements.forEach(req => log(`   • ${req}`));
    }
    if (rec.services) {
      rec.services.forEach(svc => log(`   • ${svc.file}: ${svc.issues.join(', ')}`));
    }
  }
}

function applyStandardization() {
  log('\n🔧 Applying standardization fixes...');
  
  const fixes = generateStandardizationScript();
  let appliedFixes = 0;
  
  for (const fix of fixes) {
    try {
      const content = fs.readFileSync(fix.file, 'utf8');
      const newContent = content + fix.code;
      
      // Backup original file
      const backupPath = fix.file + '.backup';
      fs.writeFileSync(backupPath, content);
      
      // Apply fix
      fs.writeFileSync(fix.file, newContent);
      
      log(`✅ Applied ${fix.action} to ${path.basename(fix.file)}`);
      appliedFixes++;
    } catch (error) {
      log(`❌ Failed to apply fix to ${path.basename(fix.file)}: ${error.message}`, 'error');
    }
  }
  
  log(`\n🎉 Applied ${appliedFixes} standardization fixes`);
  return appliedFixes;
}

// Main execution
function runStandardization() {
  log('🚀 Starting Export Pattern Standardization...');
  
  analyzeAllServices();
  generateRecommendations();
  printAnalysisReport();
  
  const appliedFixes = applyStandardization();
  
  log('\n📊 Standardization Summary:');
  log(`✅ Services analyzed: ${analysis.services.length}`);
  log(`🔧 Fixes applied: ${appliedFixes}`);
  log(`⚠️  Remaining issues: ${Math.max(0, analysis.patterns.inconsistencies.length - appliedFixes)}`);
  
  if (analysis.patterns.inconsistencies.length === 0 || appliedFixes > 0) {
    log('\n🎉 Export pattern standardization completed successfully!');
    return true;
  } else {
    log('\n⚠️  Some issues remain. Manual review may be required.');
    return false;
  }
}

// Run standardization
const success = runStandardization();
process.exit(success ? 0 : 1);
