'use client';
import { useState, useEffect, useRef } from 'react';
import { useLandingPageSettings, useUpdateLandingPageSettings } from '@/hooks/use-landing-page';
import {
  LandingPageData,
  defaultLandingPageData,
  DEFAULT_SECTION_ORDER,
  WEBSITE_TEMPLATES,
  WebsiteTemplate,
  FeatureItem,
  PricingPlan,
  TrainerCard,
  GalleryItem,
  TestimonialItem,
  ScheduleItem,
  FaqItem,
  CustomContentBlock,
  SectionStyle,
} from '@/types/landing-page';
import LandingPage from '@/components/landing/LandingPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Save,
  RotateCcw,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Plus,
  Trash2,
  Upload,
  Palette,
  Sparkles,
  Dumbbell,
  Users,
  Image as ImageIcon,
  MessageSquare,
  Phone,
  LayoutGrid,
  Layers,
  Loader2,
  CheckCircle2,
  Heading,
  ArrowUp,
  ArrowDown,
  Calendar,
  Video,
  HelpCircle,
  Megaphone,
  Type,
  FileCode,
  Download,
  Share2,
  Check,
  Flame,
  Trophy,
  Heart,
  Shield,
  Clock,
  Zap,
  Activity,
  Target,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

const COLOR_PRESETS = [
  '#a3e635', // Lime / Cyber
  '#ef4444', // Crimson / Red
  '#3b82f6', // Cobalt Blue
  '#eab308', // Gold
  '#10b981', // Emerald
  '#f97316', // Orange
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
];

const FONT_OPTIONS = [
  { value: 'outfit', label: 'Outfit (Modern Tech & Sleek)' },
  { value: 'oswald', label: 'Oswald (Heavy Industrial & Bold)' },
  { value: 'bebas-neue', label: 'Bebas Neue (High-Impact Display)' },
  { value: 'montserrat', label: 'Montserrat (Athletic Geometric)' },
  { value: 'poppins', label: 'Poppins (Clean Rounded Geometric)' },
  { value: 'inter', label: 'Inter (Neutral Swiss Modern)' },
];

const ICON_OPTIONS = [
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'flame', label: 'Flame' },
  { value: 'trophy', label: 'Trophy' },
  { value: 'heart', label: 'Heart' },
  { value: 'shield', label: 'Shield' },
  { value: 'clock', label: 'Clock' },
  { value: 'users', label: 'Users' },
  { value: 'zap', label: 'Zap' },
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'target', label: 'Target' },
  { value: 'timer', label: 'Timer' },
  { value: 'activity', label: 'Activity' },
];

type CustomizerTab =
  | 'templates'
  | 'sections'
  | 'hero'
  | 'about'
  | 'features'
  | 'schedule'
  | 'video'
  | 'pricing'
  | 'trainers'
  | 'gallery'
  | 'testimonials'
  | 'faq'
  | 'cta'
  | 'contact'
  | 'custom-blocks'
  | 'seo-backup';

export default function OnePagerCustomizer() {
  const { data: savedData, isLoading } = useLandingPageSettings();
  const updateSettings = useUpdateLandingPageSettings();

  const [formData, setFormData] = useState<LandingPageData>(defaultLandingPageData);
  const [activeTab, setActiveTab] = useState<CustomizerTab>('templates');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Modals
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const [templatePreviewModal, setTemplatePreviewModal] = useState<WebsiteTemplate | null>(null);
  const fileImportInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (savedData) {
      setFormData(savedData);
    }
  }, [savedData]);

  // Helper for background pictures & uploads
  const handleFileUpload = async (file: File, callback: (url: string) => void) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `one-pager/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('gym-assets')
        .upload(path, file, { upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('gym-assets').getPublicUrl(path);
        callback(urlData.publicUrl);
        toast.success('Image uploaded successfully!');
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            callback(e.target.result as string);
            toast.success('Image loaded locally!');
          }
        };
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          callback(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(formData);
      toast.success('Landing page website updated live!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save website changes');
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all website content to default values?')) {
      setFormData(defaultLandingPageData);
      toast.info('Restored default website template');
    }
  };

  // 1-Click Template Application
  const applyTemplate = (template: WebsiteTemplate) => {
    const updated: LandingPageData = {
      ...formData,
      theme: {
        ...formData.theme,
        templateId: template.id,
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor,
        fontFamily: template.fontFamily,
      },
      hero: {
        ...formData.hero,
        title: template.heroTitle,
        subtitle: template.heroSubtitle,
        badgeText: template.heroBadge,
        heroImageUrl: template.heroBgUrl,
      },
      about: {
        ...formData.about,
        title: template.aboutTitle,
        description: template.aboutDesc,
        imageUrl: template.aboutImgUrl,
      },
      cta: {
        ...(formData.cta || defaultLandingPageData.cta!),
        style: {
          ...(formData.cta?.style || {}),
          backgroundImageUrl: template.ctaBgUrl,
        },
      },
    };

    setFormData(updated);
    setTemplatePreviewModal(null);
    toast.success(`Template applied: ${template.name}! Remember to save changes.`);
  };

  // Section Ordering Helpers
  const currentSectionOrder = formData.sectionOrder || DEFAULT_SECTION_ORDER;

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentSectionOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setFormData({ ...formData, sectionOrder: newOrder });
  };

  const toggleSectionVisibility = (sectionKey: string, visible: boolean) => {
    setFormData({
      ...formData,
      sections: {
        ...formData.sections,
        [sectionKey]: visible,
      },
    });
  };

  // Backup: JSON Export
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(formData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `iron-lodge-website-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Website configuration exported to JSON');
  };

  // Backup: JSON Import
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.hero && parsed.theme) {
          setFormData(parsed);
          toast.success('Configuration imported successfully! Click Save to apply.');
        } else {
          toast.error('Invalid backup JSON format');
        }
      } catch (err) {
        toast.error('Failed to parse backup JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Background Customization Sub-component
  const SectionBackgroundControl = ({
    style,
    onChange,
    label = 'Section Background & Styling',
  }: {
    style?: SectionStyle;
    onChange: (updated: SectionStyle) => void;
    label?: string;
  }) => {
    const current = style || { backgroundOverlayOpacity: 85 };
    const uploadId = `bg-upload-${Math.random().toString(36).substring(7)}`;

    return (
      <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
        <Label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
          <span>{label}</span>
        </Label>

        <div className="space-y-2">
          <Label className="text-[11px] text-slate-400">Background Image URL (Optional)</Label>
          <div className="flex items-center gap-2">
            {current.backgroundImageUrl && (
              <img
                src={current.backgroundImageUrl}
                alt="Background preview"
                className="h-9 w-9 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
              />
            )}
            <Input
              value={current.backgroundImageUrl || ''}
              onChange={(e) => onChange({ ...current, backgroundImageUrl: e.target.value })}
              placeholder="https://images.unsplash.com/..."
              className="text-xs"
            />
            <Label htmlFor={uploadId} className="cursor-pointer px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
            </Label>
            <input
              id={uploadId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, (url) => onChange({ ...current, backgroundImageUrl: url }));
              }}
            />
          </div>
        </div>

        {current.backgroundImageUrl && (
          <div className="space-y-1 pt-2">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Dark Overlay Opacity</span>
              <span>{current.backgroundOverlayOpacity ?? 85}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={current.backgroundOverlayOpacity ?? 85}
              onChange={(e) => onChange({ ...current, backgroundOverlayOpacity: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span>Loading WordPress Site Builder...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-white">WordPress-Style Website Customizer &amp; Builder</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pick templates, add/remove/reorder sections, customize background pictures &amp; preview live.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-slate-700 hover:bg-slate-800 text-slate-300"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>

          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending || uploadingImage}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
          >
            {updateSettings.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Site
          </Button>
        </div>
      </div>

      {/* Main Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Editor Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* Navigation Tabs Bar */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'templates' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Themes</span>
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={`px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'sections' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Sections</span>
            </button>
            <button
              onClick={() => setActiveTab('hero')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'hero' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hero
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'about' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              About
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'features' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Amenities
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'schedule' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Schedule
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'video' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Video
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'pricing' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pricing
            </button>
            <button
              onClick={() => setActiveTab('trainers')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'trainers' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Coaches
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'gallery' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gallery
            </button>
            <button
              onClick={() => setActiveTab('testimonials')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'testimonials' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Reviews
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'faq' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              FAQ
            </button>
            <button
              onClick={() => setActiveTab('cta')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'cta' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              CTA Banner
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'contact' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Contact
            </button>
            <button
              onClick={() => setActiveTab('custom-blocks')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'custom-blocks' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom
            </button>
            <button
              onClick={() => setActiveTab('seo-backup')}
              className={`px-2.5 py-2 rounded-lg font-semibold transition ${
                activeTab === 'seo-backup' ? 'bg-primary text-primary-foreground shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Backup &amp; SEO
            </button>
          </div>

          <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
            <CardContent className="p-5 space-y-6">
              {/* ----------------- TAB: TEMPLATES & THEMES ----------------- */}
              {activeTab === 'templates' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      1-Click Theme Templates
                    </h3>
                    <p className="text-xs text-slate-400">
                      Select a complete pre-built website style. Applies typography, color scheme, background styling, and layout.
                    </p>
                  </div>

                  {/* Template Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {WEBSITE_TEMPLATES.map((tmpl) => {
                      const isCurrent = formData.theme?.templateId === tmpl.id;
                      return (
                        <div
                          key={tmpl.id}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                            isCurrent
                              ? 'bg-slate-950 border-primary ring-1 ring-primary'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div
                                className={`h-4 w-12 rounded-full bg-gradient-to-r ${tmpl.previewGradient} shadow-inner`}
                              />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                {tmpl.tag}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-white">{tmpl.name}</h4>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                              {tmpl.description}
                            </p>
                          </div>

                          <div className="pt-3 mt-2 border-t border-slate-900 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-3 w-3 rounded-full inline-block"
                                style={{ backgroundColor: tmpl.primaryColor }}
                              />
                              <span className="text-[10px] text-slate-400 uppercase">{tmpl.fontFamily}</span>
                            </div>

                            <Button
                              size="sm"
                              variant={isCurrent ? 'secondary' : 'outline'}
                              className="text-xs h-7 px-2.5 border-slate-700"
                              onClick={() => applyTemplate(tmpl)}
                            >
                              {isCurrent ? (
                                <>
                                  <Check className="h-3 w-3 mr-1 text-primary" /> Active
                                </>
                              ) : (
                                'Apply'
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Typography & Accent Colors */}
                  <div className="pt-4 border-t border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Typography &amp; Colors</h4>

                    <div className="space-y-2">
                      <Label className="text-xs">Website Heading Font</Label>
                      <Select
                        value={formData.theme.fontFamily || 'outfit'}
                        onValueChange={(val: any) =>
                          setFormData({ ...formData, theme: { ...formData.theme, fontFamily: val } })
                        }
                      >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
                          <SelectValue placeholder="Select Font" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          {FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Primary Accent Color</Label>
                      <div className="flex items-center gap-2">
                        {COLOR_PRESETS.map((color) => (
                          <button
                            key={color}
                            onClick={() =>
                              setFormData({ ...formData, theme: { ...formData.theme, primaryColor: color } })
                            }
                            className={`h-7 w-7 rounded-full border-2 transition ${
                              formData.theme.primaryColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <Input
                          type="color"
                          value={formData.theme.primaryColor}
                          onChange={(e) =>
                            setFormData({ ...formData, theme: { ...formData.theme, primaryColor: e.target.value } })
                          }
                          className="h-7 w-10 p-0 border-0 cursor-pointer rounded bg-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Top Announcement Bar */}
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold">Top Header Announcement Bar</Label>
                        <p className="text-[11px] text-slate-400">Shows a high-priority alert above header</p>
                      </div>
                      <Switch
                        checked={formData.theme.showAnnouncement}
                        onCheckedChange={(val) =>
                          setFormData({ ...formData, theme: { ...formData.theme, showAnnouncement: val } })
                        }
                      />
                    </div>

                    {formData.theme.showAnnouncement && (
                      <div className="space-y-2 pt-1">
                        <Input
                          placeholder="e.g. 🔥 Special Offer: Join today & get 20% off!"
                          value={formData.theme.announcementText}
                          onChange={(e) =>
                            setFormData({ ...formData, theme: { ...formData.theme, announcementText: e.target.value } })
                          }
                        />
                        <Input
                          placeholder="Link target e.g. #pricing or https://..."
                          value={formData.theme.announcementLink || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, theme: { ...formData.theme, announcementLink: e.target.value } })
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: SECTIONS MANAGER ----------------- */}
              {activeTab === 'sections' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Section Hierarchy &amp; Order</h3>
                      <p className="text-xs text-slate-400">
                        Reorder sections with Up/Down buttons or toggle visibility.
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setAddSectionDialogOpen(true)}
                      className="bg-primary text-primary-foreground font-semibold text-xs gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Block
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {currentSectionOrder.map((sectionKey, index) => {
                      const isVisible = formData.sections[sectionKey] ?? true;
                      const customBlock = formData.customBlocks?.find((b) => b.id === sectionKey);
                      const displayName = customBlock
                        ? `Custom: ${customBlock.title}`
                        : sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);

                      return (
                        <div
                          key={sectionKey}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500 w-5">#{index + 1}</span>
                            <span className={`text-xs font-semibold ${isVisible ? 'text-white' : 'text-slate-500 line-through'}`}>
                              {displayName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Reorder Buttons */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                              disabled={index === 0}
                              onClick={() => moveSection(index, 'up')}
                              title="Move Up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                              disabled={index === currentSectionOrder.length - 1}
                              onClick={() => moveSection(index, 'down')}
                              title="Move Down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>

                            <Switch
                              checked={isVisible}
                              onCheckedChange={(checked) => toggleSectionVisibility(sectionKey, checked)}
                            />

                            {customBlock && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    customBlocks: formData.customBlocks?.filter((b) => b.id !== sectionKey),
                                    sectionOrder: formData.sectionOrder?.filter((k) => k !== sectionKey),
                                  });
                                }}
                                title="Delete Custom Block"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: HERO ----------------- */}
              {activeTab === 'hero' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Hero Badge Tag</Label>
                    <Input
                      value={formData.hero.badgeText}
                      onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, badgeText: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Main Headline</Label>
                    <Input
                      value={formData.hero.title}
                      onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, title: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Subheadline</Label>
                    <Textarea
                      rows={3}
                      value={formData.hero.subtitle}
                      onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, subtitle: e.target.value } })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Primary CTA Button</Label>
                      <Input
                        value={formData.hero.primaryCtaText}
                        onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, primaryCtaText: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Secondary CTA Button</Label>
                      <Input
                        value={formData.hero.secondaryCtaText}
                        onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, secondaryCtaText: e.target.value } })}
                      />
                    </div>
                  </div>

                  {/* Section Background Control */}
                  <SectionBackgroundControl
                    label="Hero Background Picture &amp; Overlay"
                    style={{
                      backgroundImageUrl: formData.hero.heroImageUrl,
                      backgroundOverlayOpacity: formData.hero.style?.backgroundOverlayOpacity,
                    }}
                    onChange={(updated) => {
                      setFormData({
                        ...formData,
                        hero: {
                          ...formData.hero,
                          heroImageUrl: updated.backgroundImageUrl || formData.hero.heroImageUrl,
                          style: { ...formData.hero.style, ...updated },
                        },
                      });
                    }}
                  />

                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <Label className="text-xs font-bold text-white">Stat Counters</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-[10px] text-slate-400">Stat 1</Label>
                        <Input
                          value={formData.hero.stat1Number}
                          onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, stat1Number: e.target.value } })}
                        />
                        <Input
                          className="mt-1 text-xs"
                          value={formData.hero.stat1Label}
                          onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, stat1Label: e.target.value } })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-400">Stat 2</Label>
                        <Input
                          value={formData.hero.stat2Number}
                          onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, stat2Number: e.target.value } })}
                        />
                        <Input
                          className="mt-1 text-xs"
                          value={formData.hero.stat2Label}
                          onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, stat2Label: e.target.value } })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-400">Stat 3</Label>
                        <Input
                          value={formData.hero.stat3Number}
                          onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, stat3Number: e.target.value } })}
                        />
                        <Input
                          className="mt-1 text-xs"
                          value={formData.hero.stat3Label}
                          onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, stat3Label: e.target.value } })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-400">Stat 4</Label>
                        <Input
                          value={formData.hero.stat4Number || ''}
                          placeholder="e.g. 99%"
                          onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, stat4Number: e.target.value } })}
                        />
                        <Input
                          className="mt-1 text-xs"
                          placeholder="Satisfaction"
                          value={formData.hero.stat4Label || ''}
                          onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, stat4Label: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- TAB: ABOUT ----------------- */}
              {activeTab === 'about' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">About Title</Label>
                    <Input
                      value={formData.about.title}
                      onChange={(e) => setFormData({ ...formData, about: { ...formData.about, title: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Story Description</Label>
                    <Textarea
                      rows={4}
                      value={formData.about.description}
                      onChange={(e) => setFormData({ ...formData, about: { ...formData.about, description: e.target.value } })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Featured Story Image</Label>
                    <div className="flex items-center gap-2">
                      {formData.about.imageUrl && (
                        <img
                          src={formData.about.imageUrl}
                          alt="About preview"
                          className="h-10 w-10 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
                        />
                      )}
                      <Input
                        value={formData.about.imageUrl}
                        onChange={(e) => setFormData({ ...formData, about: { ...formData.about, imageUrl: e.target.value } })}
                        placeholder="https://..."
                      />
                      <Label htmlFor="about-upload" className="cursor-pointer px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5">
                        <Upload className="h-4 w-4" />
                        <span>Upload</span>
                      </Label>
                      <input
                        id="about-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, (url) => setFormData({ ...formData, about: { ...formData.about, imageUrl: url } }));
                        }}
                      />
                    </div>
                  </div>

                  <SectionBackgroundControl
                    label="About Section Background Picture"
                    style={formData.about.style}
                    onChange={(updated) => setFormData({ ...formData, about: { ...formData.about, style: updated } })}
                  />

                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <Label className="text-xs font-bold text-white">3 Highlight Callout Cards</Label>
                    <div className="space-y-2">
                      <div className="p-3 bg-slate-950 rounded-xl space-y-2">
                        <Input
                          placeholder="Highlight 1 Title"
                          value={formData.about.highlight1Title}
                          onChange={(e) => setFormData({ ...formData, about: { ...formData.about, highlight1Title: e.target.value } })}
                        />
                        <Input
                          placeholder="Highlight 1 Description"
                          value={formData.about.highlight1Desc}
                          onChange={(e) => setFormData({ ...formData, about: { ...formData.about, highlight1Desc: e.target.value } })}
                        />
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl space-y-2">
                        <Input
                          placeholder="Highlight 2 Title"
                          value={formData.about.highlight2Title}
                          onChange={(e) => setFormData({ ...formData, about: { ...formData.about, highlight2Title: e.target.value } })}
                        />
                        <Input
                          placeholder="Highlight 2 Description"
                          value={formData.about.highlight2Desc}
                          onChange={(e) => setFormData({ ...formData, about: { ...formData.about, highlight2Desc: e.target.value } })}
                        />
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl space-y-2">
                        <Input
                          placeholder="Highlight 3 Title"
                          value={formData.about.highlight3Title}
                          onChange={(e) => setFormData({ ...formData, about: { ...formData.about, highlight3Title: e.target.value } })}
                        />
                        <Input
                          placeholder="Highlight 3 Description"
                          value={formData.about.highlight3Desc}
                          onChange={(e) => setFormData({ ...formData, about: { ...formData.about, highlight3Desc: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- TAB: FEATURES / AMENITIES ----------------- */}
              {activeTab === 'features' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Amenity Cards ({formData.features.length})</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newItem: FeatureItem = {
                          id: `f_${Date.now()}`,
                          title: 'New Amenity',
                          description: 'Description of gym feature',
                          icon: 'dumbbell',
                        };
                        setFormData({ ...formData, features: [...formData.features, newItem] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Card
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {formData.features.map((feat, index) => (
                      <div key={feat.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400">Card #{index + 1}</span>
                          <button
                            onClick={() => {
                              setFormData({
                                ...formData,
                                features: formData.features.filter((f) => f.id !== feat.id),
                              });
                            }}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Title"
                            value={feat.title}
                            onChange={(e) => {
                              const updated = [...formData.features];
                              updated[index].title = e.target.value;
                              setFormData({ ...formData, features: updated });
                            }}
                          />
                          <Select
                            value={feat.icon}
                            onValueChange={(val) => {
                              const updated = [...formData.features];
                              updated[index].icon = val;
                              setFormData({ ...formData, features: updated });
                            }}
                          >
                            <SelectTrigger className="bg-slate-900 border-slate-700 text-xs">
                              <SelectValue placeholder="Icon" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-white">
                              {ICON_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Input
                          placeholder="Description"
                          value={feat.description}
                          onChange={(e) => {
                            const updated = [...formData.features];
                            updated[index].description = e.target.value;
                            setFormData({ ...formData, features: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: SCHEDULE ----------------- */}
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Schedule Section Title</Label>
                    <Input
                      value={formData.schedule?.title || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          schedule: { ...(formData.schedule || defaultLandingPageData.schedule!), title: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                      value={formData.schedule?.subtitle || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          schedule: { ...(formData.schedule || defaultLandingPageData.schedule!), subtitle: e.target.value },
                        })
                      }
                    />
                  </div>

                  <SectionBackgroundControl
                    label="Schedule Background Picture"
                    style={formData.schedule?.style}
                    onChange={(updated) =>
                      setFormData({
                        ...formData,
                        schedule: { ...(formData.schedule || defaultLandingPageData.schedule!), style: updated },
                      })
                    }
                  />

                  <div className="flex items-center justify-between pt-2">
                    <Label className="text-xs font-bold text-white">
                      Class Timetable ({formData.schedule?.items.length || 0})
                    </Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newClass: ScheduleItem = {
                          id: `sc_${Date.now()}`,
                          day: 'Mon',
                          time: '06:00 PM - 07:00 PM',
                          className: 'New Workout Class',
                          trainer: 'Lead Trainer',
                          intensity: 'High',
                          category: 'Strength',
                        };
                        const currentItems = formData.schedule?.items || [];
                        setFormData({
                          ...formData,
                          schedule: { ...(formData.schedule || defaultLandingPageData.schedule!), items: [...currentItems, newClass] },
                        })
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Class
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {formData.schedule?.items.map((item, index) => (
                      <div key={item.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Select
                              value={item.day}
                              onValueChange={(val: any) => {
                                const updated = [...(formData.schedule?.items || [])];
                                updated[index].day = val;
                                setFormData({
                                  ...formData,
                                  schedule: { ...formData.schedule!, items: updated },
                                });
                              }}
                            >
                              <SelectTrigger className="w-24 h-7 text-xs bg-slate-900 border-slate-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                {['All', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={item.intensity}
                              onValueChange={(val: any) => {
                                const updated = [...(formData.schedule?.items || [])];
                                updated[index].intensity = val;
                                setFormData({
                                  ...formData,
                                  schedule: { ...formData.schedule!, items: updated },
                                });
                              }}
                            >
                              <SelectTrigger className="w-28 h-7 text-xs bg-slate-900 border-slate-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                {['Low', 'Medium', 'High', 'Extreme'].map((int) => (
                                  <SelectItem key={int} value={int}>
                                    {int}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <button
                            onClick={() => {
                              const updated = formData.schedule?.items.filter((i) => i.id !== item.id) || [];
                              setFormData({
                                ...formData,
                                schedule: { ...formData.schedule!, items: updated },
                              });
                            }}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Class Name"
                            value={item.className}
                            onChange={(e) => {
                              const updated = [...(formData.schedule?.items || [])];
                              updated[index].className = e.target.value;
                              setFormData({ ...formData, schedule: { ...formData.schedule!, items: updated } });
                            }}
                          />
                          <Input
                            placeholder="Time Range (e.g. 07:00 AM - 08:00 AM)"
                            value={item.time}
                            onChange={(e) => {
                              const updated = [...(formData.schedule?.items || [])];
                              updated[index].time = e.target.value;
                              setFormData({ ...formData, schedule: { ...formData.schedule!, items: updated } });
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Trainer Name"
                            value={item.trainer}
                            onChange={(e) => {
                              const updated = [...(formData.schedule?.items || [])];
                              updated[index].trainer = e.target.value;
                              setFormData({ ...formData, schedule: { ...formData.schedule!, items: updated } });
                            }}
                          />
                          <Input
                            placeholder="Category (e.g. Cardio, Strength)"
                            value={item.category || ''}
                            onChange={(e) => {
                              const updated = [...(formData.schedule?.items || [])];
                              updated[index].category = e.target.value;
                              setFormData({ ...formData, schedule: { ...formData.schedule!, items: updated } });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: VIDEO ----------------- */}
              {activeTab === 'video' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Video Section Title</Label>
                    <Input
                      value={formData.video?.title || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          video: { ...(formData.video || defaultLandingPageData.video!), title: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                      value={formData.video?.subtitle || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          video: { ...(formData.video || defaultLandingPageData.video!), subtitle: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">YouTube / Video Embed URL</Label>
                    <Input
                      placeholder="https://www.youtube.com/watch?v=... or embed URL"
                      value={formData.video?.videoUrl || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          video: { ...(formData.video || defaultLandingPageData.video!), videoUrl: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Poster / Video Thumbnail URL</Label>
                    <div className="flex items-center gap-2">
                      {formData.video?.posterUrl && (
                        <img
                          src={formData.video.posterUrl}
                          alt="Poster preview"
                          className="h-10 w-10 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
                        />
                      )}
                      <Input
                        value={formData.video?.posterUrl || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            video: { ...(formData.video || defaultLandingPageData.video!), posterUrl: e.target.value },
                          })
                        }
                        placeholder="https://..."
                      />
                      <Label htmlFor="poster-upload" className="cursor-pointer px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5">
                        <Upload className="h-4 w-4" />
                        <span>Upload</span>
                      </Label>
                      <input
                        id="poster-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, (url) =>
                            setFormData({
                              ...formData,
                              video: { ...(formData.video || defaultLandingPageData.video!), posterUrl: url },
                            })
                          );
                        }}
                      />
                    </div>
                  </div>

                  <SectionBackgroundControl
                    label="Video Section Background Picture"
                    style={formData.video?.style}
                    onChange={(updated) =>
                      setFormData({
                        ...formData,
                        video: { ...(formData.video || defaultLandingPageData.video!), style: updated },
                      })
                    }
                  />
                </div>
              )}

              {/* ----------------- TAB: PRICING ----------------- */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Membership Plans ({formData.pricing.length})</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newPlan: PricingPlan = {
                          id: `p_${Date.now()}`,
                          name: 'VIP Pass',
                          price: 'PKR 10,000',
                          period: '/ month',
                          description: 'Custom plan description',
                          features: ['Full Access', 'Personal Training'],
                          isPopular: false,
                          ctaText: 'Get Started',
                        };
                        setFormData({ ...formData, pricing: [...formData.pricing, newPlan] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Plan
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {formData.pricing.map((plan, index) => (
                      <div key={plan.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary uppercase">Plan #{index + 1}</span>
                            <div className="flex items-center gap-1.5 ml-2">
                              <Switch
                                checked={!!plan.isPopular}
                                onCheckedChange={(checked) => {
                                  const updated = [...formData.pricing];
                                  updated[index] = { ...updated[index], isPopular: checked };
                                  setFormData({ ...formData, pricing: updated });
                                }}
                              />
                              <span className="text-[11px] text-slate-400">Popular Tag</span>
                            </div>
                          </div>

                          {formData.pricing.length > 1 && (
                            <button
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  pricing: formData.pricing.filter((p) => p.id !== plan.id),
                                });
                              }}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Plan Name"
                            value={plan.name}
                            onChange={(e) => {
                              const updated = [...formData.pricing];
                              updated[index].name = e.target.value;
                              setFormData({ ...formData, pricing: updated });
                            }}
                          />
                          <Input
                            placeholder="Price (e.g. PKR 6,500)"
                            value={plan.price}
                            onChange={(e) => {
                              const updated = [...formData.pricing];
                              updated[index].price = e.target.value;
                              setFormData({ ...formData, pricing: updated });
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Period (e.g. / month)"
                            value={plan.period}
                            onChange={(e) => {
                              const updated = [...formData.pricing];
                              updated[index].period = e.target.value;
                              setFormData({ ...formData, pricing: updated });
                            }}
                          />
                          <Input
                            placeholder="CTA Text (e.g. Get Started)"
                            value={plan.ctaText}
                            onChange={(e) => {
                              const updated = [...formData.pricing];
                              updated[index].ctaText = e.target.value;
                              setFormData({ ...formData, pricing: updated });
                            }}
                          />
                        </div>

                        <Input
                          placeholder="Description"
                          value={plan.description}
                          onChange={(e) => {
                            const updated = [...formData.pricing];
                            updated[index].description = e.target.value;
                            setFormData({ ...formData, pricing: updated });
                          }}
                        />

                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">Included Features (comma separated)</Label>
                          <Input
                            value={plan.features.join(', ')}
                            onChange={(e) => {
                              const updated = [...formData.pricing];
                              updated[index].features = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                              setFormData({ ...formData, pricing: updated });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: TRAINERS ----------------- */}
              {activeTab === 'trainers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Coaches &amp; Trainers ({formData.trainers.length})</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newTrainer: TrainerCard = {
                          id: `t_${Date.now()}`,
                          name: 'Coach Name',
                          role: 'Fitness Coach',
                          imageUrl: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=600&q=80',
                          bio: 'Coach bio description',
                          specialties: ['Strength', 'Fat Loss'],
                        };
                        setFormData({ ...formData, trainers: [...formData.trainers, newTrainer] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Coach
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {formData.trainers.map((tr, index) => (
                      <div key={tr.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Coach #{index + 1}</span>
                          <button
                            onClick={() => {
                              setFormData({
                                ...formData,
                                trainers: formData.trainers.filter((t) => t.id !== tr.id),
                              });
                            }}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Name"
                            value={tr.name}
                            onChange={(e) => {
                              const updated = [...formData.trainers];
                              updated[index].name = e.target.value;
                              setFormData({ ...formData, trainers: updated });
                            }}
                          />
                          <Input
                            placeholder="Role / Title"
                            value={tr.role}
                            onChange={(e) => {
                              const updated = [...formData.trainers];
                              updated[index].role = e.target.value;
                              setFormData({ ...formData, trainers: updated });
                            }}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          {tr.imageUrl && (
                            <img
                              src={tr.imageUrl}
                              alt={tr.name}
                              className="h-9 w-9 rounded-lg object-cover bg-slate-800 border border-slate-700 p-0.5 shrink-0"
                            />
                          )}
                          <Input
                            placeholder="Photo URL"
                            value={tr.imageUrl}
                            onChange={(e) => {
                              const updated = [...formData.trainers];
                              updated[index].imageUrl = e.target.value;
                              setFormData({ ...formData, trainers: updated });
                            }}
                          />
                          <Label htmlFor={`tr-upload-${index}`} className="cursor-pointer px-2.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs shrink-0">
                            <Upload className="h-3.5 w-3.5" />
                          </Label>
                          <input
                            id={`tr-upload-${index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, (url) => {
                                  const updated = [...formData.trainers];
                                  updated[index].imageUrl = url;
                                  setFormData({ ...formData, trainers: updated });
                                });
                              }
                            }}
                          />
                        </div>

                        <Input
                          placeholder="Bio"
                          value={tr.bio}
                          onChange={(e) => {
                            const updated = [...formData.trainers];
                            updated[index].bio = e.target.value;
                            setFormData({ ...formData, trainers: updated });
                          }}
                        />

                        <Input
                          placeholder="Specialties (comma separated)"
                          value={tr.specialties.join(', ')}
                          onChange={(e) => {
                            const updated = [...formData.trainers];
                            updated[index].specialties = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                            setFormData({ ...formData, trainers: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: GALLERY ----------------- */}
              {activeTab === 'gallery' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Facility Photos ({formData.gallery.length})</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newItem: GalleryItem = {
                          id: `g_${Date.now()}`,
                          imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
                          caption: 'New Facility Photo',
                        };
                        setFormData({ ...formData, gallery: [...formData.gallery, newItem] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Photo
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {formData.gallery.map((g, index) => (
                      <div key={g.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Photo #{index + 1}</span>
                          <button
                            onClick={() => {
                              setFormData({
                                ...formData,
                                gallery: formData.gallery.filter((item) => item.id !== g.id),
                              });
                            }}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {g.imageUrl && (
                            <img
                              src={g.imageUrl}
                              alt="Gallery"
                              className="h-9 w-9 rounded-lg object-cover bg-slate-800 border border-slate-700 p-0.5 shrink-0"
                            />
                          )}
                          <Input
                            placeholder="Image URL"
                            value={g.imageUrl}
                            onChange={(e) => {
                              const updated = [...formData.gallery];
                              updated[index].imageUrl = e.target.value;
                              setFormData({ ...formData, gallery: updated });
                            }}
                          />
                          <Label htmlFor={`gal-upload-${index}`} className="cursor-pointer px-2.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs shrink-0">
                            <Upload className="h-3.5 w-3.5" />
                          </Label>
                          <input
                            id={`gal-upload-${index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, (url) => {
                                  const updated = [...formData.gallery];
                                  updated[index].imageUrl = url;
                                  setFormData({ ...formData, gallery: updated });
                                });
                              }
                            }}
                          />
                        </div>

                        <Input
                          placeholder="Caption"
                          value={g.caption}
                          onChange={(e) => {
                            const updated = [...formData.gallery];
                            updated[index].caption = e.target.value;
                            setFormData({ ...formData, gallery: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: TESTIMONIALS ----------------- */}
              {activeTab === 'testimonials' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Member Reviews ({formData.testimonials.length})</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newTestimonial: TestimonialItem = {
                          id: `tm_${Date.now()}`,
                          name: 'Member Name',
                          role: 'Gym Member',
                          quote: 'Great workout experience & motivating trainers!',
                          rating: 5,
                        };
                        setFormData({ ...formData, testimonials: [...formData.testimonials, newTestimonial] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Review
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {formData.testimonials.map((t, index) => (
                      <div key={t.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Review #{index + 1}</span>
                          <button
                            onClick={() => {
                              setFormData({
                                ...formData,
                                testimonials: formData.testimonials.filter((item) => item.id !== t.id),
                              });
                            }}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Name"
                            value={t.name}
                            onChange={(e) => {
                              const updated = [...formData.testimonials];
                              updated[index].name = e.target.value;
                              setFormData({ ...formData, testimonials: updated });
                            }}
                          />
                          <Input
                            placeholder="Role / Title"
                            value={t.role}
                            onChange={(e) => {
                              const updated = [...formData.testimonials];
                              updated[index].role = e.target.value;
                              setFormData({ ...formData, testimonials: updated });
                            }}
                          />
                        </div>

                        <Textarea
                          rows={2}
                          placeholder="Review quote"
                          value={t.quote}
                          onChange={(e) => {
                            const updated = [...formData.testimonials];
                            updated[index].quote = e.target.value;
                            setFormData({ ...formData, testimonials: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: FAQ ----------------- */}
              {activeTab === 'faq' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">FAQ Section Title</Label>
                    <Input
                      value={formData.faq?.title || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          faq: { ...(formData.faq || defaultLandingPageData.faq!), title: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                      value={formData.faq?.subtitle || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          faq: { ...(formData.faq || defaultLandingPageData.faq!), subtitle: e.target.value },
                        })
                      }
                    />
                  </div>

                  <SectionBackgroundControl
                    label="FAQ Background Picture"
                    style={formData.faq?.style}
                    onChange={(updated) =>
                      setFormData({
                        ...formData,
                        faq: { ...(formData.faq || defaultLandingPageData.faq!), style: updated },
                      })
                    }
                  />

                  <div className="flex items-center justify-between pt-2">
                    <Label className="text-xs font-bold text-white">Questions &amp; Answers ({formData.faq?.items.length || 0})</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newFaq: FaqItem = {
                          id: `faq_${Date.now()}`,
                          question: 'Frequently asked question?',
                          answer: 'Detailed answer response here.',
                        };
                        const current = formData.faq?.items || [];
                        setFormData({
                          ...formData,
                          faq: { ...(formData.faq || defaultLandingPageData.faq!), items: [...current, newFaq] },
                        });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add FAQ
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {formData.faq?.items.map((item, index) => (
                      <div key={item.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400">Q#{index + 1}</span>
                          <button
                            onClick={() => {
                              const updated = formData.faq?.items.filter((i) => i.id !== item.id) || [];
                              setFormData({ ...formData, faq: { ...formData.faq!, items: updated } });
                            }}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <Input
                          placeholder="Question"
                          value={item.question}
                          onChange={(e) => {
                            const updated = [...(formData.faq?.items || [])];
                            updated[index].question = e.target.value;
                            setFormData({ ...formData, faq: { ...formData.faq!, items: updated } });
                          }}
                        />

                        <Textarea
                          rows={3}
                          placeholder="Answer"
                          value={item.answer}
                          onChange={(e) => {
                            const updated = [...(formData.faq?.items || [])];
                            updated[index].answer = e.target.value;
                            setFormData({ ...formData, faq: { ...formData.faq!, items: updated } });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ----------------- TAB: CTA BANNER ----------------- */}
              {activeTab === 'cta' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Badge Text</Label>
                    <Input
                      value={formData.cta?.badgeText || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cta: { ...(formData.cta || defaultLandingPageData.cta!), badgeText: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Banner Headline</Label>
                    <Input
                      value={formData.cta?.title || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cta: { ...(formData.cta || defaultLandingPageData.cta!), title: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Subtitle / Callout</Label>
                    <Textarea
                      rows={3}
                      value={formData.cta?.subtitle || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cta: { ...(formData.cta || defaultLandingPageData.cta!), subtitle: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Primary CTA Button</Label>
                      <Input
                        value={formData.cta?.primaryCtaText || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cta: { ...(formData.cta || defaultLandingPageData.cta!), primaryCtaText: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Primary CTA Link</Label>
                      <Input
                        value={formData.cta?.primaryCtaLink || '#pricing'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cta: { ...(formData.cta || defaultLandingPageData.cta!), primaryCtaLink: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <SectionBackgroundControl
                    label="CTA Banner Background Picture &amp; Overlay"
                    style={formData.cta?.style}
                    onChange={(updated) =>
                      setFormData({
                        ...formData,
                        cta: { ...(formData.cta || defaultLandingPageData.cta!), style: updated },
                      })
                    }
                  />
                </div>
              )}

              {/* ----------------- TAB: CONTACT & SOCIAL ----------------- */}
              {activeTab === 'contact' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Phone Number</Label>
                      <Input
                        value={formData.contact.phone}
                        onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, phone: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Email Address</Label>
                      <Input
                        value={formData.contact.email}
                        onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, email: e.target.value } })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Location Address</Label>
                    <Input
                      value={formData.contact.address}
                      onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, address: e.target.value } })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Weekday Hours</Label>
                      <Input
                        value={formData.contact.openingHoursWeekday}
                        onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, openingHoursWeekday: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Weekend Hours</Label>
                      <Input
                        value={formData.contact.openingHoursWeekend}
                        onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, openingHoursWeekend: e.target.value } })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">WhatsApp Direct Number (e.g. +923001234567)</Label>
                    <Input
                      value={formData.contact.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, whatsappNumber: e.target.value } })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div className="space-y-2">
                      <Label className="text-xs">Instagram Link</Label>
                      <Input
                        value={formData.contact.instagramUrl}
                        onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, instagramUrl: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Facebook Link</Label>
                      <Input
                        value={formData.contact.facebookUrl}
                        onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, facebookUrl: e.target.value } })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">YouTube Link</Label>
                      <Input
                        value={formData.contact.youtubeUrl || ''}
                        onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, youtubeUrl: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">X / Twitter Link</Label>
                      <Input
                        value={formData.contact.twitterUrl || ''}
                        onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, twitterUrl: e.target.value } })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <Label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>📍</span> Google Maps Embed / Search URL
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      Paste any Google Maps link or place name. The system converts it automatically into an interactive iframe.
                    </p>
                    <Input
                      value={formData.contact.mapEmbedUrl || ''}
                      onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, mapEmbedUrl: e.target.value } })}
                      placeholder="https://www.google.com/maps/place/..."
                    />
                  </div>
                </div>
              )}

              {/* ----------------- TAB: CUSTOM BLOCKS ----------------- */}
              {activeTab === 'custom-blocks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-bold text-white">Custom Freeform Blocks</Label>
                      <p className="text-[11px] text-slate-400">Add arbitrary rich content sections to the landing page</p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newBlockId = `custom_${Date.now()}`;
                        const newBlock: CustomContentBlock = {
                          id: newBlockId,
                          title: 'Custom Section Title',
                          subtitle: 'Custom Subtitle',
                          content: 'Add your custom gym announcement, event details, or promotional copy here.',
                          ctaText: 'Learn More',
                          ctaLink: '#contact',
                        };
                        const currentBlocks = formData.customBlocks || [];
                        const currentOrder = formData.sectionOrder || DEFAULT_SECTION_ORDER;
                        setFormData({
                          ...formData,
                          customBlocks: [...currentBlocks, newBlock],
                          sections: { ...formData.sections, [newBlockId]: true },
                          sectionOrder: [...currentOrder, newBlockId],
                        });
                        toast.success('Custom block added to page order!');
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom Block
                    </Button>
                  </div>

                  {(!formData.customBlocks || formData.customBlocks.length === 0) ? (
                    <div className="p-8 text-center bg-slate-950 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                      No custom content blocks created yet. Click "Add Custom Block" above to create one.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                      {formData.customBlocks.map((block, index) => (
                        <div key={block.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary">Custom Block #{index + 1}</span>
                            <button
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  customBlocks: formData.customBlocks?.filter((b) => b.id !== block.id),
                                  sectionOrder: formData.sectionOrder?.filter((k) => k !== block.id),
                                });
                              }}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="space-y-2">
                            <Input
                              placeholder="Title"
                              value={block.title}
                              onChange={(e) => {
                                const updated = [...(formData.customBlocks || [])];
                                updated[index].title = e.target.value;
                                setFormData({ ...formData, customBlocks: updated });
                              }}
                            />
                            <Input
                              placeholder="Subtitle"
                              value={block.subtitle || ''}
                              onChange={(e) => {
                                const updated = [...(formData.customBlocks || [])];
                                updated[index].subtitle = e.target.value;
                                setFormData({ ...formData, customBlocks: updated });
                              }}
                            />
                            <Textarea
                              rows={3}
                              placeholder="Content body..."
                              value={block.content}
                              onChange={(e) => {
                                const updated = [...(formData.customBlocks || [])];
                                updated[index].content = e.target.value;
                                setFormData({ ...formData, customBlocks: updated });
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Button Text"
                              value={block.ctaText || ''}
                              onChange={(e) => {
                                const updated = [...(formData.customBlocks || [])];
                                updated[index].ctaText = e.target.value;
                                setFormData({ ...formData, customBlocks: updated });
                              }}
                            />
                            <Input
                              placeholder="Button Link (e.g. #contact)"
                              value={block.ctaLink || ''}
                              onChange={(e) => {
                                const updated = [...(formData.customBlocks || [])];
                                updated[index].ctaLink = e.target.value;
                                setFormData({ ...formData, customBlocks: updated });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ----------------- TAB: SEO & BACKUP ----------------- */}
              {activeTab === 'seo-backup' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
                      <FileCode className="h-4 w-4 text-primary" />
                      SEO &amp; JSON Backup
                    </h3>
                    <p className="text-xs text-slate-400">
                      Manage metadata for search engines or export/import full site configuration.
                    </p>
                  </div>

                  <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <Label className="text-xs font-bold text-white">Search Engine Optimization (SEO)</Label>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-slate-400">Meta Title</Label>
                      <Input
                        value={formData.seo?.metaTitle || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, seo: { ...(formData.seo || {}), metaTitle: e.target.value } })
                        }
                        placeholder="Iron Lodge Gym | Elite Fitness Center"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-slate-400">Meta Description</Label>
                      <Textarea
                        rows={3}
                        value={formData.seo?.metaDescription || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, seo: { ...(formData.seo || {}), metaDescription: e.target.value } })
                        }
                        placeholder="State of the art gym in Lahore featuring 24/7 keycard access..."
                      />
                    </div>
                  </div>

                  <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <Label className="text-xs font-bold text-white">Backup &amp; Restore</Label>
                    <p className="text-[11px] text-slate-400">
                      Export your complete website layout as a JSON file or import a saved backup.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportJson}
                        className="text-xs border-slate-700 gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Export JSON Backup</span>
                      </Button>

                      <input
                        type="file"
                        accept=".json"
                        ref={fileImportInputRef}
                        className="hidden"
                        onChange={handleImportJson}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileImportInputRef.current?.click()}
                        className="text-xs border-slate-700 gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>Import JSON Backup</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL: Live Interactive Preview */}
        <div className="lg:col-span-7 space-y-4 sticky top-6">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Eye className="h-4 w-4 text-primary" />
              <span>Realtime Live Preview</span>
            </div>

            {/* Viewport Frame Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setViewportMode('desktop')}
                className={`p-1.5 rounded transition ${
                  viewportMode === 'desktop' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
                }`}
                title="Desktop View"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportMode('tablet')}
                className={`p-1.5 rounded transition ${
                  viewportMode === 'tablet' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
                }`}
                title="Tablet View"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportMode('mobile')}
                className={`p-1.5 rounded transition ${
                  viewportMode === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
                }`}
                title="Mobile View"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Device Frame */}
          <div className="flex justify-center bg-slate-950 p-4 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div
              className={`transition-all duration-300 overflow-y-auto max-h-[780px] rounded-xl border border-slate-800 ${
                viewportMode === 'desktop'
                  ? 'w-full'
                  : viewportMode === 'tablet'
                  ? 'w-[768px] shadow-2xl'
                  : 'w-[375px] shadow-2xl ring-8 ring-slate-900 rounded-[36px]'
              }`}
            >
              <LandingPage overrideData={formData} />
            </div>
          </div>
        </div>
      </div>

      {/* Add New Section Modal Dialog */}
      <Dialog open={addSectionDialogOpen} onOpenChange={setAddSectionDialogOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Section / WordPress Block</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Choose a block type to add to your landing page layout.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 pt-2">
            {[
              { id: 'schedule', title: 'Class Timetable / Schedule', icon: Calendar, desc: 'Interactive weekly timetable with day filters' },
              { id: 'video', title: 'Video Tour & Showcase', icon: Video, desc: 'YouTube or MP4 facility video tour' },
              { id: 'faq', title: 'Collapsible FAQ Accordions', icon: HelpCircle, desc: 'Frequently asked questions & answers' },
              { id: 'cta', title: 'High-Impact CTA Banner', icon: Megaphone, desc: 'Conversion banner with custom background' },
              { id: 'custom', title: 'Custom Freeform Content Block', icon: Type, desc: 'Custom title, story, image & CTA' },
            ].map((block) => {
              const Icon = block.icon;
              return (
                <button
                  key={block.id}
                  onClick={() => {
                    if (block.id === 'custom') {
                      const customId = `custom_${Date.now()}`;
                      const newBlock: CustomContentBlock = {
                        id: customId,
                        title: 'New Section Title',
                        subtitle: 'Section Subtitle',
                        content: 'Write your custom section copy here.',
                        ctaText: 'Learn More',
                        ctaLink: '#contact',
                      };
                      setFormData({
                        ...formData,
                        customBlocks: [...(formData.customBlocks || []), newBlock],
                        sections: { ...formData.sections, [customId]: true },
                        sectionOrder: [...currentSectionOrder, customId],
                      });
                    } else {
                      setFormData({
                        ...formData,
                        sections: { ...formData.sections, [block.id]: true },
                        sectionOrder: currentSectionOrder.includes(block.id)
                          ? currentSectionOrder
                          : [...currentSectionOrder, block.id],
                      });
                    }
                    setAddSectionDialogOpen(false);
                    toast.success(`Added ${block.title} to page!`);
                  }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0 mt-0.5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{block.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{block.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
