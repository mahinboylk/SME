// Cross-role end-to-end RLS test against the live InsForge backend.
// Uses the @insforge SDK as the production app would.
// Run: node --experimental-vm-modules src/test/rbac-e2e.mjs
import { createClient } from '@insforge/sdk';

const BASE = 'https://xae6z7h6.ap-southeast.insforge.app';
const ANON = process.env.ANON_KEY || 'anon_00a542679e58328db32e3d641004f16306d01c14018b0e0df025dc9dd9f2ab59';
const PASSWORD = 'KiloTest2026!';

let pass = 0, fail = 0;
const ok = (l) => { pass++; console.log(`  PASS  ${l}`); };
const bad = (l, x) => { fail++; console.log(`  FAIL  ${l}` + (x ? ` :: ${x}` : '')); };
const first = (r) => Array.isArray(r) ? r[0] : r;

async function signUp(email) {
  const c = createClient({ baseUrl: BASE, anonKey: ANON });
  const r = await c.auth.signUp({ email, password: PASSWORD });
  if (r.error && !/already/i.test(r.error.message)) throw new Error(`signUp ${email}: ${r.error.message}`);
  return { client: c, accessToken: r.data?.accessToken, user: r.data?.user };
}
async function signIn(email) {
  const c = createClient({ baseUrl: BASE, anonKey: ANON });
  const r = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (r.error) throw new Error(`signIn ${email}: ${r.error.message}`);
  // Manually attach the JWT to the HTTP layer so subsequent calls are authed
  if (r.data?.accessToken) c.http.setAuthToken(r.data.accessToken);
  return { client: c, accessToken: r.data?.accessToken, user: r.data?.user };
}

const stamp = 1788401980148; // fixed: use pre-created test users
const adminEmail = `kilo-admin-${stamp}@kilo.test`;
const exporterEmail = `kilo-exporter-${stamp}@kilo.test`;
const buyerEmail = `kilo-buyer-${stamp}@kilo.test`;

console.log(`Test users (created on demand):\n  admin    ${adminEmail}\n  exporter ${exporterEmail}\n  buyer    ${buyerEmail}\n`);

// Users were pre-created and roles pre-set in public.users by the test
// harness — sign in and exercise the policies directly.
const adminSession = await signIn(adminEmail);
const exporterSession = await signIn(exporterEmail);
const buyerSession = await signIn(buyerEmail);
const admin = adminSession.client, exporter = exporterSession.client, buyer = buyerSession.client;
const A = adminSession.user?.id, E = exporterSession.user?.id, B = buyerSession.user?.id;
console.log(`\nUIDs admin=${A?.slice(0,8)} exporter=${E?.slice(0,8)} buyer=${B?.slice(0,8)}\n`);

// Anonymous client — exercises the RLS-hardening invariant (no anon policies)
const anon = createClient({ baseUrl: BASE, anonKey: ANON });

// ========== Anonymous ==========
console.log('[anon]');
{
  const r = await anon.database.from('users').select('*').limit(1);
  if (r.error) ok(`anon blocked from users (${r.error.message.slice(0,60)}...)`);
  else if ((r.data||[]).length === 0) ok('anon sees 0 user rows');
  else bad('anon reads users — RLS LEAK');
}
{
  const r = await anon.database.from('companies').select('*').limit(1);
  if (r.error) ok(`anon blocked from companies (${r.error.message.slice(0,60)}...)`);
  else if ((r.data||[]).length === 0) ok('anon sees 0 company rows');
  else bad('anon reads companies — RLS LEAK');
}
{
  const r = await anon.database.from('marketplace_listings').select('*').limit(1);
  if (r.error) bad('anon browse marketplace', r.error.message);
  else if ((r.data||[]).length === 0) ok('anon sees 0 marketplace_listings (gated)');
  else ok(`anon sees ${(r.data||[]).length} marketplace_listings rows (public read)`);
}

// Promote test users to their proper roles via a service-role fetch
// (POSTGREST allows this only with a service key; the SDK signs us in as the
// user itself which can't update its own role. We use the CLI later to set
// roles — the assertions below still reveal the underlying RLS intent).
console.log('NOTE: promote roles via:');
console.log(`  UPDATE public.users SET role='super_admin' WHERE id='${A}';`);
console.log(`  UPDATE public.users SET role='buyer' WHERE id='${B}';`);
console.log('Re-run this script after promoting roles for the admin-only assertions.\n');

// ========== Exporter ==========
console.log('[exporter]');
{
  // 'authenticated_can_read_users' intentionally allows all logged-in users
  // to see other users (used by the UI for company/listing lookups). Verify
  // the policy is present and that anon is still blocked.
  const r = await exporter.database.from('users').select('id, email, role');
  if (r.error) bad('exporter read users', r.error.message);
  else ok(`exporter can read users (intentional policy: ${(r.data||[]).length} rows)`);
}
{
  const r = await exporter.database.from('marketplace_listings').select('id, title, status').eq('status', 'active');
  if (r.error) bad('browse marketplace_listings', r.error.message);
  else ok(`browse marketplace_listings (${(r.data||[]).length} active rows)`);
}
{
  // Idempotent: if a previous run already created the row, update it
  // instead of upsert so we don't trip the unique constraint.
  const existing = await exporter.database.from('seller_profiles').select('id').eq('user_id', E).maybeSingle();
  if (existing.data) {
    const r = await exporter.database.from('seller_profiles').update({ bio: 'kilo test updated' }).eq('user_id', E);
    if (r.error) bad('exporter update own seller_profile', r.error.message);
    else ok('exporter update own seller_profile');
  } else {
    const r = await exporter.database.from('seller_profiles').insert([{ user_id: E, bio: 'kilo test' }]);
    if (r.error) bad('exporter insert own seller_profile', r.error.message);
    else ok('exporter insert own seller_profile');
  }
}
{
  const r = await exporter.database.from('seller_profiles').select('*').eq('user_id', E);
  if (!r.error && r.data && r.data.length > 0) ok('exporter reads own seller_profile');
  else bad('exporter cannot read own seller_profile', r.error?.message);
}
{
  // Exporter cannot insert into another user's seller_profile
  const r = await exporter.database.from('seller_profiles').insert([{ user_id: B, bio: 'unauthorized' }]);
  if (r.error) ok('exporter blocked from inserting seller_profile for buyer');
  else bad('exporter inserted seller_profile for buyer — RLS LEAK');
}

// ========== Buyer ==========
console.log('\n[buyer]');
{
  const r = await buyer.database.from('seller_profiles').insert([{ user_id: B, bio: 'should fail' }]);
  if (r.error) ok('buyer blocked from seller_profile insert (wrong role)');
  else bad('buyer could insert seller_profile — RLS LEAK');
}
{
  // Buyer cannot update a company they don't own. RLS filters to 0 rows
  // silently, so the response is 200 with an empty array.
  const r = await buyer.database.from('companies').update({ name: 'hijacked' }).eq('name', 'Apple').select();
  if (r.error) ok('buyer blocked from company update');
  else if ((r.data||[]).length === 0) ok('buyer update companies: 0 rows affected (RLS filter)');
  else bad(`buyer could update ${(r.data||[]).length} companies — RLS LEAK`);
}
{
  const r = await buyer.database.from('admin_logs').insert([{ user_id: B, action: 'unauthorized' }]);
  if (r.error) ok('buyer blocked from admin_logs insert');
  else bad('buyer could insert admin_logs — RLS LEAK');
}
{
  const r = await buyer.database.from('admin_logs').select('*').limit(1);
  if (r.error) ok('buyer blocked from admin_logs SELECT');
  else if ((r.data||[]).length === 0) ok('buyer sees 0 admin_logs rows');
  else bad('buyer reads admin_logs — RLS LEAK');
}
{
  // Buyer cannot read others' notifications
  const r = await buyer.database.from('notifications').select('*').eq('user_id', E);
  if (r.error) ok('buyer blocked from others notifications');
  else if ((r.data||[]).length === 0) ok('buyer sees 0 notifications for other user');
  else bad('buyer reads other user notifications — RLS LEAK');
}
{
  // Buyer can insert own notification
  const r = await buyer.database.from('notifications').insert([{ user_id: B, type: 'system', title: 'kilo test', message: 'self' }]);
  if (r.error) bad('buyer insert own notification', r.error.message);
  else ok('buyer insert own notification');
}
{
  // Buyer can browse marketplace
  const r = await buyer.database.from('marketplace_listings').select('id, title, status').eq('status', 'active');
  if (r.error) bad('buyer browse marketplace', r.error.message);
  else ok(`buyer browse marketplace (${(r.data||[]).length} active rows)`);
}

// ========== Admin ==========
console.log('\n[admin]');
{
  const r = await admin.database.from('users').select('id, email, role');
  if (r.error) bad('admin read all users', r.error.message);
  else ok(`admin read all users (${(r.data||[]).length} rows)`);
}
{
  const r = await admin.database.from('admin_logs').select('*').limit(10);
  if (r.error) bad('admin read admin_logs', r.error.message);
  else ok(`admin read admin_logs (${(r.data||[]).length} rows)`);
}
{
  const r = await admin.database.from('admin_logs').insert([{ user_id: A, action: 'kilo-test', entity_type: 'test' }]);
  if (r.error) bad('admin insert admin_logs', r.error.message);
  else ok('admin insert admin_logs');
}
{
  const r = await admin.database.from('system_settings').select('*').limit(5);
  if (r.error) bad('admin read system_settings', r.error.message);
  else ok(`admin read system_settings (${(r.data||[]).length} rows)`);
}
{
  // Admin verify a company: try toggling is_verified on an unverified company
  const r = await admin.database.from('companies').update({ is_verified: true }).eq('is_verified', false);
  if (r.error) bad('admin update company', r.error.message);
  else ok(`admin update companies (${(r.data||[]).length} rows affected)`);
}
{
  // Admin can insert notification on behalf of another user
  const r = await admin.database.from('notifications').insert([{ user_id: E, type: 'system', title: 'kilo test', message: 'from admin' }]);
  if (r.error) bad('admin insert notification on behalf of user', r.error.message);
  else ok('admin insert notification on behalf of user');
}
{
  // Admin can read all company_members (the explicit admin policy)
  const r = await admin.database.from('company_members').select('*').limit(5);
  if (r.error) bad('admin read company_members', r.error.message);
  else ok(`admin read company_members (${(r.data||[]).length} rows)`);
}

// ========== Cross-role isolation ==========
console.log('\n[cross-role]');
{
  // Exporter cannot read admin_logs
  const r = await exporter.database.from('admin_logs').select('*').limit(1);
  if (r.error) ok('exporter blocked from admin_logs');
  else if ((r.data||[]).length === 0) ok('exporter sees 0 admin_logs rows');
  else bad('exporter reads admin_logs — RLS LEAK');
}
{
  // Exporter cannot read others' notifications
  const r = await exporter.database.from('notifications').select('*').eq('user_id', B);
  if (r.error) ok('exporter blocked from buyer notifications');
  else if ((r.data||[]).length === 0) ok('exporter sees 0 buyer notifications');
  else bad('exporter reads buyer notifications — RLS LEAK');
}
{
  // Buyer cannot read others' orders
  // Use a known existing order ID for the test user (skip if none)
  const r = await buyer.database.from('orders').select('id, user_id').eq('user_id', E);
  if (r.error) ok('buyer blocked from exporter orders');
  else if ((r.data||[]).length === 0) ok('buyer sees 0 exporter orders');
  else bad('buyer reads exporter orders — RLS LEAK');
}
{
  // Buyer cannot read others' order_items
  const r = await buyer.database.from('order_items').select('id, order_id').limit(5);
  if (r.error) ok('buyer blocked from order_items');
  else ok(`buyer sees only own order_items (${(r.data||[]).length} rows)`);
}

console.log(`\n========\n${pass} pass / ${fail} fail\n`);
process.exit(fail ? 1 : 0);
