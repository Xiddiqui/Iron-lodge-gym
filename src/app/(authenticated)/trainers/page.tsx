'use client';
export const dynamic = 'force-dynamic';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useRole } from '@/hooks/use-role';
import {
  Dumbbell,
  Plus,
  Search,
  Loader2,
  Camera,
  RefreshCw,
  X,
  User,
  Clock,
  Award,
  Phone,
  IdCard,
  Users,
  Pencil,
  Trash2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface Trainer {
  id: string;
  name: string;
  phone: string | null;
  cnic: string | null;
  availability_slot: string | null;
  experience_years: number | null;
  photo_url: string | null;
  specialization: string | null;
  created_at: string;
}

interface Member {
  id: string;
  member_number: string | null;
  full_name: string;
  phone: string | null;
  cnic: string | null;
  email: string | null;
  join_date: string;
  monthly_fee: number;
  training_fees: number;
  trainer_id: string | null;
  active: boolean;
  photo_url: string | null;
}

export default function TrainersPage() {
  const queryClient = useQueryClient();
  const { data: role } = useRole();
  const isAdmin = role === 'admin';

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Trainer | null>(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    cnic: '',
    availability_slot: '',
    experience_years: '',
    specialization: '',
    photo_url: null as string | null,
  });

  // Webcam state & refs
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Detail View State
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch Trainers
  const { data: trainers = [], isLoading: loadingTrainers } = useQuery({
    queryKey: ['trainers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Trainer[];
    },
  });

  // Fetch Members
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as Member[];
    },
  });

  // Calculate assigned active clients per trainer
  const trainerClientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      if (m.trainer_id && m.active) {
        counts[m.trainer_id] = (counts[m.trainer_id] || 0) + 1;
      }
    });
    return counts;
  }, [members]);

  // Assigned clients for selected trainer
  const assignedClients = useMemo(() => {
    if (!selectedTrainer) return [];
    return members.filter((m) => m.trainer_id === selectedTrainer.id);
  }, [members, selectedTrainer]);

  // Camera Management
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: 'user' },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
    } catch (err) {
      toast.error('Unable to access camera. Please check camera permissions.');
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  useEffect(() => {
    if (!dialogOpen) {
      stopCamera();
    }
  }, [dialogOpen]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 300;
    canvas.height = videoRef.current.videoHeight || 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setForm((prev) => ({ ...prev, photo_url: dataUrl }));
      stopCamera();
      toast.success('Photo captured!');
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (!isAdmin) {
        throw new Error('Only admins are authorized to manage trainers');
      }

      const payload = {
        name: data.name,
        phone: data.phone || null,
        cnic: data.cnic || null,
        availability_slot: data.availability_slot || null,
        experience_years: data.experience_years ? Number(data.experience_years) : null,
        specialization: data.specialization || null,
        photo_url: data.photo_url || null,
      };

      if (editing) {
        const { error } = await supabase.from('trainers').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('trainers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
      toast.success(editing ? 'Trainer updated' : 'Trainer added successfully');
      stopCamera();
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) {
        throw new Error('Only admins are authorized to delete trainers');
      }
      const { error } = await supabase.from('trainers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
      toast.success('Trainer removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() {
    if (!isAdmin) {
      toast.error('Only admin can add new trainers');
      return;
    }
    setEditing(null);
    stopCamera();
    setForm({
      name: '',
      phone: '',
      cnic: '',
      availability_slot: '',
      experience_years: '',
      specialization: '',
      photo_url: null,
    });
    setDialogOpen(true);
  }

  function openEdit(t: Trainer, e: React.MouseEvent) {
    e.stopPropagation();
    if (!isAdmin) return;
    setEditing(t);
    stopCamera();
    setForm({
      name: t.name,
      phone: t.phone || '',
      cnic: t.cnic || '',
      availability_slot: t.availability_slot || '',
      experience_years: t.experience_years !== null ? String(t.experience_years) : '',
      specialization: t.specialization || '',
      photo_url: t.photo_url || null,
    });
    setDialogOpen(true);
  }

  const filteredTrainers = useMemo(() => {
    return trainers.filter((t) => {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.phone || '').includes(q) ||
        (t.availability_slot || '').toLowerCase().includes(q) ||
        (t.cnic || '').includes(q)
      );
    });
  }, [trainers, search]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
              Trainers
              <Badge variant="secondary" className="font-sans font-normal">
                {trainers.length}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">Manage gym trainers and their client assignments</p>
          </div>
        </div>

        {/* Add Trainer Button - ONLY visible to ADMIN */}
        {isAdmin && (
          <Button onClick={openAdd} className="w-full sm:w-auto shadow-elegant">
            <Plus className="h-4 w-4 mr-2" /> Add Trainer
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search trainers by name, phone, CNIC, or availability (e.g. 10am - 1pm)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Trainers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left p-4 font-medium text-muted-foreground">Trainer Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Assigned Clients</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Contact Number</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Availability Slot</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Experience</th>
                  {isAdmin && <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loadingTrainers ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : filteredTrainers.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      No trainers found
                    </td>
                  </tr>
                ) : (
                  filteredTrainers.map((t) => {
                    const clientCount = trainerClientCounts[t.id] || 0;
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedTrainer(t);
                          setDetailOpen(true);
                        }}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {t.photo_url ? (
                              <img
                                src={t.photo_url}
                                alt={t.name}
                                className="h-10 w-10 rounded-full object-cover border border-border shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-primary/20 grid place-items-center text-sm font-semibold text-primary shrink-0">
                                {t.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-foreground">{t.name}</div>
                              {t.specialization && (
                                <div className="text-xs text-muted-foreground">{t.specialization}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="font-semibold px-2.5 py-0.5 border-primary/30 text-primary bg-primary/5">
                            <Users className="h-3 w-3 mr-1" />
                            {clientCount} {clientCount === 1 ? 'Client' : 'Clients'}
                          </Badge>
                        </td>
                        <td className="p-4 hidden sm:table-cell text-muted-foreground font-mono text-xs">
                          {t.phone || '—'}
                        </td>
                        <td className="p-4">
                          {t.availability_slot ? (
                            <Badge variant="secondary" className="font-normal">
                              <Clock className="h-3 w-3 mr-1" />
                              {t.availability_slot}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="p-4 hidden lg:table-cell text-muted-foreground">
                          {t.experience_years !== null ? `${t.experience_years} yrs` : '—'}
                        </td>
                        {isAdmin && (
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={(e) => openEdit(t, e)}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete trainer "${t.name}"?`)) {
                                    deleteMutation.mutate(t.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Trainer Dialog (Admin Only) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Trainer' : 'Add New Trainer'}</DialogTitle>
          </DialogHeader>

          {/* Webcam Image Capture Section */}
          <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border border-border gap-3">
            <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 border-primary/40 bg-background shadow-inner grid place-items-center">
              {isCameraActive ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              ) : form.photo_url ? (
                <img src={form.photo_url} alt="Trainer Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <User className="h-12 w-12 mx-auto text-muted-foreground opacity-40 mb-1" />
                  <p className="text-[11px] text-muted-foreground">No photo set</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {isCameraActive ? (
                <>
                  <Button type="button" size="sm" onClick={capturePhoto} className="gap-1.5">
                    <Camera className="h-4 w-4" /> Capture Photo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={stopCamera}>
                    Cancel Camera
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={startCamera} className="gap-1.5">
                    <Camera className="h-4 w-4" /> {form.photo_url ? 'Retake Photo' : 'Take Photo (Webcam)'}
                  </Button>
                  {form.photo_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setForm((prev) => ({ ...prev, photo_url: null }))}
                    >
                      Remove Photo
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(form);
            }}
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Trainer Name *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Captain Alex"
                />
              </div>

              {/* CNIC Number */}
              <div className="space-y-2">
                <Label>CNIC Number</Label>
                <Input
                  value={form.cnic}
                  onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                  placeholder="e.g. 42101-XXXXXXX-X"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label>Contact Number</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 0300-1234567"
                />
              </div>

              {/* Availability Slot */}
              <div className="space-y-2">
                <Label>Availability Slot</Label>
                <Input
                  value={form.availability_slot}
                  onChange={(e) => setForm({ ...form, availability_slot: e.target.value })}
                  placeholder="e.g. 10am - 1pm"
                />
              </div>

              {/* Experience (Years) */}
              <div className="space-y-2">
                <Label>Experience (Years)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.experience_years}
                  onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                  placeholder="e.g. 5"
                />
              </div>

              {/* Specialization */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Specialization / Focus Area</Label>
                <Input
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  placeholder="e.g. Bodybuilding, Strength & Conditioning"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  stopCamera();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Update Trainer' : 'Add Trainer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Trainer Detail View Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedTrainer && (
            <div className="space-y-6">
              {/* Header Details */}
              <DialogHeader>
                <div className="flex items-start gap-4">
                  {selectedTrainer.photo_url ? (
                    <img
                      src={selectedTrainer.photo_url}
                      alt={selectedTrainer.name}
                      className="h-16 w-16 rounded-full object-cover border-2 border-primary/30 shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-primary/20 grid place-items-center text-xl font-bold text-primary shrink-0">
                      {selectedTrainer.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="space-y-1">
                    <DialogTitle className="text-2xl">{selectedTrainer.name}</DialogTitle>
                    {selectedTrainer.specialization && (
                      <p className="text-sm text-muted-foreground">{selectedTrainer.specialization}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedTrainer.availability_slot && (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" /> Slot: {selectedTrainer.availability_slot}
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        <Users className="h-3 w-3 mr-1" /> Assigned Clients: {assignedClients.filter((m) => m.active).length} Active
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Trainer Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm bg-muted/30 p-4 rounded-xl border border-border">
                <div className="bg-background p-3 rounded-lg border border-border space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> Contact Number
                  </div>
                  <div className="font-mono font-medium">{selectedTrainer.phone || '—'}</div>
                </div>

                <div className="bg-background p-3 rounded-lg border border-border space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <IdCard className="h-3.5 w-3.5" /> CNIC Number
                  </div>
                  <div className="font-mono font-medium">{selectedTrainer.cnic || '—'}</div>
                </div>

                <div className="bg-background p-3 rounded-lg border border-border space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Award className="h-3.5 w-3.5" /> Experience
                  </div>
                  <div className="font-medium">
                    {selectedTrainer.experience_years !== null ? `${selectedTrainer.experience_years} Years` : '—'}
                  </div>
                </div>
              </div>

              {/* Assigned Clients Table Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Assigned Clients ({assignedClients.length})
                  </h3>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left p-3 font-medium text-muted-foreground">Member #</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Join Date</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Monthly Fee</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingMembers ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                          </td>
                        </tr>
                      ) : assignedClients.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                            No clients currently assigned to this trainer
                          </td>
                        </tr>
                      ) : (
                        assignedClients.map((m) => (
                          <tr key={m.id} className="border-b border-border/50 hover:bg-accent/20">
                            <td className="p-3 font-mono text-xs font-medium text-muted-foreground">
                              {m.member_number || '—'}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {m.photo_url ? (
                                  <img
                                    src={m.photo_url}
                                    alt={m.full_name}
                                    className="h-7 w-7 rounded-full object-cover border border-border shrink-0"
                                  />
                                ) : (
                                  <div className="h-7 w-7 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary shrink-0">
                                    {m.full_name.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-medium text-foreground">{m.full_name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground font-mono text-xs">{m.phone || '—'}</td>
                            <td className="p-3 text-muted-foreground text-xs">{formatDate(m.join_date)}</td>
                            <td className="p-3 font-medium">{formatCurrency(m.monthly_fee)}</td>
                            <td className="p-3 text-right">
                              <Badge variant={m.active ? 'success' : 'destructive'} className="text-[11px]">
                                {m.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
