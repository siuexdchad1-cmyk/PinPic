import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const userClient = await createClient(); // Standard client with user token cookies
  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Create service role admin client ──────────────────────────────────
  // Deleting users from the Auth schema requires Supabase Admin Service Role key
  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );

  // ── 3. Delete user from auth schema (cascades to profiles & saved_shots) ─
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error('[/api/user/delete] Error deleting auth user:', deleteError.message);
    return NextResponse.json(
      { error: 'Failed to delete account from system.' },
      { status: 500 }
    );
  }

  // ── 4. Return success ──────────────────────────────────────────────────────
  return NextResponse.json({ success: true });
}
