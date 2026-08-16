'use client';
export const dynamic = 'force-dynamic';
import { useState, useRef, useEffect } from 'react';
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
import { Settings, Save, Upload, Loader2, Users, Shield, Plus, Search, UserCheck, CheckSquare, Square, Pencil, Trash2, Camera, User, X, Globe, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import OnePagerCustomizer from '@/components/settings/one-pager-customizer';

import { isMemberAssignedToStaff } from '@/lib/staff-assignments';

export default function SettingsPage() {
  const { data: role } = useRole();
  const { data: settings } = useGymSettings();
  const queryClient = useQueryClient();

  const [settingsTab, setSettingsTab] = useState<'general' | 'one-pager'>('general');


  const [gymName, setGymName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Staff management state
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', password: '', role: 'staff', photo_url: null as string | null });
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [autoAssignMale, setAutoAssignMale] = useState(false);
  const [autoAssignFemale, setAutoAssignFemale] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [deleteConfirmStaff, setDeleteConfirmStaff] = useState<{ id: string; full_name: string } | null>(null);

  // Staff photo camera & device upload state
  const [isStaffCameraActive, setIsStaffCameraActive] = useState(false);
  const staffVideoRef = useRef<HTMLVideoElement>(null);
  const staffStreamRef = useRef<MediaStream | null>(null);
  const staffFileInputRef = useRef<HTMLInputElement>(null);

  const stopStaffCamera = () => {
    if (staffStreamRef.current) {
      staffStreamRef.current.getTracks().forEach((track) => track.stop());
      staffStreamRef.current = null;
    }
    setIsStaffCameraActive(false);
  };

  const startStaffCamera = async () => {
    try {
      stopStaffCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400, facingMode: 'user' } });
      staffStreamRef.current = mediaStream;
      if (staffVideoRef.current) {
        staffVideoRef.current.srcObject = mediaStream;
      }
      setIsStaffCameraActive(true);
    } catch (err) {
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  useEffect(() => {
    if (isStaffCameraActive && staffVideoRef.current && staffStreamRef.current) {
      staffVideoRef.current.srcObject = staffStreamRef.current;
    }
  }, [isStaffCameraActive]);

  useEffect(() => {
    if (!staffDialogOpen) {
      stopStaffCamera();
    }
  }, [staffDialogOpen]);

  const captureStaffPhoto = () => {
    if (!staffVideoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = staffVideoRef.current.videoWidth || 300;
    canvas.height = staffVideoRef.current.videoHeight || 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(staffVideoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setNewStaff((prev) => ({ ...prev, photo_url: dataUrl }));
      stopStaffCamera();
      toast.success('Photo captured!');
    }
  };

  const handleStaffFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setNewStaff((prev) => ({ ...prev, photo_url: dataUrl }));
        stopStaffCamera();
        toast.success('Image selected from device');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Fetch all profiles (staff + admin)
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch active members for staff assignment
  const { data: allMembers = [] } = useQuery({
    queryKey: ['members-for-assignment'],
    enabled: role === 'admin',
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('active', true)
          .order('full_name', { ascending: true });
        if (error) {
          console.error('Error fetching members for assignment:', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error('Failed to fetch members for assignment:', err);
        return [];
      }
    },
  });

  // Save gym settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      let logoUrl = settings?.logo_url || null;
      const targetGymName = gymName.trim() || settings?.gym_name || 'Iron Lodge Gym';

      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const timestamp = Date.now();
        const path = `gym-logo/logo_${timestamp}.${ext}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('gym-assets')
            .upload(path, logoFile, { upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('gym-assets').getPublicUrl(path);
            logoUrl = urlData.publicUrl;
          } else {
            // Base64 fallback if storage bucket missing or error
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(logoFile);
            });
            logoUrl = base64;
          }
        } catch {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(logoFile);
          });
          logoUrl = base64;
        }
      }

      const { error } = await supabase
        .from('gym_settings')
        .update({ gym_name: targetGymName, logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['gym-settings'] });
      queryClient.invalidateQueries({ queryKey: ['public-gym-settings'] });
      toast.success('Settings saved successfully');
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
    setNewStaff({ full_name: '', email: '', password: '', role: 'staff', photo_url: null });
    setSelectedMemberIds([]);
    setAutoAssignMale(false);
    setAutoAssignFemale(false);
    setMemberSearch('');
    stopStaffCamera();
    setStaffDialogOpen(true);
  };

  // Open staff dialog for editing assignments
  const handleOpenEditAssignments = (staff: any) => {
    setEditingStaff(staff);
    // Find member IDs currently assigned to this staff
    const currentlyAssigned = allMembers
      .filter((m: any) => isMemberAssignedToStaff(m, staff.id))
      .map((m) => m.id);
    setSelectedMemberIds(currentlyAssigned);

    // Read auto-assign flags: first try native columns, then section_access fallback
    let autoMale = Boolean(staff.auto_assign_male);
    let autoFemale = Boolean(staff.auto_assign_female);
    if (!autoMale && !autoFemale && typeof staff.section_access === 'string' && staff.section_access.startsWith('auto_assign:')) {
      try {
        const parsed = JSON.parse(staff.section_access.replace('auto_assign:', ''));
        autoMale = Boolean(parsed.auto_assign_male);
        autoFemale = Boolean(parsed.auto_assign_female);
      } catch { /* ignore */ }
    }
    setAutoAssignMale(autoMale);
    setAutoAssignFemale(autoFemale);
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
            auto_assign_male: autoAssignMale,
            auto_assign_female: autoAssignFemale,
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
            auto_assign_male: autoAssignMale,
            auto_assign_female: autoAssignFemale,
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

  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', staff_id: staffId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete staff member');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['members-for-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Staff member deleted successfully');
      setDeleteConfirmStaff(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteConfirmStaff(null);
    },
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
    setAutoAssignMale(true);
    toast.info(`Selected all male members (${maleIds.length}) & enabled auto-assign for future Male members`);
  };

  // Quick Select: All Female members
  const selectAllFemale = () => {
    const femaleIds = allMembers
      .filter((m) => (m.gender || '').toLowerCase() === 'female')
      .map((m) => m.id);
    setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...femaleIds])));
    setAutoAssignFemale(true);
    toast.info(`Selected all female members (${femaleIds.length}) & enabled auto-assign for future Female members`);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Settings</h1>
        </div>

        {/* Tab Selection Switcher */}
        <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-xl border border-border">
          <Button
            type="button"
            variant={settingsTab === 'general' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSettingsTab('general')}
            className="gap-2 font-semibold text-xs"
          >
            <Settings className="h-4 w-4" />
            General & Staff
          </Button>
          <Button
            type="button"
            variant={settingsTab === 'one-pager' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSettingsTab('one-pager')}
            className={`gap-2 font-semibold text-xs transition-all ${
              settingsTab === 'one-pager'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'hover:text-primary'
            }`}
          >
            <Globe className="h-4 w-4 text-primary" />
            One-Pager Customizer
          </Button>
        </div>
      </div>

      {settingsTab === 'one-pager' ? (
        <OnePagerCustomizer />
      ) : (
        <>
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
                      className="h-14 w-14 rounded-xl object-contain border border-border bg-slate-100 dark:bg-slate-800 p-1"
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

      {/* Staff & Admin Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Staff &amp; Admin Management
          </CardTitle>
          <Button size="sm" onClick={handleOpenAddStaff}>
            <Plus className="h-4 w-4" /> Add Account
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
                    const assignedCount = allMembers.filter((m: any) => isMemberAssignedToStaff(m, p.id)).length;
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.full_name} className="h-8 w-8 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                                {(p.full_name || '?').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium">{p.full_name}</span>
                          </div>
                        </td>
                        <td className="p-4 hidden sm:table-cell text-muted-foreground">{p.email}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant="outline" className="gap-1.5 font-normal">
                              <UserCheck className="h-3.5 w-3.5 text-primary" />
                              {assignedCount} Member{assignedCount !== 1 ? 's' : ''}
                            </Badge>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {p.auto_assign_male && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                                  Auto: Male
                                </Badge>
                              )}
                              {p.auto_assign_female && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-pink-500/40 text-pink-600 dark:text-pink-400 bg-pink-500/10">
                                  Auto: Female
                                </Badge>
                              )}
                            </div>
                          </div>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirmStaff({ id: p.id, full_name: p.full_name })}
                              title="Delete Staff"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
        </>
      )}

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
                {/* Photo / Avatar Capture & Select */}
                <div className="sm:col-span-2 flex flex-col items-center justify-center p-3 bg-muted/40 rounded-lg border border-border/60 gap-3">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-primary/40 bg-slate-100 dark:bg-slate-800 shadow-inner grid place-items-center">
                    {isStaffCameraActive ? (
                      <video ref={staffVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    ) : newStaff.photo_url ? (
                      <img src={newStaff.photo_url} alt="Staff Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2">
                        <User className="h-10 w-10 mx-auto text-muted-foreground opacity-40 mb-1" />
                        <p className="text-[10px] text-muted-foreground">No photo set</p>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={staffFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleStaffFileUpload}
                  />

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {isStaffCameraActive ? (
                      <>
                        <Button type="button" size="sm" onClick={captureStaffPhoto} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                          <Camera className="h-4 w-4" /> Capture Photo
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={stopStaffCamera}>
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={startStaffCamera} className="gap-1.5">
                          <Camera className="h-4 w-4" /> {newStaff.photo_url ? 'Retake Photo' : 'Open Webcam'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => staffFileInputRef.current?.click()} className="gap-1.5">
                          <Upload className="h-4 w-4" /> Select from Device
                        </Button>
                        {newStaff.photo_url && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setNewStaff((prev) => ({ ...prev, photo_url: null }))}
                          >
                            Remove Photo
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

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

              {/* Auto Assign Options */}
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 space-y-2">
                <p className="text-xs font-semibold text-primary">Auto-Assignment Rules for Future Members:</p>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoAssignMale}
                      onChange={(e) => setAutoAssignMale(e.target.checked)}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                    />
                    <span className="font-medium text-foreground">Auto-assign future Male members</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoAssignFemale}
                      onChange={(e) => setAutoAssignFemale(e.target.checked)}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                    />
                    <span className="font-medium text-foreground">Auto-assign future Female members</span>
                  </label>
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

                        {(() => {
                          const assignedStaff = profiles.filter((p: any) => isMemberAssignedToStaff(m, p.id));
                          if (assignedStaff.length === 0) return null;
                          const otherStaffNames = assignedStaff
                            .filter((p: any) => p.id !== editingStaff?.id)
                            .map((p: any) => p.full_name);
                          if (otherStaffNames.length === 0) return null;
                          return (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded truncate max-w-[160px]" title={`Also assigned to: ${otherStaffNames.join(', ')}`}>
                              Also assigned: {otherStaffNames.join(', ')}
                            </span>
                          );
                        })()}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmStaff} onOpenChange={(open) => !open && setDeleteConfirmStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Staff Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteConfirmStaff?.full_name}</span>?
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
              This action is permanent and cannot be undone. The staff member&apos;s account will be removed and all assigned members will be unassigned.
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmStaff(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteStaffMutation.isPending}
              onClick={() => deleteConfirmStaff && deleteStaffMutation.mutate(deleteConfirmStaff.id)}
            >
              {deleteStaffMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
