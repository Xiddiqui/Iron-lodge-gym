'use client';
import { useState, useEffect } from 'react';
import { useLandingPageSettings, useUpdateLandingPageSettings } from '@/hooks/use-landing-page';
import { LandingPageData, defaultLandingPageData, FeatureItem, PricingPlan, TrainerCard, GalleryItem, TestimonialItem } from '@/types/landing-page';
import LandingPage from '@/components/landing/LandingPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

const COLOR_PRESETS = ['#f97316', '#e11d48', '#3b82f6', '#10b981', '#8b5cf6', '#eab308', '#06b6d4'];

const ICON_OPTIONS = [
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'flame', label: 'Flame' },
  { value: 'trophy', label: 'Trophy' },
  { value: 'heart', label: 'Heart' },
  { value: 'shield', label: 'Shield' },
  { value: 'clock', label: 'Clock' },
  { value: 'users', label: 'Users' },
  { value: 'zap', label: 'Zap' },
];

export default function OnePagerCustomizer() {
  const { data: savedData, isLoading } = useLandingPageSettings();
  const updateSettings = useUpdateLandingPageSettings();

  const [formData, setFormData] = useState<LandingPageData>(defaultLandingPageData);
  const [activeTab, setActiveTab] = useState<'theme' | 'hero' | 'about' | 'features' | 'pricing' | 'trainers' | 'gallery' | 'testimonials' | 'contact' | 'sections'>('theme');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (savedData) {
      setFormData(savedData);
    }
  }, [savedData]);

  // Helper to handle image uploads for any field
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
        // Fallback to base64
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            callback(e.target.result as string);
            toast.success('Image loaded!');
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

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span>Loading One-Pager Customizer...</span>
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
            <h2 className="text-lg font-bold text-white">WordPress-Style One-Pager Customizer</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Customize text, images, colors & sections with live real-time preview.
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
            Reset Defaults
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
            Save Website
          </Button>
        </div>
      </div>

      {/* Main Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Editor Controls */}
        <div className="lg:col-span-5 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('theme')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'theme' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Theme
            </button>
            <button
              onClick={() => setActiveTab('hero')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'hero' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hero
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'about' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              About
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'features' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Amenities
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'pricing' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pricing
            </button>
            <button
              onClick={() => setActiveTab('trainers')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'trainers' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Coaches
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'gallery' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gallery
            </button>
            <button
              onClick={() => setActiveTab('testimonials')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'testimonials' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Reviews
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'contact' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Contact
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={`px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'sections' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sections
            </button>
          </div>

          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardContent className="p-6 space-y-6">
              {/* TAB 1: THEME */}
              {activeTab === 'theme' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Theme Accent Color</h3>
                    <p className="text-xs text-slate-400 mb-3">Choose a primary color highlight for buttons, icons & text accents.</p>
                    <div className="flex items-center gap-3">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setFormData({ ...formData, theme: { ...formData.theme, primaryColor: color } })}
                          className={`h-8 w-8 rounded-full border-2 transition ${
                            formData.theme.primaryColor === color ? 'border-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <Input
                        type="color"
                        value={formData.theme.primaryColor}
                        onChange={(e) => setFormData({ ...formData, theme: { ...formData.theme, primaryColor: e.target.value } })}
                        className="h-8 w-12 p-0 border-0 cursor-pointer rounded-lg bg-transparent"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Gym Tagline</Label>
                    <Input
                      value={formData.theme.tagline}
                      onChange={(e) => setFormData({ ...formData, theme: { ...formData.theme, tagline: e.target.value } })}
                      placeholder="Enter tagline"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold">Top Announcement Banner</Label>
                        <p className="text-[11px] text-slate-400">Show notification bar above header</p>
                      </div>
                      <Switch
                        checked={formData.theme.showAnnouncement}
                        onCheckedChange={(val) => setFormData({ ...formData, theme: { ...formData.theme, showAnnouncement: val } })}
                      />
                    </div>

                    {formData.theme.showAnnouncement && (
                      <div className="space-y-2">
                        <Label className="text-xs">Announcement Text</Label>
                        <Input
                          value={formData.theme.announcementText}
                          onChange={(e) => setFormData({ ...formData, theme: { ...formData.theme, announcementText: e.target.value } })}
                          placeholder="e.g. 🔥 Special Offer: Join today!"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: HERO */}
              {activeTab === 'hero' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Hero Badge / Tag</Label>
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
                    <Label className="text-xs">Subheadline / Description</Label>
                    <Textarea
                      rows={3}
                      value={formData.hero.subtitle}
                      onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, subtitle: e.target.value } })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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

                  <div className="space-y-2 pt-2">
                    <Label className="text-xs">Hero Image Background</Label>
                    <div className="flex items-center gap-3">
                      {formData.hero.heroImageUrl && (
                        <img
                          src={formData.hero.heroImageUrl}
                          alt="Hero preview"
                          className="h-10 w-10 rounded-lg object-cover bg-slate-800 border border-slate-700 p-0.5 shrink-0"
                        />
                      )}
                      <Input
                        value={formData.hero.heroImageUrl}
                        onChange={(e) => setFormData({ ...formData, hero: { ...formData.hero, heroImageUrl: e.target.value } })}
                        placeholder="https://image-url..."
                      />
                      <Label htmlFor="hero-upload" className="cursor-pointer px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5">
                        <Upload className="h-4 w-4" />
                        <span>Upload</span>
                      </Label>
                      <input
                        id="hero-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, (url) => setFormData({ ...formData, hero: { ...formData.hero, heroImageUrl: url } }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <Label className="text-xs font-bold text-white">Stat Counters</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[10px] text-slate-400">Stat 1 Num</Label>
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
                        <Label className="text-[10px] text-slate-400">Stat 2 Num</Label>
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
                        <Label className="text-[10px] text-slate-400">Stat 3 Num</Label>
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
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ABOUT */}
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
                    <Label className="text-xs">Story / Description</Label>
                    <Textarea
                      rows={4}
                      value={formData.about.description}
                      onChange={(e) => setFormData({ ...formData, about: { ...formData.about, description: e.target.value } })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">About Image</Label>
                    <div className="flex items-center gap-3">
                      {formData.about.imageUrl && (
                        <img
                          src={formData.about.imageUrl}
                          alt="About preview"
                          className="h-10 w-10 rounded-lg object-cover bg-slate-800 border border-slate-700 p-0.5 shrink-0"
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

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <Label className="text-xs font-bold text-white">Highlight Cards</Label>
                    <div className="space-y-3">
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

              {/* TAB 4: FEATURES / AMENITIES */}
              {activeTab === 'features' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Amenity / Feature Cards</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newItem: FeatureItem = {
                          id: `f_${Date.now()}`,
                          title: 'New Feature',
                          description: 'Description of feature',
                          icon: 'dumbbell',
                        };
                        setFormData({ ...formData, features: [...formData.features, newItem] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Card
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
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

              {/* TAB 5: PRICING */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-white">Membership Plans</Label>
                    <p className="text-[11px] text-slate-400 mt-1">Edit the 3 fixed membership tiers: Monthly, Quarterly, and Annual. All fields are editable except the plan type names.</p>
                  </div>

                  <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                    {/* Ensure exactly 3 plans */}
                    {(() => {
                      const planTypes = [
                        { key: 'monthly', label: 'Monthly', defaultPeriod: '/ month', defaultPrice: 'PKR 6,500' },
                        { key: 'quarterly', label: 'Quarterly', defaultPeriod: '/ 3 months', defaultPrice: 'PKR 18,000' },
                        { key: 'annual', label: 'Annual', defaultPeriod: '/ year', defaultPrice: 'PKR 60,000' },
                      ];
                      // Sync to 3 plans if missing
                      const plans = planTypes.map((pt, i) => {
                        const existing = formData.pricing[i];
                        return existing || {
                          id: `p_${pt.key}`,
                          name: pt.label,
                          price: pt.defaultPrice,
                          period: pt.defaultPeriod,
                          description: `${pt.label} membership plan`,
                          features: ['Full Gym Access', 'Locker Access'],
                          isPopular: i === 1,
                          ctaText: 'Get Started',
                        };
                      });
                      // If formData has wrong count, sync it
                      if (formData.pricing.length !== 3) {
                        setTimeout(() => setFormData({ ...formData, pricing: plans }), 0);
                      }
                      return plans.map((plan, index) => (
                        <div key={plan.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-primary uppercase tracking-wide">{planTypes[index].label} Plan</span>
                              <div className="flex items-center gap-1.5 ml-2">
                                <Switch
                                  checked={!!plan.isPopular}
                                  onCheckedChange={(checked) => {
                                    const updated = [...formData.pricing];
                                    updated[index] = { ...updated[index], isPopular: checked };
                                    setFormData({ ...formData, pricing: updated });
                                  }}
                                />
                                <span className="text-[11px] text-slate-400">Most Popular Tag</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-slate-400">Price (e.g. PKR 6,500)</Label>
                              <Input
                                placeholder="Price"
                                value={plan.price}
                                onChange={(e) => {
                                  const updated = [...formData.pricing];
                                  updated[index] = { ...updated[index], price: e.target.value };
                                  setFormData({ ...formData, pricing: updated });
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-slate-400">Period Label</Label>
                              <Input
                                placeholder={planTypes[index].defaultPeriod}
                                value={plan.period}
                                onChange={(e) => {
                                  const updated = [...formData.pricing];
                                  updated[index] = { ...updated[index], period: e.target.value };
                                  setFormData({ ...formData, pricing: updated });
                                }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] text-slate-400">Plan Display Name</Label>
                            <Input
                              placeholder="Plan name shown on website"
                              value={plan.name}
                              onChange={(e) => {
                                const updated = [...formData.pricing];
                                updated[index] = { ...updated[index], name: e.target.value };
                                setFormData({ ...formData, pricing: updated });
                              }}
                            />
                          </div>

                          <Input
                            placeholder="Short description"
                            value={plan.description}
                            onChange={(e) => {
                              const updated = [...formData.pricing];
                              updated[index] = { ...updated[index], description: e.target.value };
                              setFormData({ ...formData, pricing: updated });
                            }}
                          />

                          <div className="space-y-1">
                            <Label className="text-[10px] text-slate-400">Included Features (comma separated)</Label>
                            <Input
                              value={plan.features.join(', ')}
                              onChange={(e) => {
                                const updated = [...formData.pricing];
                                updated[index] = { ...updated[index], features: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) };
                                setFormData({ ...formData, pricing: updated });
                              }}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] text-slate-400">CTA Button Text</Label>
                            <Input
                              placeholder="e.g. Get Started"
                              value={plan.ctaText}
                              onChange={(e) => {
                                const updated = [...formData.pricing];
                                updated[index] = { ...updated[index], ctaText: e.target.value };
                                setFormData({ ...formData, pricing: updated });
                              }}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 6: TRAINERS */}
              {activeTab === 'trainers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Coaches & Trainers</Label>
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

                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
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

              {/* TAB 7: GALLERY */}
              {activeTab === 'gallery' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Facility Photos</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newItem: GalleryItem = {
                          id: `g_${Date.now()}`,
                          imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
                          caption: 'New Photo',
                        };
                        setFormData({ ...formData, gallery: [...formData.gallery, newItem] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Image
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
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

              {/* TAB 8: TESTIMONIALS */}
              {activeTab === 'testimonials' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white">Customer Reviews</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-700"
                      onClick={() => {
                        const newTestimonial: TestimonialItem = {
                          id: `tm_${Date.now()}`,
                          name: 'Member Name',
                          role: 'Gym Member',
                          quote: 'Great workout experience!',
                          rating: 5,
                        };
                        setFormData({ ...formData, testimonials: [...formData.testimonials, newTestimonial] });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Review
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
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

              {/* TAB 9: CONTACT */}
              {activeTab === 'contact' && (
                <div className="space-y-4">
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
                    <Label className="text-xs">WhatsApp Number (e.g. +923001234567)</Label>
                    <Input
                      value={formData.contact.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, whatsappNumber: e.target.value } })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <Label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>📍</span> Google Maps Embed URL
                    </Label>
                    <p className="text-[11px] text-slate-400">Paste <strong className="text-slate-300">any Google Maps URL</strong> — including regular place links (e.g. google.com/maps/place/...). The app converts it automatically. If empty, a placeholder card is shown instead.</p>
                    <Input
                      value={formData.contact.mapEmbedUrl || ''}
                      onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, mapEmbedUrl: e.target.value } })}
                      placeholder="https://www.google.com/maps/embed?pb=..."
                    />
                    {formData.contact.mapEmbedUrl && (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1">✓ Map embed active — preview below in the live preview.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 10: SECTIONS VISIBILITY */}
              {activeTab === 'sections' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white mb-2">Show or Hide Website Sections</h3>
                  <p className="text-xs text-slate-400 mb-4">Toggle visibility of sections on your landing page.</p>

                  <div className="space-y-3">
                    {Object.entries(formData.sections).map(([key, isVisible]) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-xs font-semibold capitalize text-slate-200">{key} Section</span>
                        <Switch
                          checked={isVisible}
                          onCheckedChange={(checked) => {
                            setFormData({
                              ...formData,
                              sections: { ...formData.sections, [key]: checked },
                            });
                          }}
                        />
                      </div>
                    ))}
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
                className={`p-1.5 rounded transition ${viewportMode === 'desktop' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'}`}
                title="Desktop View"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportMode('tablet')}
                className={`p-1.5 rounded transition ${viewportMode === 'tablet' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'}`}
                title="Tablet View"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewportMode('mobile')}
                className={`p-1.5 rounded transition ${viewportMode === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'}`}
                title="Mobile View"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Device Frame */}
          <div className="flex justify-center bg-slate-950 p-4 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div
              className={`transition-all duration-300 overflow-y-auto max-h-[750px] rounded-xl border border-slate-800 ${
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
    </div>
  );
}
