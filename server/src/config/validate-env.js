/**
 * Environment variable validation
 * Ensures all required environment variables are present before app starts
 */

export function validateEnvironment() {
  const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'NODE_ENV',
  ];

  const optionalVars = [
    'PORT',
    'AI_SERVICE_URL',
    'FRONTEND_URL',
    'RATE_LIMIT_MAX',
    'GEMINI_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];

  const missing = [];
  const warnings = [];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  optionalVars.forEach((varName) => {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Missing optional environment variables (may affect some features):');
    warnings.forEach((v) => console.warn(`   - ${v}`));
  }

  // Validate JWT_SECRET strength (production only)
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret.length < 32) {
      console.error('❌ JWT_SECRET must be at least 32 characters in production');
      process.exit(1);
    }
  }

  console.log('✅ Environment variables validated');
}

export function validateMongoDBURI() {
  const uri = process.env.MONGODB_URI;
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    console.error('❌ Invalid MONGODB_URI format. Must start with mongodb:// or mongodb+srv://');
    process.exit(1);
  }
  if (uri.includes('localhost') && process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot use localhost MongoDB in production');
    process.exit(1);
  }
  console.log('✅ MongoDB URI format validated');
}
