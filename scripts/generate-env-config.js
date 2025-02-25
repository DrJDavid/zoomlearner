// This script uses ESM syntax
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory (ESM replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For debug purposes
console.log('Current directory:', __dirname);
console.log('All environment variables:', Object.keys(process.env));

// Function to get environment variable value, trying different naming conventions
function getEnvVar(name) {
  // Try with VITE_ prefix
  if (process.env[`VITE_${name}`]) {
    console.log(`Found ${name} with VITE_ prefix`);
    return process.env[`VITE_${name}`];
  }
  
  // Try without prefix
  if (process.env[name]) {
    console.log(`Found ${name} without prefix`);
    return process.env[name];
  }
  
  console.log(`Could not find ${name} in environment variables`);
  return '';
}

try {
  // Get environment variables
  const supabaseUrl = getEnvVar('SUPABASE_URL');
  const supabaseKey = getEnvVar('SUPABASE_ANON_KEY');
  
  console.log('Supabase URL available:', !!supabaseUrl);
  console.log('Supabase Key available:', !!supabaseKey);

  // Define the environment config content
  const envConfigContent = `// Generated at build time: ${new Date().toISOString()}
window.__ENV = window.__ENV || {};
window.__ENV.VITE_SUPABASE_URL = '${supabaseUrl}';
window.__ENV.VITE_SUPABASE_ANON_KEY = '${supabaseKey}';
console.log('Runtime environment variables loaded from env-config.js');`;

  // Create and write to the public directory
  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('Created public directory:', publicDir);
  }
  
  const envConfigPath = path.resolve(publicDir, 'env-config.js');
  fs.writeFileSync(envConfigPath, envConfigContent);
  console.log('Environment config generated successfully at', envConfigPath);
  
  // Also try to write to the dist directory if it exists
  const distDir = path.resolve(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    const distEnvConfigPath = path.resolve(distDir, 'env-config.js');
    fs.writeFileSync(distEnvConfigPath, envConfigContent);
    console.log('Also wrote environment config to', distEnvConfigPath);
  } else {
    console.log('Dist directory does not exist yet, skipping second write');
  }
  
} catch (error) {
  console.error('Error generating environment config:', error);
  process.exit(1);
} 