'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { useGymSettings } from '@/hooks/use-gym-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, Upload, Loader2, Users, Shield, Plus, Search, UserCheck, CheckSquare, Square, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { data: role } = useRole();
  const { data: settings } = useGymSettings();
  const queryClient = useQueryClient();

  const [gymName, setGymName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Staff management state
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<{ id: string; full_name: string; email: string; role: string } | null>(null);
  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', password: '', role: 'staff' });
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Fetch all profiles (staff users)
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch active members for staff assignment
  const { data: allMembers = [] } = useQuery({
    queryKey: ['members-for-assignment'],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, gender, phone, active, assigned_staff_id, photo_url')
        .eq('active', true)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Save gym settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      let logoUrl = settings?.logo_url || null;

      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `gym-logo/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('gym-assets')
          .upload(path, logoFile, { upsert: true });

        if (uploadError) {
          if (uploadError.message.includes('not found')) {
            toast.error('Storage bucket "gym-assets" not found. Please create it in Supabase dashboard.');
            setSaving(false);
            return;
          }
          throw uploadError;
        }

        const { data: urlData } = supabase.storage.from('gym-assets').getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('gym_settings')
        .update({ gym_name: gymName, logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['gym-settings'] });
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  // Update profile role
  const updateRole = useMutation({
    mutationFn: async ({ id, newRole }: { id: string; newRole: string }) => {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Role updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Open staff dialog for adding
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    setNewStaff({ full_name: '', email: '', password: '', role: 'staff' });
    setSelectedMemberIds([]);
    setMemberSearch('');
    setStaffDialogOpen(true);
  };

  // Open staff dialog for editing assignments
  const handleOpenEditAssignments = (staff: any) => {
    setEditingStaff(staff);
    // Find member IDs currently assigned to this staff
    const currentlyAssigned = allMembers
      .filter((m) => m.assigned_staff_id === staff.id)
      .map((m) => m.id);
    setSelectedMemberIds(currentlyAssigned);
    setMemberSearch('');
    setStaffDialogOpen(true);
  };

  // Save staff member (Create or Update)
  const saveStaffMutation = useMutation({
    mutationFn: async () => {
      if (editingStaff) {
        // Update member assignments for existing staff
        const res = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_assignments',
            staff_id: editingStaff.id,
            assigned_member_ids: selectedMemberIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update member assignments');
        return data;
      } else {
        // Create new staff member
        const res = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...newStaff,
            assigned_member_ids: selectedMemberIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add staff member');
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['members-for-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success(
        editingStaff
          ? 'Staff member assignments updated'
          : 'Staff member added successfully! (No email verification needed)'
      );
      setStaffDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle single member selection
  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  // Quick Select: All Male members
  const selectAllMale = () => {
    const maleIds = allMembers
      .filter((m) => (m.gender || 'male').toLowerCase() === 'male')
      .map((m) => m.id);
    setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...maleIds])));
    toast.info(`Selected all male members (${maleIds.length})`);
  };

  // Quick Select: All Female members
  const selectAllFemale = () => {
    const femaleIds = allMembers
      .filter((m) => (m.gender || '').toLowerCase() === 'female')
      .map((m) => m.id);
    setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...femaleIds])));
    toast.info(`Selected all female members (${femaleIds.length})`);
  };

  // Select all members
  const selectAll = () => {
    setSelectedMemberIds(allMembers.map((m) => m.id));
  };

  // Clear selection
  const clearAll = () => {
    setSelectedMemberIds([]);
  };

  // Filter members list by search input
  const filteredMembers = allMembers.filter((m) => {
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(q) ||
      m.phone?.toLowerCase().includes(q) ||
      m.gender?.toLowerCase().includes(q)
    );
  });

  // Calculate selected counts
  const selectedMaleCount = allMembers.filter(
    (m) => selectedMemberIds.includes(m.id) && (m.gender || 'male').toLowerCase() === 'male'
  ).length;

  const selectedFemaleCount = allMembers.filter(
    (m) => selectedMemberIds.includes(m.id) && (m.gender || '').toLowerCase() === 'female'
  ).length;

  if (role !== 'admin') return null;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold tracking-tight">Settings</h1>
      </div>

      {/* Gym Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gym Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="gym-name">Gym Name</Label>
                <Input
                  id="gym-name"
                  value={gymName || settings?.gym_name || ''}
                  onChange={(e) => setGymName(e.target.value)}
                  placeholder="Enter gym name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview || settings?.logo_url ? (
                    <img
                      src={logoPreview || settings?.logo_url || ''}
                      alt="Logo preview"
                      className="h-14 w-14 rounded-xl object-cover border border-border"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-accent grid place-items-center">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Staff Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Staff Management
          </CardTitle>
          <Button size="sm" onClick={handleOpenAddStaff}>
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Assigned Members</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Role</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profilesLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No staff users found
                    </td>
                  </tr>
                ) : (
                  profiles.map((p: any) => {
                    const assignedCount = allMembers.filter((m) => m.assigned_staff_id === p.id).length;
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                              {(p.full_name || '?').slice(0, 1).toUpperCase()}
                            </div>
                            <span className="font-medium">{p.full_name}</span>
                          </div>
                        </td>
                        <td className="p-4 hidden sm:table-cell text-muted-foreground">{p.email}</td>
                        <td className="p-4">
                          <Badge variant="outline" className="gap-1.5 font-normal">
                            <UserCheck className="h-3.5 w-3.5 text-primary" />
                            {assignedCount} Member{assignedCount !== 1 ? 's' : ''}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={p.role === 'admin' ? 'default' : 'secondary'} className="gap-1">
                            <Shield className="h-3 w-3" /> {p.role}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => handleOpenEditAssignments(p)}
                              title="Assign/Manage Members"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Members
                            </Button>
                            <Select
                              value={p.role}
                              onValueChange={(v) => updateRole.mutate({ id: p.id, newRole: v })}
                            >
                              <SelectTrigger className="w-28 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Staff & Member Assignment Dialog */}
      <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? `Assign Members for ${editingStaff.full_name}` : 'Add Staff Member'}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveStaffMutation.mutate();
            }}
            className="space-y-6"
          >
            {/* Account Information (Only required when adding new staff) */}
            {!editingStaff && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Full Name *</Label>
                  <Input
                    required
                    value={newStaff.full_name}
                    onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email * </Label>
                  <Input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    placeholder="ahmed@gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Role</Label>
                  <Select value={newStaff.role} onValueChange={(v) => setNewStaff({ ...newStaff, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Member Assignment Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" /> Assign Members
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Select members that belong to this staff. Only assigned members will show on their member page.
                  </p>
                </div>

                {/* Counter Badge */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-2.5 py-1 text-xs">
                    {selectedMemberIds.length} Selected ({selectedMaleCount} Male, {selectedFemaleCount} Female)
                  </Badge>
                </div>
              </div>

              {/* Quick Select Buttons & Search */}
              <div className="space-y-3 bg-card p-3 rounded-xl border border-border">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Quick Select:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                    onClick={selectAllMale}
                  >
                    All Male
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-pink-500/30 text-pink-600 dark:text-pink-400 hover:bg-pink-500/10"
                    onClick={selectAllFemale}
                  >
                    All Female
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={selectAll}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearAll}
                  >
                    Clear
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members by name, phone or gender..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Members Checklist */}
              <div className="max-h-64 overflow-y-auto border border-border rounded-xl divide-y divide-border/40">
                {filteredMembers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No active members found matching "{memberSearch}"
                  </div>
                ) : (
                  filteredMembers.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    const gender = (m.gender || 'male').toLowerCase();
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMemberSelection(m.id)}
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-accent/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button type="button" className="text-primary focus:outline-none">
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 fill-primary text-primary-foreground" />
                            ) : (
                              <Square className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{m.full_name}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 capitalize ${
                                  gender === 'female'
                                    ? 'border-pink-500/40 text-pink-500 bg-pink-500/5'
                                    : 'border-blue-500/40 text-blue-500 bg-blue-500/5'
                                }`}
                              >
                                {gender}
                              </Badge>
                            </div>
                            {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                          </div>
                        </div>

                        {m.assigned_staff_id && m.assigned_staff_id !== editingStaff?.id && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            Assigned to another staff
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStaffDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveStaffMutation.isPending}>
                {saveStaffMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingStaff ? 'Save Assignments' : 'Add Staff Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
