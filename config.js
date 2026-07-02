// just-ate — runtime config, environment-aware.
//
// Two Supabase projects keep test and prod data fully separate:
//   prod → the GitHub Pages site        (Supabase project: just-ate)
//   dev  → http://localhost:8000        (Supabase project: just-ate-dev)
// The environment is picked by hostname, so a local dev session can never
// read or write production data — there is nothing to remember.
//
// NOTE: anon keys are PUBLIC by design (they ship to every browser anyway).
// They grant nothing by themselves — row level security in each database
// decides what each signed-in user can see. Safe to commit.

const CONFIGS = {
  prod: {
    supabaseUrl: 'https://hhqqjjndnzupqdrutwex.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocXFqam5kbnp1cHFkcnV0d2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODQyNTMsImV4cCI6MjA5ODU2MDI1M30.T4EN7fBzkUiV5NArXafUpT1nRGK1elB1lDQzLk2BgWo',
  },
  dev: {
    supabaseUrl: 'https://zhmztlzefkajfnuevcxc.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpobXp0bHplZmthamZudWV2Y3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTkwODEsImV4cCI6MjA5ODU5NTA4MX0.bnVDSApxEFCSVp0wYuoi71ezdLpqmg6CR6x4sA8svN4',
  },
};

const IS_DEV_HOST = ['localhost', '127.0.0.1'].includes(location.hostname);
const CONFIG = {
  env: IS_DEV_HOST ? 'dev' : 'prod',
  ...(IS_DEV_HOST ? CONFIGS.dev : CONFIGS.prod),
};
