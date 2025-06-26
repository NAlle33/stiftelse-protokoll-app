#!/usr/bin/env node

/**
 * Network Diagnostics Script för SÖKA Stiftelsemötesapp
 * 
 * Detta script diagnostiserar nätverksproblem på Android-enheter och andra plattformar:
 * - Kontrollerar Supabase-konfiguration och anslutning
 * - Testar nätverksanslutning och DNS-upplösning
 * - Validerar miljövariabler och API-nycklar
 * - Genererar detaljerad felsökningsrapport på svenska
 */

const https = require('https');
const http = require('http');
const dns = require('dns');
const { promisify } = require('util');

// Promisify DNS functions
const dnsLookup = promisify(dns.lookup);
const dnsResolve = promisify(dns.resolve);

// ANSI color codes för terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(emoji, message, color = 'reset') {
  console.log(`${emoji} ${colorize(message, color)}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(colorize(title, 'bright'));
  console.log('='.repeat(60));
}

async function checkEnvironmentVariables() {
  logSection('🔧 MILJÖVARIABEL-KONTROLL');
  
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_AZURE_SPEECH_KEY',
    'EXPO_PUBLIC_AZURE_SPEECH_REGION',
    'EXPO_PUBLIC_AZURE_OPENAI_KEY',
    'EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT'
  ];

  const results = {};
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    const isSet = !!value;
    const isPlaceholder = value && (value.includes('your-') || value.includes('placeholder'));
    
    results[varName] = {
      isSet,
      isPlaceholder,
      hasValue: isSet && !isPlaceholder,
      maskedValue: value ? value.substring(0, 10) + '...' : 'Ej inställd'
    };

    if (results[varName].hasValue) {
      log('✅', `${varName}: ${results[varName].maskedValue}`, 'green');
    } else if (isPlaceholder) {
      log('⚠️ ', `${varName}: Placeholder-värde detekterat`, 'yellow');
    } else {
      log('❌', `${varName}: Ej inställd`, 'red');
    }
  }

  return results;
}

async function testDNSResolution(hostname) {
  try {
    const addresses = await dnsLookup(hostname);
    log('✅', `DNS-upplösning för ${hostname}: ${addresses.address}`, 'green');
    return { success: true, address: addresses.address };
  } catch (error) {
    log('❌', `DNS-upplösning misslyckades för ${hostname}: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testHTTPSConnection(url, timeout = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const request = https.get(url, { timeout }, (response) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      log('✅', `HTTPS-anslutning till ${url}: ${response.statusCode} (${responseTime}ms)`, 'green');
      resolve({ 
        success: true, 
        statusCode: response.statusCode, 
        responseTime,
        headers: response.headers 
      });
    });

    request.on('error', (error) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      log('❌', `HTTPS-anslutning misslyckades till ${url}: ${error.message} (${responseTime}ms)`, 'red');
      resolve({ 
        success: false, 
        error: error.message, 
        responseTime 
      });
    });

    request.on('timeout', () => {
      request.destroy();
      log('⏱️ ', `HTTPS-anslutning timeout till ${url} (${timeout}ms)`, 'yellow');
      resolve({ 
        success: false, 
        error: 'Timeout', 
        responseTime: timeout 
      });
    });
  });
}

async function testSupabaseConnection(supabaseUrl, apiKey) {
  logSection('🗄️  SUPABASE-ANSLUTNINGSTEST');
  
  if (!supabaseUrl || !apiKey) {
    log('❌', 'Supabase URL eller API-nyckel saknas', 'red');
    return { success: false, error: 'Konfiguration saknas' };
  }

  if (supabaseUrl.includes('your-') || apiKey.includes('your-')) {
    log('⚠️ ', 'Placeholder-värden detekterade i Supabase-konfiguration', 'yellow');
    return { success: false, error: 'Placeholder-värden' };
  }

  try {
    // Extrahera hostname från URL
    const hostname = new URL(supabaseUrl).hostname;
    
    // Testa DNS-upplösning
    const dnsResult = await testDNSResolution(hostname);
    if (!dnsResult.success) {
      return { success: false, error: 'DNS-upplösning misslyckades', details: dnsResult };
    }

    // Testa grundläggande HTTPS-anslutning
    const httpsResult = await testHTTPSConnection(supabaseUrl);
    if (!httpsResult.success) {
      return { success: false, error: 'HTTPS-anslutning misslyckades', details: httpsResult };
    }

    // Testa Supabase REST API
    const authUrl = `${supabaseUrl}/auth/v1/settings`;
    const authResult = await testHTTPSConnection(authUrl);
    
    if (authResult.success) {
      log('✅', 'Supabase REST API är tillgängligt', 'green');
    } else {
      log('⚠️ ', 'Supabase REST API kan vara otillgängligt', 'yellow');
    }

    return { 
      success: true, 
      dnsResult, 
      httpsResult, 
      authResult,
      projectId: hostname.split('.')[0]
    };

  } catch (error) {
    log('❌', `Fel vid Supabase-anslutningstest: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testAzureServices() {
  logSection('☁️  AZURE-TJÄNSTER TEST');
  
  const speechKey = process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY;
  const speechRegion = process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION;
  const openaiKey = process.env.EXPO_PUBLIC_AZURE_OPENAI_KEY;
  
  const results = {};

  // Testa Azure Speech Service
  if (speechKey && speechRegion && !speechKey.includes('your-')) {
    const speechUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`;
    results.speech = await testHTTPSConnection(speechUrl);
    
    if (results.speech.success) {
      log('✅', `Azure Speech Service (${speechRegion}) är tillgängligt`, 'green');
    } else {
      log('❌', `Azure Speech Service (${speechRegion}) är otillgängligt`, 'red');
    }
  } else {
    log('⚠️ ', 'Azure Speech Service ej konfigurerat', 'yellow');
    results.speech = { success: false, error: 'Ej konfigurerat' };
  }

  // Testa Azure OpenAI
  if (openaiKey && !openaiKey.includes('your-')) {
    const openaiUrl = 'https://stiftelse.openai.azure.com/openai/deployments?api-version=2023-12-01-preview';
    results.openai = await testHTTPSConnection(openaiUrl);
    
    if (results.openai.success) {
      log('✅', 'Azure OpenAI är tillgängligt', 'green');
    } else {
      log('❌', 'Azure OpenAI är otillgängligt', 'red');
    }
  } else {
    log('⚠️ ', 'Azure OpenAI ej konfigurerat', 'yellow');
    results.openai = { success: false, error: 'Ej konfigurerat' };
  }

  return results;
}

async function generateDiagnosticReport() {
  logSection('📊 DIAGNOSTIKRAPPORT');
  
  const timestamp = new Date().toISOString();
  const platform = process.platform;
  const nodeVersion = process.version;
  
  log('📅', `Tidsstämpel: ${timestamp}`, 'cyan');
  log('💻', `Plattform: ${platform}`, 'cyan');
  log('🟢', `Node.js version: ${nodeVersion}`, 'cyan');
  
  // Kontrollera miljövariabler
  const envResults = await checkEnvironmentVariables();
  
  // Testa Supabase-anslutning
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseResults = await testSupabaseConnection(supabaseUrl, supabaseKey);
  
  // Testa Azure-tjänster
  const azureResults = await testAzureServices();
  
  // Generera rekommendationer
  logSection('💡 REKOMMENDATIONER');
  
  const recommendations = [];
  
  if (!envResults.EXPO_PUBLIC_SUPABASE_URL?.hasValue) {
    recommendations.push('🔧 Konfigurera EXPO_PUBLIC_SUPABASE_URL med korrekt Supabase projekt-URL');
  }
  
  if (!envResults.EXPO_PUBLIC_SUPABASE_ANON_KEY?.hasValue) {
    recommendations.push('🔑 Konfigurera EXPO_PUBLIC_SUPABASE_ANON_KEY med giltig API-nyckel');
  }
  
  if (!supabaseResults.success) {
    if (supabaseResults.error === 'Placeholder-värden') {
      recommendations.push('⚡ Aktivera Supabase-projektet "protokoll-app" (pbixoirdtwajlsgqqeoq)');
      recommendations.push('🔑 Hämta riktiga API-nycklar från Supabase-projektinställningar');
    } else if (supabaseResults.error === 'DNS-upplösning misslyckades') {
      recommendations.push('🌐 Kontrollera internetanslutning och DNS-inställningar');
    } else {
      recommendations.push('🔧 Kontrollera Supabase-projektstatus och nätverksanslutning');
    }
  }
  
  if (!azureResults.speech?.success && envResults.EXPO_PUBLIC_AZURE_SPEECH_KEY?.hasValue) {
    recommendations.push('🎤 Kontrollera Azure Speech Service-konfiguration och region');
  }
  
  if (recommendations.length === 0) {
    log('🎉', 'Alla tjänster verkar vara korrekt konfigurerade!', 'green');
  } else {
    recommendations.forEach((rec, index) => {
      log(`${index + 1}.`, rec, 'yellow');
    });
  }
  
  return {
    timestamp,
    platform,
    nodeVersion,
    environment: envResults,
    supabase: supabaseResults,
    azure: azureResults,
    recommendations
  };
}

// Huvudfunktion
async function main() {
  console.log(colorize('🔍 SÖKA Stiftelsemötesapp - Nätverksdiagnostik', 'bright'));
  console.log(colorize('=====================================================', 'bright'));
  
  try {
    const report = await generateDiagnosticReport();
    
    logSection('✅ DIAGNOSTIK SLUTFÖRD');
    log('📋', 'Detaljerad rapport genererad', 'green');
    log('🔧', 'Följ rekommendationerna ovan för att lösa identifierade problem', 'cyan');
    
  } catch (error) {
    logSection('❌ DIAGNOSTIKFEL');
    log('💥', `Fel vid diagnostik: ${error.message}`, 'red');
    console.error(error);
  }
}

// Kör diagnostik
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateDiagnosticReport, testSupabaseConnection, testAzureServices };
