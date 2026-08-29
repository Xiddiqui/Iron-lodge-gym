'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useLandingPageSettings } from '@/hooks/use-landing-page';
import { useGymSettings } from '@/hooks/use-gym-settings';
import {
  LandingPageData,
  defaultLandingPageData,
  DEFAULT_SECTION_ORDER,
  SectionStyle,
  ScheduleItem,
  FaqItem,
  CustomContentBlock,
} from '@/types/landing-page';

import {
  Dumbbell,
  Flame,
  Trophy,
  Heart,
  Shield,
  Clock,
  Users,
  Zap,
  Check,
  Star,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  LayoutDashboard,
  LogIn,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Building2,
  Loader2,
  Play,
  HelpCircle,
  Calendar,
  Layers,
  Activity,
  Target,
  Timer,
  ExternalLink,
} from 'lucide-react';

function InstagramIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

function FacebookIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}

function YoutubeIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function TwitterIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

const ICON_MAP: Record<string, any> = {
  dumbbell: Dumbbell,
  flame: Flame,
  trophy: Trophy,
  heart: Heart,
  shield: Shield,
  clock: Clock,
  users: Users,
  zap: Zap,
  sparkles: Sparkles,
  target: Target,
  timer: Timer,
  activity: Activity,
};

const FONT_MAP: Record<string, string> = {
  'outfit': 'var(--font-outfit, sans-serif)',
  'oswald': 'var(--font-oswald, Impact, sans-serif)',
  'montserrat': 'var(--font-montserrat, sans-serif)',
  'bebas-neue': 'var(--font-bebas, Impact, sans-serif)',
  'poppins': 'var(--font-poppins, sans-serif)',
  'inter': 'var(--font-inter, sans-serif)',
};

// Converts any Google Maps URL to an embeddable iframe src
function toEmbedUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes('output=embed') || trimmed.includes('/maps/embed')) return trimmed;
  const iframeSrcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch) return iframeSrcMatch[1];
  const coordMatch = trimmed.match(/\/@(-?\d+\.?\d*),(-?\d+\.?\d*),([\d.]+)z/);
  if (coordMatch) {
    const lat = coordMatch[1];
    const lng = coordMatch[2];
    const zoom = coordMatch[3];
    return `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
  }
  const placeMatch = trimmed.match(/google\.com\/maps\/place\/([^/@]+)/);
  if (placeMatch) {
    const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    return `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&output=embed`;
  }
  const searchMatch = trimmed.match(/google\.com\/maps\/search\/([^/@]+)/);
  if (searchMatch) {
    const query = decodeURIComponent(searchMatch[1].replace(/\+/g, ' '));
    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }
  if (trimmed.includes('goo.gl/') || trimmed.includes('maps.app.goo.gl')) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;
  }
  try {
    const parsed = new URL(trimmed);
    const q = parsed.searchParams.get('q');
    if (q && trimmed.includes('google')) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }
  } catch {}
  if (trimmed.includes('google.com/maps') || trimmed.includes('google.co')) {
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}output=embed`;
  }
  if (!trimmed.startsWith('http')) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;
  }
  return trimmed;
}

// Converts standard YouTube URLs into embed URLs
function toVideoEmbedUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes('/embed/')) return trimmed;
  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1&rel=0`;
  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&rel=0`;
  // vimeo.com/ID
  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  return trimmed;
}

export default function LandingPage({ overrideData }: { overrideData?: LandingPageData }) {
  const router = useRouter();
  const { data: fetchedData, isLoading } = useLandingPageSettings();
  const { data: gymSettings } = useGymSettings();

  const data: LandingPageData = overrideData || fetchedData || defaultLandingPageData;
  const gymName = gymSettings?.gym_name || 'Iron Lodge Gym';
  const logoUrl = gymSettings?.logo_url;

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleDashboardClick = () => {
    if (isLoggedIn) {
      router.push('/dashboard');
    } else {
      router.push('/auth');
    }
  };

  const primaryColor = data.theme?.primaryColor || '#a3e635';
  const secondaryColor = data.theme?.secondaryColor || '#22c55e';
  const displayLogo = logoUrl || '/logo.png';
  const selectedFont = FONT_MAP[data.theme?.fontFamily || 'outfit'] || 'inherit';

  // Section order
  const sectionOrder = useMemo(() => {
    const order = data.sectionOrder || DEFAULT_SECTION_ORDER;
    const allKnown = new Set(order);
    // Add custom blocks to order if missing
    if (data.customBlocks) {
      data.customBlocks.forEach((cb) => {
        if (!allKnown.has(cb.id)) order.push(cb.id);
      });
    }
    return order;
  }, [data.sectionOrder, data.customBlocks]);

  if (isLoading && !overrideData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center relative overflow-hidden">
        <div
          className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl opacity-25 animate-pulse pointer-events-none"
          style={{ backgroundColor: primaryColor }}
        />
        <div className="relative z-10 flex flex-col items-center gap-6 p-4">
          <div className="relative flex items-center justify-center">
            <div
              className="absolute -inset-4 rounded-3xl opacity-50 blur-md animate-pulse"
              style={{ backgroundColor: primaryColor }}
            />
            <div
              className="absolute -inset-2 rounded-2xl animate-spin border-2 border-transparent"
              style={{
                borderTopColor: primaryColor,
                borderRightColor: primaryColor,
                animationDuration: '3s',
              }}
            />
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-white p-3.5 shadow-2xl backdrop-blur-xl flex items-center justify-center overflow-hidden">
              <img
                src={displayLogo}
                alt={gymName}
                className="h-full w-full object-contain filter drop-shadow-lg animate-pulse"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.landing-logo-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              <div className="landing-logo-fallback hidden h-full w-full items-center justify-center text-green-500">
                <Dumbbell className="h-12 w-12 animate-bounce" />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-wider uppercase font-display bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {gymName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: primaryColor }} />
              <span>Loading experience...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { theme, hero, about, features, schedule, video, pricing, trainers, gallery, testimonials, faq, cta, customBlocks, contact, sections } = data;

  // Render Background helper
  const renderBackground = (style?: SectionStyle, defaultBgImage?: string) => {
    const bgImage = style?.backgroundImageUrl || defaultBgImage;
    const opacity = style?.backgroundOverlayOpacity !== undefined ? style.backgroundOverlayOpacity / 100 : 0.85;
    if (!bgImage) return null;

    return (
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={bgImage}
          alt="Section Background"
          className="w-full h-full object-cover object-center transform scale-105"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: `rgba(2, 6, 23, ${opacity})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70" />
      </div>
    );
  };

  // ----------------------------------------------------
  // SECTION RENDERERS
  // ----------------------------------------------------

  const renderHero = () => {
    if (!sections.hero) return null;
    return (
      <section key="hero" id="hero" className="relative min-h-[88vh] flex items-center justify-center py-24 overflow-hidden">
        {renderBackground(hero.style, hero.heroImageUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80')}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8 space-y-6">
            {hero.badgeText && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-semibold tracking-wider text-slate-300 uppercase shadow-lg">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
                {hero.badgeText}
              </div>
            )}

            <h1 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tight leading-none font-display">
              {hero.title || 'FORGE YOUR ULTIMATE PHYSIQUE'}
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl leading-relaxed">
              {hero.subtitle || 'State-of-the-art facility, elite trainers, and an inspiring fitness community.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4 justify-center sm:justify-start">
              <a
                href="#pricing"
                className="px-8 py-4 rounded-xl font-bold text-white shadow-xl hover:opacity-90 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                <span>{hero.primaryCtaText || 'Explore Memberships'}</span>
                <ArrowRight className="h-5 w-5" />
              </a>

              <a
                href="#contact"
                className="px-8 py-4 rounded-xl font-bold text-white bg-slate-900/80 border border-slate-700 hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <span>{hero.secondaryCtaText || 'Contact Us'}</span>
              </a>
            </div>

            {/* Stat Counters */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 sm:gap-6 pt-10 border-t border-slate-800/80 max-w-2xl">
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: primaryColor }}>
                  {hero.stat1Number}
                </p>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">{hero.stat1Label}</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: primaryColor }}>
                  {hero.stat2Number}
                </p>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">{hero.stat2Label}</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: primaryColor }}>
                  {hero.stat3Number}
                </p>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">{hero.stat3Label}</p>
              </div>
              {hero.stat4Number && (
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: primaryColor }}>
                    {hero.stat4Number}
                  </p>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">{hero.stat4Label || 'Rating'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderAbout = () => {
    if (!sections.about) return null;
    return (
      <section key="about" id="about" className="relative py-24 bg-slate-900/50 border-y border-slate-800/60 overflow-hidden">
        {renderBackground(about.style)}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Image Column */}
            <div className="relative group">
              <div
                className="absolute -inset-2 rounded-3xl opacity-30 blur-xl transition duration-500 group-hover:opacity-60"
                style={{ backgroundColor: primaryColor }}
              />
              <img
                src={about.imageUrl || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80'}
                alt="About Gym"
                className="relative rounded-2xl shadow-2xl object-cover w-full h-[450px] border border-slate-800"
              />
            </div>

            {/* Text Column */}
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
                  About {gymName}
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
                  {about.title}
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed text-base sm:text-lg">
                {about.description}
              </p>

              {/* Key Highlights */}
              <div className="space-y-4 pt-4">
                {about.highlight1Title && (
                  <div className="flex gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="h-10 w-10 rounded-lg shrink-0 grid place-items-center text-white" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{about.highlight1Title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{about.highlight1Desc}</p>
                    </div>
                  </div>
                )}

                {about.highlight2Title && (
                  <div className="flex gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="h-10 w-10 rounded-lg shrink-0 grid place-items-center text-white" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{about.highlight2Title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{about.highlight2Desc}</p>
                    </div>
                  </div>
                )}

                {about.highlight3Title && (
                  <div className="flex gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="h-10 w-10 rounded-lg shrink-0 grid place-items-center text-white" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{about.highlight3Title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{about.highlight3Desc}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderFeatures = () => {
    if (!sections.features || features.length === 0) return null;
    return (
      <section key="features" id="features" className="relative py-24 bg-slate-950 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
              Premium Experience
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase font-display">
              WORLD-CLASS AMENITIES
            </h2>
            <p className="text-slate-400 text-base">
              Everything you need to train hard, recover fast, and reach peak fitness.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feat) => {
              const IconComponent = ICON_MAP[feat.icon] || Dumbbell;
              return (
                <div
                  key={feat.id}
                  className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all hover:-translate-y-1 group"
                >
                  <div
                    className="h-12 w-12 rounded-xl grid place-items-center mb-6 text-white transition-all group-hover:scale-110"
                    style={{ backgroundColor: `${primaryColor}25`, color: primaryColor }}
                  >
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feat.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderSchedule = () => {
    if (!sections.schedule || !schedule || schedule.items.length === 0) return null;
    const days = ['All', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const filteredItems = selectedDay === 'All'
      ? schedule.items
      : schedule.items.filter((item) => item.day === selectedDay || item.day === 'All');

    return (
      <section key="schedule" id="schedule" className="relative py-24 bg-slate-900/40 border-y border-slate-800/80 overflow-hidden">
        {renderBackground(schedule.style)}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
              Class Timetable
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase font-display">
              {schedule.title || 'WEEKLY CLASS TIMETABLE'}
            </h2>
            <p className="text-slate-400 text-base">
              {schedule.subtitle || 'High-energy group workouts led by expert coaches every day of the week.'}
            </p>

            {/* Day Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-6">
              {days.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedDay === day
                      ? 'text-white shadow-lg scale-105'
                      : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                  style={{
                    backgroundColor: selectedDay === day ? primaryColor : undefined,
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                      {item.day}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        item.intensity === 'Extreme'
                          ? 'bg-red-500/20 text-red-400'
                          : item.intensity === 'High'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {item.intensity} Intensity
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{item.className}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-4">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span>{item.time}</span>
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>Coach: <strong className="text-white">{item.trainer}</strong></span>
                  </div>
                  {item.category && (
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {item.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderVideo = () => {
    if (!sections.video || !video || !video.videoUrl) return null;
    const embedUrl = toVideoEmbedUrl(video.videoUrl);

    return (
      <section key="video" id="video" className="relative py-24 bg-slate-950 overflow-hidden">
        {renderBackground(video.style)}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            {video.badgeText && (
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
                {video.badgeText}
              </span>
            )}
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase font-display">
              {video.title || 'EXPERIENCE THE ATMOSPHERE'}
            </h2>
            <p className="text-slate-400 text-base">
              {video.subtitle || 'Take a virtual tour inside our world-class gym.'}
            </p>
          </div>

          <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/90 aspect-video relative group">
            {isPlayingVideo ? (
              <iframe
                src={embedUrl}
                title={video.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div
                className="relative w-full h-full cursor-pointer flex items-center justify-center"
                onClick={() => setIsPlayingVideo(true)}
              >
                <img
                  src={video.posterUrl || 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1200&q=80'}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                />
                <div className="absolute inset-0 bg-slate-950/50 group-hover:bg-slate-950/40 transition" />
                <div
                  className="relative h-20 w-20 rounded-full grid place-items-center text-white shadow-2xl transition transform group-hover:scale-110"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Play className="h-8 w-8 ml-1 fill-white" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderPricing = () => {
    if (!sections.pricing || pricing.length === 0) return null;
    return (
      <section key="pricing" id="pricing" className="relative py-24 bg-slate-900/40 border-y border-slate-800/80 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
              Flexible Membership Plans
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase font-display">
              CHOOSE YOUR PASS
            </h2>
            <p className="text-slate-400 text-base">
              No hidden fees. Transparent pricing designed for your goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {pricing.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-8 rounded-3xl flex flex-col justify-between transition-all ${
                  plan.isPopular
                    ? 'bg-slate-900 border-2 shadow-2xl scale-105 z-10'
                    : 'bg-slate-950/80 border border-slate-800'
                }`}
                style={{ borderColor: plan.isPopular ? primaryColor : undefined }}
              >
                {plan.isPopular && (
                  <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase text-white shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Most Popular
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-slate-400 text-xs mb-6 min-h-[32px]">{plan.description}</p>

                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-slate-400 text-sm font-medium">{plan.period}</span>
                  </div>

                  <div className="space-y-3 mb-8">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm text-slate-300">
                        <Check className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleDashboardClick}
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all shadow-md hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: plan.isPopular ? primaryColor : '#1e293b',
                    border: !plan.isPopular ? '1px solid #334155' : undefined,
                  }}
                >
                  <span>{plan.ctaText || 'Get Started'}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderTrainers = () => {
    if (!sections.trainers || trainers.length === 0) return null;
    return (
      <section key="trainers" id="trainers" className="relative py-24 bg-slate-950 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
              Expert Coaching Team
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase font-display">
              MEET OUR COACHES
            </h2>
            <p className="text-slate-400 text-base">
              Certified trainers dedicated to guiding your transformation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {trainers.map((tr) => (
              <div key={tr.id} className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden group">
                <div className="h-72 overflow-hidden relative">
                  <img
                    src={tr.imageUrl || 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=600&q=80'}
                    alt={tr.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <h3 className="text-xl font-bold text-white">{tr.name}</h3>
                    <p className="text-xs font-medium text-slate-400" style={{ color: primaryColor }}>{tr.role}</p>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{tr.bio}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {tr.specialties.map((spec, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md bg-slate-800 text-[11px] font-medium text-slate-300">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderGallery = () => {
    if (!sections.gallery || gallery.length === 0) return null;
    return (
      <section key="gallery" id="gallery" className="relative py-24 bg-slate-900/30 border-y border-slate-800/60 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
              Facility Showcase
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase font-display">
              INSIDE THE LODGE
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {gallery.map((g) => (
              <div
                key={g.id}
                onClick={() => setActiveImage(g.imageUrl)}
                className="relative group rounded-2xl overflow-hidden cursor-pointer h-64 border border-slate-800"
              >
                <img
                  src={g.imageUrl}
                  alt={g.caption}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <p className="text-sm font-bold text-white">{g.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Lightbox */}
        {activeImage && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setActiveImage(null)}
          >
            <div className="relative max-w-4xl w-full bg-slate-800/70 p-3 rounded-2xl border border-slate-700/60 shadow-2xl">
              <img src={activeImage} alt="Enlarged" className="w-full h-auto max-h-[85vh] object-contain rounded-xl bg-slate-900/50" />
              <button
                onClick={() => setActiveImage(null)}
                className="absolute top-6 right-6 text-white bg-slate-900/90 p-2 rounded-full hover:bg-slate-700 border border-slate-700 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        )}
      </section>
    );
  };

  const renderTestimonials = () => {
    if (!sections.testimonials || testimonials.length === 0) return null;
    return (
      <section key="testimonials" id="testimonials" className="relative py-24 bg-slate-950 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
              Success Stories
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase font-display">
              WHAT MEMBERS SAY
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.id} className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex gap-1 text-amber-400">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-300 text-sm italic leading-relaxed">"{t.quote}"</p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                  {t.avatarUrl ? (
                    <img src={t.avatarUrl} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-800 grid place-items-center font-bold text-white">
                      {t.name[0]}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-white">{t.name}</h4>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderFaq = () => {
    if (!sections.faq || !faq || faq.items.length === 0) return null;
    return (
      <section key="faq" id="faq" className="relative py-24 bg-slate-900/40 border-y border-slate-800/80 overflow-hidden">
        {renderBackground(faq.style)}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
              Help &amp; Answers
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase font-display">
              {faq.title || 'FREQUENTLY ASKED QUESTIONS'}
            </h2>
            <p className="text-slate-400 text-base">
              {faq.subtitle || 'Everything you need to know about our memberships and facilities.'}
            </p>
          </div>

          <div className="space-y-4">
            {faq.items.map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-white hover:text-slate-200 transition"
                  >
                    <span className="text-base sm:text-lg">{item.question}</span>
                    <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 text-slate-400">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-0 text-slate-300 text-sm leading-relaxed border-t border-slate-900 mt-2">
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderCta = () => {
    if (!sections.cta || !cta) return null;
    return (
      <section key="cta" id="cta" className="relative py-24 bg-slate-950 overflow-hidden">
        {renderBackground(cta.style, cta.style?.backgroundImageUrl || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1600&q=80')}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {cta.badgeText && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Sparkles className="h-3.5 w-3.5" style={{ color: primaryColor }} />
              <span>{cta.badgeText}</span>
            </div>
          )}

          <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight font-display max-w-3xl mx-auto leading-tight">
            {cta.title}
          </h2>

          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {cta.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href={cta.primaryCtaLink || '#pricing'}
              className="px-8 py-4 rounded-xl font-bold text-white shadow-2xl hover:opacity-90 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <span>{cta.primaryCtaText || 'Get Started Now'}</span>
              <ArrowRight className="h-5 w-5" />
            </a>

            {cta.secondaryCtaText && (
              <a
                href={cta.secondaryCtaLink || '#contact'}
                className="px-8 py-4 rounded-xl font-bold text-white bg-slate-900/90 border border-slate-700 hover:bg-slate-800 transition-all"
              >
                <span>{cta.secondaryCtaText}</span>
              </a>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderContact = () => {
    if (!sections.contact) return null;
    return (
      <section key="contact" id="contact" className="relative py-24 bg-slate-900/70 border-t border-slate-800 overflow-hidden">
        {renderBackground(contact.style)}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Contact Info */}
            <div className="lg:col-span-5 space-y-8">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
                  Get In Touch
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
                  {contact.title || `VISIT ${gymName.toUpperCase()}`}
                </h2>
                <p className="text-slate-400 text-sm">
                  {contact.subtitle || 'Drop by for a tour or contact us for trial passes and membership inquiries.'}
                </p>
              </div>

              <div className="space-y-4 text-sm text-slate-300">
                {contact.address && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <MapPin className="h-5 w-5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                    <div>
                      <p className="font-bold text-white">Location Address</p>
                      <p className="text-slate-400 mt-0.5">{contact.address}</p>
                    </div>
                  </div>
                )}

                {contact.phone && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <Phone className="h-5 w-5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                    <div>
                      <p className="font-bold text-white">Phone Support</p>
                      <p className="text-slate-400 mt-0.5">{contact.phone}</p>
                    </div>
                  </div>
                )}

                {contact.email && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <Mail className="h-5 w-5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                    <div>
                      <p className="font-bold text-white">Email Address</p>
                      <p className="text-slate-400 mt-0.5">{contact.email}</p>
                    </div>
                  </div>
                )}

                {(contact.openingHoursWeekday || contact.openingHoursWeekend) && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <Clock className="h-5 w-5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                    <div>
                      <p className="font-bold text-white">Operating Hours</p>
                      {contact.openingHoursWeekday && <p className="text-slate-400 mt-0.5">{contact.openingHoursWeekday}</p>}
                      {contact.openingHoursWeekend && <p className="text-slate-400 text-xs mt-0.5">{contact.openingHoursWeekend}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Social & WhatsApp Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {contact.whatsappNumber && (
                  <a
                    href={`https://wa.me/${contact.whatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp Us</span>
                  </a>
                )}

                {contact.instagramUrl && (
                  <a
                    href={contact.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Instagram"
                  >
                    <InstagramIcon className="h-5 w-5" />
                  </a>
                )}

                {contact.facebookUrl && (
                  <a
                    href={contact.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Facebook"
                  >
                    <FacebookIcon className="h-5 w-5" />
                  </a>
                )}

                {contact.youtubeUrl && (
                  <a
                    href={contact.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="YouTube"
                  >
                    <YoutubeIcon className="h-5 w-5" />
                  </a>
                )}

                {contact.twitterUrl && (
                  <a
                    href={contact.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="X (Twitter)"
                  >
                    <TwitterIcon className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>

            {/* Map Embed or Call Card */}
            <div className="lg:col-span-7 h-[420px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center relative">
              {(contact.mapEmbedUrl?.trim() || contact.address?.trim()) ? (
                <iframe
                  src={toEmbedUrl(contact.mapEmbedUrl?.trim() || contact.address?.trim() || '')}
                  className="w-full h-full border-0"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="text-center p-8 space-y-4">
                  <MapPin className="h-16 w-16 mx-auto" style={{ color: primaryColor }} />
                  <h4 className="text-xl font-bold text-white">{gymName}</h4>
                  <p className="text-slate-400 text-sm max-w-sm">Visit us for a free tour &amp; fitness consultation.</p>
                  {contact.whatsappNumber && (
                    <a
                      href={`https://wa.me/${contact.whatsappNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 rounded-xl font-bold text-sm text-white shadow-lg inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 transition"
                    >
                      <span>WhatsApp Us</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Bottom Bar */}
          <div className="mt-16 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} {gymName}. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <button onClick={handleDashboardClick} className="hover:text-slate-300 transition">
                {isLoggedIn ? 'Dashboard' : 'Portal Login'}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderCustomBlock = (block: CustomContentBlock) => {
    if (sections[block.id] === false) return null;
    const isImageRight = block.imagePosition === 'right';
    const isImageTop = block.imagePosition === 'top';

    return (
      <section key={block.id} id={block.id} className="relative py-24 bg-slate-950 overflow-hidden border-b border-slate-800/50">
        {renderBackground(block.style)}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isImageTop && block.imageUrl && (
            <div className="mb-12 rounded-3xl overflow-hidden max-h-[420px] border border-slate-800">
              <img src={block.imageUrl} alt={block.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className={`grid grid-cols-1 ${block.imageUrl && !isImageTop ? 'lg:grid-cols-2' : ''} gap-12 items-center`}>
            {block.imageUrl && !isImageTop && !isImageRight && (
              <div className="rounded-2xl overflow-hidden border border-slate-800 h-[380px]">
                <img src={block.imageUrl} alt={block.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-6">
              {block.subtitle && (
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
                  {block.subtitle}
                </span>
              )}
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
                {block.title}
              </h2>
              <div className="text-slate-300 leading-relaxed text-base whitespace-pre-line">
                {block.content}
              </div>

              {block.ctaText && (
                <div className="pt-4">
                  <a
                    href={block.ctaLink || '#contact'}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>{block.ctaText}</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>

            {block.imageUrl && !isImageTop && isImageRight && (
              <div className="rounded-2xl overflow-hidden border border-slate-800 h-[380px]">
                <img src={block.imageUrl} alt={block.title} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  // Section Dispatcher
  const renderSectionById = (sectionId: string) => {
    switch (sectionId) {
      case 'hero':
        return renderHero();
      case 'about':
        return renderAbout();
      case 'features':
        return renderFeatures();
      case 'schedule':
        return renderSchedule();
      case 'video':
        return renderVideo();
      case 'pricing':
        return renderPricing();
      case 'trainers':
        return renderTrainers();
      case 'gallery':
        return renderGallery();
      case 'testimonials':
        return renderTestimonials();
      case 'faq':
        return renderFaq();
      case 'cta':
        return renderCta();
      case 'contact':
        return renderContact();
      default:
        // Check if custom block
        const customBlock = customBlocks?.find((b) => b.id === sectionId);
        if (customBlock) return renderCustomBlock(customBlock);
        return null;
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-white"
      style={{ fontFamily: selectedFont }}
    >
      {/* 1. Announcement Bar */}
      {theme.showAnnouncement && theme.announcementText && (
        <a
          href={theme.announcementLink || '#pricing'}
          className="text-white text-xs md:text-sm py-2.5 px-4 text-center font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition cursor-pointer"
          style={{ backgroundColor: primaryColor }}
        >
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span>{theme.announcementText}</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      )}

      {/* 2. Navigation Bar */}
      <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            {logoUrl ? (
              <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center p-1 border border-slate-300 shadow-sm">
                <img src={logoUrl} alt={gymName} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                <Dumbbell className="h-6 w-6" />
              </div>
            )}
            <span className="text-xl font-extrabold tracking-tight text-white uppercase font-display">
              {gymName}
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
            {sections.hero && <a href="#hero" className="hover:text-white transition-colors">Home</a>}
            {sections.about && <a href="#about" className="hover:text-white transition-colors">About</a>}
            {sections.features && <a href="#features" className="hover:text-white transition-colors">Amenities</a>}
            {sections.schedule && schedule && schedule.items.length > 0 && <a href="#schedule" className="hover:text-white transition-colors">Schedule</a>}
            {sections.video && video?.videoUrl && <a href="#video" className="hover:text-white transition-colors">Tour</a>}
            {sections.pricing && <a href="#pricing" className="hover:text-white transition-colors">Memberships</a>}
            {sections.trainers && <a href="#trainers" className="hover:text-white transition-colors">Coaches</a>}
            {sections.gallery && <a href="#gallery" className="hover:text-white transition-colors">Gallery</a>}
            {sections.faq && faq && faq.items.length > 0 && <a href="#faq" className="hover:text-white transition-colors">FAQ</a>}
            {sections.contact && <a href="#contact" className="hover:text-white transition-colors">Contact</a>}
          </nav>

          {/* Action / Member Portal Button */}
          <div className="hidden sm:flex items-center gap-4">
            <button
              onClick={handleDashboardClick}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center gap-2 transition-all shadow-lg hover:opacity-90 active:scale-95"
              style={{ backgroundColor: primaryColor }}
            >
              {isLoggedIn ? (
                <>
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Go to Dashboard</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Member Login</span>
                </>
              )}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-3">
            <button
              onClick={handleDashboardClick}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ backgroundColor: primaryColor }}
            >
              {isLoggedIn ? <LayoutDashboard className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              <span>Portal</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-6 space-y-4">
            {sections.hero && <a href="#hero" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">Home</a>}
            {sections.about && <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">About</a>}
            {sections.features && <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">Amenities</a>}
            {sections.schedule && <a href="#schedule" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">Schedule</a>}
            {sections.video && <a href="#video" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">Tour</a>}
            {sections.pricing && <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">Memberships</a>}
            {sections.trainers && <a href="#trainers" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">Coaches</a>}
            {sections.gallery && <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">Gallery</a>}
            {sections.faq && <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">FAQ</a>}
            {sections.contact && <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium hover:text-white">Contact</a>}
          </div>
        )}
      </header>

      {/* Dynamic Section Renderer in configured sectionOrder */}
      <main>
        {sectionOrder.map((sectionId) => renderSectionById(sectionId))}
      </main>
    </div>
  );
}

