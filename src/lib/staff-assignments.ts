/**
 * Helper utilities for handling multi-staff assignment on members.
 * Supports native assigned_staff_ids array column, notes embedded tags [STAFF_ASSIGNMENTS:id1,id2],
 * and fallback to single assigned_staff_id.
 */

export function getAssignedStaffIds(member: {
  assigned_staff_id?: string | null;
  assigned_staff_ids?: string[] | null;
  notes?: string | null;
}): string[] {
  if (!member) return [];

  if (Array.isArray(member.assigned_staff_ids) && member.assigned_staff_ids.length > 0) {
    return member.assigned_staff_ids;
  }

  if (member.notes && member.notes.includes('[STAFF_ASSIGNMENTS:')) {
    const match = member.notes.match(/\[STAFF_ASSIGNMENTS:([^\]]*)\]/);
    if (match && match[1]) {
      const ids = match[1].split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length > 0) return ids;
    }
  }

  if (member.assigned_staff_id) {
    return [member.assigned_staff_id];
  }

  return [];
}

export function isMemberAssignedToStaff(
  member: { assigned_staff_id?: string | null; assigned_staff_ids?: string[] | null; notes?: string | null },
  staffId: string
): boolean {
  if (!staffId || !member) return false;
  const ids = getAssignedStaffIds(member);
  return ids.includes(staffId);
}

export function embedStaffIdsInNotes(existingNotes: string | null | undefined, staffIds: string[]): string | null {
  const cleanStaffIds = Array.from(new Set((staffIds || []).filter(Boolean)));
  const tag = cleanStaffIds.length > 0 ? `[STAFF_ASSIGNMENTS:${cleanStaffIds.join(',')}]` : '';

  let notesText = existingNotes || '';
  notesText = notesText.replace(/\[STAFF_ASSIGNMENTS:[^\]]*\]/g, '').trim();

  if (!tag) return notesText || null;
  return notesText ? `${notesText}\n${tag}` : tag;
}
