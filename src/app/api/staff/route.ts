import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getAssignedStaffIds, embedStaffIdsInNotes } from '@/lib/staff-assignments';

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
      const { full_name, email, password, role = 'staff', assigned_member_ids = [], auto_assign_male = false, auto_assign_female = false } = body;

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

      // Upsert profile record to ensure profile exists with gender auto assign flags
      const profileData: Record<string, any> = {
        id: createdUserId,
        full_name,
        email,
        role,
        auto_assign_male: Boolean(auto_assign_male),
        auto_assign_female: Boolean(auto_assign_female),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (profileError) {
        console.error('Error upserting profile with auto-assign flags, falling back:', profileError);
        // Fallback if auto_assign columns don't exist yet
        delete profileData.auto_assign_male;
        delete profileData.auto_assign_female;
        await supabase.from('profiles').upsert(profileData);
      }

      // Assign members if any were selected
      if (Array.isArray(assigned_member_ids) && assigned_member_ids.length > 0) {
        const { data: targetMembers } = await supabase
          .from('members')
          .select('*')
          .in('id', assigned_member_ids);

        if (targetMembers) {
          for (const m of targetMembers) {
            const currentArr = getAssignedStaffIds(m);
            if (!currentArr.includes(createdUserId)) {
              currentArr.push(createdUserId);
            }
            const primary = m.assigned_staff_id || createdUserId;
            const updatedNotes = embedStaffIdsInNotes(m.notes, currentArr);

            const { error: err } = await supabase
              .from('members')
              .update({ assigned_staff_ids: currentArr, assigned_staff_id: primary, notes: updatedNotes })
              .eq('id', m.id);

            if (err) {
              await supabase
                .from('members')
                .update({ assigned_staff_id: primary, notes: updatedNotes })
                .eq('id', m.id);
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        user: { id: createdUserId, full_name, email, role },
        assignedCount: assigned_member_ids.length,
      });
    }

    if (action === 'update_assignments') {
      const { staff_id, assigned_member_ids = [], auto_assign_male, auto_assign_female } = body;

      if (!staff_id) {
        return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });
      }

      // Update profile gender auto assign flags if provided
      if (typeof auto_assign_male !== 'undefined' || typeof auto_assign_female !== 'undefined') {
        const updateObj: Record<string, any> = {};
        if (typeof auto_assign_male !== 'undefined') updateObj.auto_assign_male = Boolean(auto_assign_male);
        if (typeof auto_assign_female !== 'undefined') updateObj.auto_assign_female = Boolean(auto_assign_female);

        const { error: updateProfileErr } = await supabase
          .from('profiles')
          .update(updateObj)
          .eq('id', staff_id);

        if (updateProfileErr) {
          // Columns may not exist yet — store flags in section_access as JSON fallback
          console.error('Error updating staff profile auto assign flags (will use fallback):', updateProfileErr.message);
          try {
            const flagsJson = JSON.stringify({
              auto_assign_male: Boolean(auto_assign_male),
              auto_assign_female: Boolean(auto_assign_female),
            });
            await supabase
              .from('profiles')
              .update({ section_access: `auto_assign:${flagsJson}` })
              .eq('id', staff_id);
          } catch (fbErr) {
            console.error('Fallback also failed:', fbErr);
          }
        }
      }

      // Update member assignments for staff_id supporting multi-staff assignments
      const { data: allCurrentMembers } = await supabase
        .from('members')
        .select('*');

      if (allCurrentMembers) {
        for (const m of allCurrentMembers) {
          const currentArr = getAssignedStaffIds(m);
          const isSelected = assigned_member_ids.includes(m.id);
          const hasStaff = currentArr.includes(staff_id);

          if (isSelected && !hasStaff) {
            const nextArr = [...currentArr, staff_id];
            const primary = m.assigned_staff_id || staff_id;
            const updatedNotes = embedStaffIdsInNotes(m.notes, nextArr);

            const { error: err } = await supabase
              .from('members')
              .update({ assigned_staff_ids: nextArr, assigned_staff_id: primary, notes: updatedNotes })
              .eq('id', m.id);

            if (err) {
              await supabase
                .from('members')
                .update({ assigned_staff_id: primary, notes: updatedNotes })
                .eq('id', m.id);
            }
          } else if (!isSelected && hasStaff) {
            const nextArr = currentArr.filter((id) => id !== staff_id);
            const primary = m.assigned_staff_id === staff_id ? (nextArr[0] || null) : m.assigned_staff_id;
            const updatedNotes = embedStaffIdsInNotes(m.notes, nextArr);

            const { error: err } = await supabase
              .from('members')
              .update({ assigned_staff_ids: nextArr, assigned_staff_id: primary, notes: updatedNotes })
              .eq('id', m.id);

            if (err) {
              await supabase
                .from('members')
                .update({ assigned_staff_id: primary, notes: updatedNotes })
                .eq('id', m.id);
            }
          }
        }
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
      const { data: membersToClean } = await supabaseAdmin
        .from('members')
        .select('*');

      if (membersToClean) {
        for (const m of membersToClean) {
          const currentArr = getAssignedStaffIds(m);
          if (currentArr.includes(staff_id)) {
            const nextArr = currentArr.filter((id) => id !== staff_id);
            const primary = m.assigned_staff_id === staff_id ? (nextArr[0] || null) : m.assigned_staff_id;
            const updatedNotes = embedStaffIdsInNotes(m.notes, nextArr);

            const { error: err } = await supabaseAdmin
              .from('members')
              .update({ assigned_staff_ids: nextArr, assigned_staff_id: primary, notes: updatedNotes })
              .eq('id', m.id);

            if (err) {
              await supabaseAdmin
                .from('members')
                .update({ assigned_staff_id: primary, notes: updatedNotes })
                .eq('id', m.id);
            }
          }
        }
      }

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
