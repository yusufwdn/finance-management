// ============================================================
// APP CONFIGURATION
// ============================================================
// What:  Defines the shape of our environment variables and
//        provides them in a typed, validated way using NestJS
//        ConfigModule with a factory function.
//
// Why:   Reading process.env directly everywhere is unsafe —
//        you might mistype a variable name and get undefined.
//        A config factory gives you:
//          1. A single place to manage all config keys
//          2. TypeScript types (no more `string | undefined`)
//          3. Default values for optional settings
//
// How:   This function is passed to ConfigModule.forRoot()
//        in app.module.ts as the `load` option.
// ============================================================

export default () => ({
  // ---- Application ----
  // The port the HTTP server will listen on
  // process.env.PORT comes from your .env file
  // || 3000 is the default fallback if PORT is not defined
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,

  // Node environment: 'development', 'production', or 'test'
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // ---- Database ----
  database: {
    // Full PostgreSQL connection URL
    // Example: postgresql://user:password@localhost:5432/dbname
    url: process.env.DATABASE_URL,
  },

  // ---- JWT (Authentication) ----
  jwt: {
    // The secret key used to sign JWT tokens
    // IMPORTANT: Use a long random string in production!
    secret: process.env.JWT_SECRET ?? 'change_this_secret',

    // How long a JWT token is valid before expiring
    // Examples: '15m' = 15 minutes, '1h' = 1 hour, '7d' = 7 days
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
});
