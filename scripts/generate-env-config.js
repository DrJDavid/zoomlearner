// This script uses ESM syntax
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory (ESM replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For debug purposes
console.log('Current directory:', __dirname);
console.log('Environment variables available:', Object.keys(process.env).filter(key => key.startsWith('VITE_')));

try {
  // Create directory if it doesn't exist
  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('Created public directory:', publicDir);
  }

  // Define the environment config content
  const envConfigContent = `// Generated at build time: ${new Date().toISOString()}
window.__ENV = window.__ENV || {};
window.__ENV.VITE_SUPABASE_URL = '${process.env.VITE_SUPABASE_URL || ''}';
window.__ENV.VITE_SUPABASE_ANON_KEY = '${process.env.VITE_SUPABASE_ANON_KEY || ''}';
console.log('Runtime environment variables loaded successfully');`;

  // Write the config file
  const envConfigPath = path.resolve(publicDir, 'env-config.js');
  fs.writeFileSync(envConfigPath, envConfigContent);
  console.log('Environment config generated successfully at', envConfigPath);
} catch (error) {
  console.error('Error generating environment config:', error);
  process.exit(1);
} 