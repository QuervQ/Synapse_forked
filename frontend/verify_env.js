import { loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(__dirname, '..');

console.log('--- Environment Verification ---');
console.log(`Checking for .env in: ${envDir}`);

const env = loadEnv('development', envDir, ['VITE_', 'CLOUDFLARE_']);

console.log('\nLoaded Variables:');
if (env.VITE_SUPABASE_URL) {
    console.log(`✅ VITE_SUPABASE_URL found (starts with: ${env.VITE_SUPABASE_URL.substring(0, 8)}...)`);
} else {
    console.log(`❌ VITE_SUPABASE_URL is MISSING`);
}

if (env.VITE_SUPABASE_ANON_KEY) {
    console.log(`✅ VITE_SUPABASE_ANON_KEY found (starts with: ${env.VITE_SUPABASE_ANON_KEY.substring(0, 5)}...)`);
} else {
    console.log(`❌ VITE_SUPABASE_ANON_KEY is MISSING`);
}

console.log('--------------------------------');
