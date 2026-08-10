import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const action = body.action || 'create';

    if (action === 'create') {
      const { full_name, email, password, role = 'staff', assigned_member_ids = [] } = body;

      if (!full_name || !email || !password) {
        return NextResponse.json({ error: 'Full name, email, and password are required' }, { status: 400 });
      }

      let createdUserId: string | null = null;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const isServiceKeyValid = serviceRoleKey && serviceRoleKey !== 'your_service_role_key';

      if (isServiceKeyValid) {
        // Use admin client to create user with email_confirm: true (no email verification required)
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role },
        });

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 400 });
        }

        createdUserId = userData.user.id;
      } else {
        // Fallback: Use standard signUp if service key is missing
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name, role },
          },
        });

        if (signUpError) {
          return NextResponse.json({ error: signUpError.message }, { status: 400 });
        }

        createdUserId = signUpData.user?.id || null;
      }

      if (!createdUserId) {
        return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
      }

      // Upsert profile record to ensure profile exists
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: createdUserId,
          full_name,
          email,
          role,
        });

      if (profileError) {
        console.error('Error upserting profile:', profileError);
      }

      // Assign members if any were selected
      if (Array.isArray(assigned_member_ids) && assigned_member_ids.length > 0) {
        // Set assigned_staff_id for selected members
        await supabase
          .from('members')
          .update({ assigned_staff_id: createdUserId })
          .in('id', assigned_member_ids);
      }

      return NextResponse.json({
        success: true,
        user: { id: createdUserId, full_name, email, role },
        assignedCount: assigned_member_ids.length,
      });
    }

    if (action === 'update_assignments') {
      const { staff_id, assigned_member_ids = [] } = body;

      if (!staff_id) {
        return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });
      }

      // First, remove staff assignment for members currently assigned to this staff that are NOT in assigned_member_ids
      const { data: currentlyAssigned } = await supabase
        .from('members')
        .select('id')
        .eq('assigned_staff_id', staff_id);

      const currentIds = (currentlyAssigned || []).map((m: any) => m.id);
      const toRemove = currentIds.filter((id: string) => !assigned_member_ids.includes(id));

      if (toRemove.length > 0) {
        await supabase
          .from('members')
          .update({ assigned_staff_id: null })
          .in('id', toRemove);
      }

      // Next, set assigned_staff_id for selected members
      if (assigned_member_ids.length > 0) {
        await supabase
          .from('members')
          .update({ assigned_staff_id: staff_id })
          .in('id', assigned_member_ids);
      }

      return NextResponse.json({
        success: true,
        staff_id,
        assignedCount: assigned_member_ids.length,
      });
    }

    if (action === 'delete') {
      const { staff_id } = body;

      if (!staff_id) {
        return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });
      }

      // Prevent self-deletion
      if (staff_id === currentUser.id) {
        return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
      }

      // Use admin client (bypasses RLS) for all delete operations
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const isServiceKeyValid = serviceRoleKey && serviceRoleKey !== 'your_service_role_key';

      if (!isServiceKeyValid) {
        return NextResponse.json({ error: 'Service role key is not configured. Cannot delete staff.' }, { status: 500 });
      }

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Unassign all members currently assigned to this staff
      await supabaseAdmin
        .from('members')
        .update({ assigned_staff_id: null })
        .eq('assigned_staff_id', staff_id);

      // Delete profile record using admin client to bypass RLS
      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', staff_id);

      if (profileDeleteError) {
        console.error('Error deleting profile:', profileDeleteError);
        return NextResponse.json({ error: 'Failed to delete staff profile' }, { status: 500 });
      }

      // Delete auth user
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(staff_id);
      if (deleteAuthError) {
        console.error('Error deleting auth user:', deleteAuthError);
      }

      return NextResponse.json({ success: true, deleted_staff_id: staff_id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Staff API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
