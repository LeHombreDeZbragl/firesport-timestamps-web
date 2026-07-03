// Global test environment. Runs before any test module is imported, so these
// env vars are in place when app.ts / the routers evaluate at import time.
//
// The suite never talks to a real database: `services/supabaseClient` is mocked
// in every route test. These vars only satisfy the non-DB config (test mode,
// admin write access, JWT signing) so the app boots without secrets.

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret';
process.env['ADMIN_SECRET'] = 'test-admin-secret';
process.env['LOG_LEVEL'] = 'silent';
