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
import { Settings, Save, Upload, Loader2, Users, Shield, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { data: role } = useRole();
  const { data: settings } = useGymSettings();
  const queryClient = useQueryClient();

  const [gymName, setGymName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Staff management
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', password: '', role: 'staff' });

  // Initialize form when settings load
  useState(() => {
    if (settings) {
      setGymName(settings.gym_name || 'Iron Lodge Gym');
      if (settings.logo_url) setLogoPreview(settings.logo_url);
    }
  });

  // Fetch all profiles (staff users)
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Save gym settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      let logoUrl = settings?.logo_url || null;

      // Upload logo if new file selected
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `gym-logo/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('gym-assets')
          .upload(path, logoFile, { upsert: true });

        if (uploadError) {
          // Try creating bucket if it doesn't exist
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

  // Handle logo file selection
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
    onError: (e) => toast.error(e.message),
  });

  // Add new staff user
  const addStaff = useMutation({
    mutationFn: async (data: typeof newStaff) => {
      // Create user via Supabase Auth (requires service role or admin invite)
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name, role: data.role },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Staff member added. They may need to verify their email.');
      setStaffDialogOpen(false);
      setNewStaff({ full_name: '', email: '', password: '', role: 'staff' });
    },
    onError: (e) => toast.error(e.message),
  });

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
          <Button size="sm" onClick={() => setStaffDialogOpen(true)}>
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
                  <th className="text-left p-4 font-medium text-muted-foreground">Role</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profilesLoading ? (
                  <tr><td colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : profiles.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No staff users found</td></tr>
                ) : profiles.map((p: any) => (
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
                      <Badge variant={p.role === 'admin' ? 'default' : 'secondary'} className="gap-1">
                        <Shield className="h-3 w-3" /> {p.role}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); addStaff.mutate(newStaff); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                required
                value={newStaff.full_name}
                onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                placeholder="Enter name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                required
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                placeholder="Enter email"
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
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newStaff.role} onValueChange={(v) => setNewStaff({ ...newStaff, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addStaff.isPending}>
                {addStaff.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Staff
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
