export interface SectionStyle {
  backgroundImageUrl?: string;
  backgroundOverlayOpacity?: number; // 0 to 100
  backgroundColor?: string;
  paddingY?: 'compact' | 'normal' | 'spacious';
  textAlign?: 'left' | 'center' | 'right';
}

export interface HeroSection {
  title: string;
  subtitle: string;
  primaryCtaText: string;
  secondaryCtaText: string;
  heroImageUrl: string;
  badgeText: string;
  stat1Number: string;
  stat1Label: string;
  stat2Number: string;
  stat2Label: string;
  stat3Number: string;
  stat3Label: string;
  stat4Number?: string;
  stat4Label?: string;
  style?: SectionStyle;
}

export interface ThemeSettings {
  templateId?: string; // 'cyber-neon' | 'crimson-beast' | 'royal-blue' | 'golden-royalty' | 'pure-wellness' | 'sunset-forge'
  primaryColor: string; // e.g. '#a3e635' or '#ef4444'
  secondaryColor?: string;
  fontFamily?: 'inter' | 'montserrat' | 'oswald' | 'bebas-neue' | 'poppins' | 'outfit';
  tagline: string;
  announcementText: string;
  showAnnouncement: boolean;
  announcementLink?: string;
}

export interface AboutSection {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  highlight1Title: string;
  highlight1Desc: string;
  highlight2Title: string;
  highlight2Desc: string;
  highlight3Title: string;
  highlight3Desc: string;
  style?: SectionStyle;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: string; // 'dumbbell' | 'flame' | 'trophy' | 'heart' | 'shield' | 'clock' | 'users' | 'zap' | 'sparkles' | 'target' | 'timer' | 'activity'
}

export interface FeaturesSection {
  title?: string;
  subtitle?: string;
  items: FeatureItem[];
  style?: SectionStyle;
}

export interface ScheduleItem {
  id: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' | 'All';
  time: string;
  className: string;
  trainer: string;
  intensity: 'Low' | 'Medium' | 'High' | 'Extreme';
  category?: string;
}

export interface ScheduleSection {
  title: string;
  subtitle: string;
  items: ScheduleItem[];
  style?: SectionStyle;
}

export interface VideoSection {
  title: string;
  subtitle: string;
  videoUrl: string; // YouTube / Vimeo embed or MP4
  posterUrl?: string;
  badgeText?: string;
  style?: SectionStyle;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  ctaText: string;
}

export interface PricingSection {
  title?: string;
  subtitle?: string;
  plans: PricingPlan[];
  style?: SectionStyle;
}

export interface TrainerCard {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
  bio: string;
  specialties: string[];
}

export interface TrainersSection {
  title?: string;
  subtitle?: string;
  items: TrainerCard[];
  style?: SectionStyle;
}

export interface GalleryItem {
  id: string;
  imageUrl: string;
  caption: string;
}

export interface GallerySection {
  title?: string;
  subtitle?: string;
  items: GalleryItem[];
  columns?: 2 | 3 | 4;
  style?: SectionStyle;
}

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatarUrl?: string;
}

export interface TestimonialsSection {
  title?: string;
  subtitle?: string;
  items: TestimonialItem[];
  style?: SectionStyle;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqSection {
  title: string;
  subtitle: string;
  items: FaqItem[];
  style?: SectionStyle;
}

export interface CtaBannerSection {
  title: string;
  subtitle: string;
  badgeText?: string;
  primaryCtaText: string;
  primaryCtaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  style?: SectionStyle;
}

export interface CustomContentBlock {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  imageUrl?: string;
  imagePosition?: 'left' | 'right' | 'top';
  ctaText?: string;
  ctaLink?: string;
  style?: SectionStyle;
}

export interface ContactInfo {
  title?: string;
  subtitle?: string;
  phone: string;
  email: string;
  address: string;
  openingHoursWeekday: string;
  openingHoursWeekend: string;
  whatsappNumber: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  mapEmbedUrl?: string;
  style?: SectionStyle;
}

export interface SectionVisibility {
  hero: boolean;
  about: boolean;
  features: boolean;
  schedule: boolean;
  video: boolean;
  pricing: boolean;
  trainers: boolean;
  gallery: boolean;
  testimonials: boolean;
  faq: boolean;
  cta: boolean;
  contact: boolean;
  [key: string]: boolean;
}

export interface SeoSettings {
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  customCss?: string;
}

export interface LandingPageData {
  theme: ThemeSettings;
  hero: HeroSection;
  about: AboutSection;
  features: FeatureItem[];
  schedule?: ScheduleSection;
  video?: VideoSection;
  pricing: PricingPlan[];
  trainers: TrainerCard[];
  gallery: GalleryItem[];
  testimonials: TestimonialItem[];
  faq?: FaqSection;
  cta?: CtaBannerSection;
  customBlocks?: CustomContentBlock[];
  contact: ContactInfo;
  sections: SectionVisibility;
  sectionOrder?: string[];
  seo?: SeoSettings;
}

// ----------------------------------------------------
// DEFAULT DATA & TEMPLATES
// ----------------------------------------------------

export const DEFAULT_SECTION_ORDER = [
  'hero',
  'about',
  'features',
  'schedule',
  'video',
  'pricing',
  'trainers',
  'gallery',
  'testimonials',
  'faq',
  'cta',
  'contact',
];

export const defaultLandingPageData: LandingPageData = {
  theme: {
    templateId: 'cyber-neon',
    primaryColor: '#a3e635',
    secondaryColor: '#22c55e',
    fontFamily: 'outfit',
    tagline: 'Transform Your Body, Mind & Spirit',
    announcementText: '🔥 Special Offer: Join today & get 20% off annual memberships!',
    showAnnouncement: true,
    announcementLink: '#pricing',
  },
  hero: {
    title: 'FORGE YOUR ULTIMATE PHYSIQUE',
    subtitle: 'State-of-the-art facility, elite trainers, and an inspiring fitness community dedicated to helping you unlock your maximum potential.',
    primaryCtaText: 'Explore Memberships',
    secondaryCtaText: 'Contact Us',
    heroImageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80',
    badgeText: '#1 PREMIUM GYM & FITNESS CENTER',
    stat1Number: '1,500+',
    stat1Label: 'Active Members',
    stat2Number: '15+',
    stat2Label: 'Expert Coaches',
    stat3Number: '24/7',
    stat3Label: 'Facility Access',
    stat4Number: '99%',
    stat4Label: 'Satisfaction',
    style: {
      backgroundOverlayOpacity: 85,
    },
  },
  about: {
    title: 'WHERE CHAMPIONS ARE MADE',
    subtitle: 'More than just a gym — we are a movement built on strength, discipline, and community.',
    description: 'At Iron Lodge Gym, we provide top-tier strength training gear, cardio equipment, and dedicated spaces designed for athletes of all levels. Whether you are aiming to build muscle, lose body fat, or improve your health, our team supports you every step of the way.',
    imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    highlight1Title: 'Pro-Grade Equipment',
    highlight1Desc: 'Hammer Strength, Eleiko, and Rogue fitness gear engineered for peak performance.',
    highlight2Title: 'Personalized Coaching',
    highlight2Desc: 'Custom workout and nutrition plans tailored to your specific fitness goals.',
    highlight3Title: 'Vibrant Community',
    highlight3Desc: 'Motivating group workouts and supportive members driving each other forward.',
    style: {
      backgroundOverlayOpacity: 90,
    },
  },
  features: [
    {
      id: 'f1',
      title: 'Heavy Strength & Powerlifting Zone',
      description: 'Dedicated platforms, competition bars, bumper plates, and power racks.',
      icon: 'dumbbell',
    },
    {
      id: 'f2',
      title: 'HIIT & Functional Training',
      description: 'Dynamic turf area equipped with kettlebells, plyo boxes, ropes, and sleds.',
      icon: 'flame',
    },
    {
      id: 'f3',
      title: 'Personal Training & Nutrition',
      description: '1-on-1 coaching sessions designed by certified strength specialists.',
      icon: 'trophy',
    },
    {
      id: 'f4',
      title: 'Recovery & Steam Lounge',
      description: 'Relaxation zones, post-workout saunas, and hydrotherapy massage stations.',
      icon: 'heart',
    },
    {
      id: 'f5',
      title: 'Advanced Cardio Deck',
      description: 'Skillmills, Stairmasters, rowers, and treadmills with live performance tracking.',
      icon: 'zap',
    },
    {
      id: 'f6',
      title: '24/7 Keycard Member Access',
      description: 'Train on your schedule with secure round-the-clock biometric access.',
      icon: 'clock',
    },
  ],
  schedule: {
    title: 'WEEKLY CLASS TIMETABLE',
    subtitle: 'High-energy group workouts led by expert coaches every day of the week.',
    items: [
      { id: 'sc1', day: 'Mon', time: '07:00 AM - 08:00 AM', className: 'HIIT Power Hour', trainer: 'Sarah Ahmed', intensity: 'High', category: 'Cardio' },
      { id: 'sc2', day: 'Mon', time: '06:00 PM - 07:15 PM', className: 'Heavy Iron Barbell Club', trainer: 'Hamza Khan', intensity: 'Extreme', category: 'Strength' },
      { id: 'sc3', day: 'Tue', time: '08:00 AM - 09:00 AM', className: 'Mobility & Core Conditioning', trainer: 'Sarah Ahmed', intensity: 'Medium', category: 'Mobility' },
      { id: 'sc4', day: 'Wed', time: '06:30 PM - 07:30 PM', className: 'Functional Athlete Bootcamp', trainer: 'Zayn Ali', intensity: 'High', category: 'Functional' },
      { id: 'sc5', day: 'Thu', time: '07:00 AM - 08:00 AM', className: 'Cross-Training Blast', trainer: 'Sarah Ahmed', intensity: 'High', category: 'HIIT' },
      { id: 'sc6', day: 'Fri', time: '05:30 PM - 07:00 PM', className: 'Powerlifting Max Effort', trainer: 'Hamza Khan', intensity: 'Extreme', category: 'Strength' },
      { id: 'sc7', day: 'Sat', time: '10:00 AM - 11:30 AM', className: 'Weekend Warrior Circuit', trainer: 'Zayn Ali', intensity: 'High', category: 'Circuit' },
    ],
  },
  video: {
    title: 'EXPERIENCE THE ATMOSPHERE',
    subtitle: 'Take a virtual tour inside our world-class gym and see our athletes in action.',
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    posterUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1200&q=80',
    badgeText: 'FACILITY TOUR & PROMO',
  },
  pricing: [
    {
      id: 'p1',
      name: 'Monthly Pass',
      price: 'PKR 6,500',
      period: '/ month',
      description: 'Great for beginners and consistent gym-goers.',
      features: [
        'Full Gym Floor Access',
        'Locker Room & Shower Access',
        'Free Fitness Orientation',
        'Standard Opening Hours',
      ],
      isPopular: false,
      ctaText: 'Get Started',
    },
    {
      id: 'p2',
      name: 'Quarterly Pass',
      price: 'PKR 18,000',
      period: '/ 3 months',
      description: 'Our most popular plan for dedicated fitness enthusiasts.',
      features: [
        '24/7 Unlimited Access',
        '2 Personal Training Sessions / mo',
        'Sauna & Steam Room Access',
        'Diet & Nutrition Consultation',
        'Free Guest Passes (2/mo)',
      ],
      isPopular: true,
      ctaText: 'Join Quarterly',
    },
    {
      id: 'p3',
      name: 'Annual Pass',
      price: 'PKR 60,000',
      period: '/ year',
      description: 'Maximum value plan for long-term transformation.',
      features: [
        'All Quarterly Benefits Included',
        'Unlimited Guest Passes',
        'Free Gym Apparel & Shaker',
        'Priority PT Booking Slot',
        'Save over 35% annually',
      ],
      isPopular: false,
      ctaText: 'Get Annual Pass',
    },
  ],
  trainers: [
    {
      id: 't1',
      name: 'Hamza Khan',
      role: 'Head Strength & Conditioning Coach',
      imageUrl: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=600&q=80',
      bio: '10+ years coaching bodybuilders and powerlifters to peak condition.',
      specialties: ['Hypertrophy', 'Powerlifting', 'Rehab'],
    },
    {
      id: 't2',
      name: 'Sarah Ahmed',
      role: 'Functional Fitness Specialist',
      imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80',
      bio: 'Expert in HIIT, mobility work, and high-energy transformation programs.',
      specialties: ['HIIT', 'Fat Loss', 'Mobility'],
    },
    {
      id: 't3',
      name: 'Zayn Ali',
      role: 'Personal Trainer & Nutritionist',
      imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=80',
      bio: 'Passionate about custom body recomposition and nutritional science.',
      specialties: ['Nutrition', 'Body Recomposition', 'Beginner Training'],
    },
  ],
  gallery: [
    {
      id: 'g1',
      imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
      caption: 'Main Weightlifting Area',
    },
    {
      id: 'g2',
      imageUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80',
      caption: 'Cardio Deck & View',
    },
    {
      id: 'g3',
      imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
      caption: 'Turf & Functional Zone',
    },
    {
      id: 'g4',
      imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=80',
      caption: 'Dumbbell & Bench Racks',
    },
  ],
  testimonials: [
    {
      id: 'tm1',
      name: 'Bilal Hassan',
      role: 'Member since 2023',
      quote: 'Iron Lodge Gym completely changed my lifestyle. The trainers know their stuff and the environment keeps you locked in.',
      rating: 5,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'tm2',
      name: 'Ayesha Malik',
      role: 'VIP Pro Member',
      quote: 'Clean equipment, 24/7 keycard access, and super helpful staff! Best gym in the city hands down.',
      rating: 5,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'tm3',
      name: 'Usman Tariq',
      role: 'Powerlifter',
      quote: 'The heavy platforms and high quality barbells are unbeatable. If you are serious about gains, this is where you need to train.',
      rating: 5,
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
    },
  ],
  faq: {
    title: 'FREQUENTLY ASKED QUESTIONS',
    subtitle: 'Everything you need to know about memberships, facility rules, and personal training.',
    items: [
      {
        id: 'faq1',
        question: 'What are your standard opening hours?',
        answer: 'We are open Monday through Saturday from 6:00 AM to 11:00 PM, and Sundays from 10:00 AM to 8:00 PM. VIP pass members enjoy round-the-clock 24/7 biometric keycard access.',
      },
      {
        id: 'faq2',
        question: 'Do you offer personal training packages?',
        answer: 'Yes! We have certified male and female personal trainers specializing in muscle gain, fat loss, powerlifting, rehab, and sports conditioning. Quarterly and Annual passes include complimentary PT sessions.',
      },
      {
        id: 'faq3',
        question: 'Can I get a trial pass before signing up?',
        answer: 'Absolutely. Drop by during operating hours for a guided facility tour and a 1-day complimentary workout pass. Just bring your CNIC or photo ID.',
      },
      {
        id: 'faq4',
        question: 'What amenities are included in membership?',
        answer: 'All memberships include free high-speed WiFi, secure locker rooms, hot showers, water refill stations, and full access to our main strength and cardio decks.',
      },
    ],
  },
  cta: {
    title: 'READY TO START YOUR FITNESS JOURNEY?',
    subtitle: 'Join over 1,500+ dedicated athletes pushing past their limits every day. Claim your membership today.',
    badgeText: 'JOIN TODAY & LEVEL UP',
    primaryCtaText: 'Get Started Now',
    primaryCtaLink: '#pricing',
    secondaryCtaText: 'Contact Team',
    secondaryCtaLink: '#contact',
    style: {
      backgroundImageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1600&q=80',
      backgroundOverlayOpacity: 85,
    },
  },
  customBlocks: [],
  contact: {
    title: 'VISIT OUR FACILITY',
    subtitle: 'Drop by for a tour or contact us for trial passes and membership inquiries.',
    phone: '+92 300 1234567',
    email: 'info@ironlodgegym.com',
    address: 'Plot 45, Main Boulevard, Phase 6, DHA, Lahore',
    openingHoursWeekday: 'Mon - Sat: 6:00 AM - 11:00 PM',
    openingHoursWeekend: 'Sunday: 10:00 AM - 8:00 PM',
    whatsappNumber: '+923001234567',
    instagramUrl: 'https://instagram.com',
    facebookUrl: 'https://facebook.com',
    youtubeUrl: 'https://youtube.com',
    twitterUrl: 'https://x.com',
  },
  sections: {
    hero: true,
    about: true,
    features: true,
    schedule: true,
    video: true,
    pricing: true,
    trainers: true,
    gallery: true,
    testimonials: true,
    faq: true,
    cta: true,
    contact: true,
  },
  sectionOrder: DEFAULT_SECTION_ORDER,
  seo: {
    metaTitle: 'Iron Lodge Gym | Premier Fitness & Strength Training Center',
    metaDescription: 'Unleash your potential at Iron Lodge Gym. Elite strength equipment, certified coaches, functional turf, and 24/7 keycard access.',
  },
};

// ----------------------------------------------------
// 6 WORDPRESS THEME TEMPLATES
// ----------------------------------------------------

export interface WebsiteTemplate {
  id: string;
  name: string;
  tag: string;
  description: string;
  previewGradient: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: 'inter' | 'montserrat' | 'oswald' | 'bebas-neue' | 'poppins' | 'outfit';
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBgUrl: string;
  aboutTitle: string;
  aboutDesc: string;
  aboutImgUrl: string;
  ctaBgUrl: string;
}

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: 'cyber-neon',
    name: 'Cyber Neon (Modern Tech)',
    tag: 'DEFAULT',
    description: 'Obsidian dark aesthetic with electrifying lime green accents. Sleek, high-tech, and razor-sharp.',
    previewGradient: 'from-lime-500 to-emerald-700',
    primaryColor: '#a3e635',
    secondaryColor: '#22c55e',
    fontFamily: 'outfit',
    heroBadge: '#1 PREMIUM TECH FITNESS CENTER',
    heroTitle: 'FORGE YOUR ULTIMATE PHYSIQUE',
    heroSubtitle: 'State-of-the-art facility, elite trainers, and an inspiring fitness community dedicated to unlocking your maximum potential.',
    heroBgUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80',
    aboutTitle: 'WHERE CHAMPIONS ARE MADE',
    aboutDesc: 'At Iron Lodge Gym, we provide top-tier strength training gear, cardio equipment, and dedicated spaces designed for athletes of all levels.',
    aboutImgUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    ctaBgUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'crimson-beast',
    name: 'Crimson Beast (Hardcore Iron)',
    tag: 'POWERLIFTING & BODYBUILDING',
    description: 'Aggressive fiery crimson red with deep charcoal black. Built for raw power, heavy lifting, and hardcore grit.',
    previewGradient: 'from-red-600 to-rose-900',
    primaryColor: '#ef4444',
    secondaryColor: '#dc2626',
    fontFamily: 'oswald',
    heroBadge: 'RAW POWER & HEAVY IRON',
    heroTitle: 'UNLEASH THE BEAST WITHIN',
    heroSubtitle: 'Heavy iron platforms, calibrated steel plates, and zero distractions. Train where champions are forged in sweat and steel.',
    heroBgUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1600&q=80',
    aboutTitle: 'BUILT FOR SERIOUS LIFTERS',
    aboutDesc: 'Engineered for dedicated athletes who demand competition-spec Eleiko bars, monolithic power racks, and an intense brotherhood of strength.',
    aboutImgUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=1200&q=80',
    ctaBgUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'royal-blue',
    name: 'Royal Electric Blue (Athletic Performance)',
    tag: 'ATHLETICS & HYBRID',
    description: 'Vibrant cobalt blue with sharp cyan highlights. Dynamic athletic conditioning and cutting-edge sports science.',
    previewGradient: 'from-blue-500 to-cyan-700',
    primaryColor: '#3b82f6',
    secondaryColor: '#06b6d4',
    fontFamily: 'montserrat',
    heroBadge: 'ELITE ATHLETIC PERFORMANCE',
    heroTitle: 'ELEVATE YOUR ATHLETIC PEAK',
    heroSubtitle: 'Sports-specific conditioning, turf agility zones, and science-backed recovery methods tailored for high performers.',
    heroBgUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1600&q=80',
    aboutTitle: 'SCIENCE MEETS SWEAT',
    aboutDesc: 'Discover a modern training sanctuary where biometric tracking, functional turf, and specialized athletic coaches elevate your game.',
    aboutImgUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    ctaBgUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'golden-royalty',
    name: 'Golden Royalty (Luxury Boutique)',
    tag: 'LUXURY & WELLNESS',
    description: 'Opulent warm gold accents on matte obsidian black. Premium boutique experience with luxury spa & recovery.',
    previewGradient: 'from-amber-400 to-yellow-600',
    primaryColor: '#eab308',
    secondaryColor: '#f59e0b',
    fontFamily: 'bebas-neue',
    heroBadge: 'EXCLUSIVE BOUTIQUE HEALTH CLUB',
    heroTitle: 'THE PINNACLE OF LUXURY FITNESS',
    heroSubtitle: 'Bespoke fitness experiences, artisanal recovery lounges, and world-class personal training in an immaculate environment.',
    heroBgUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80',
    aboutTitle: 'EXPERIENCE REFINED WELLNESS',
    aboutDesc: 'We have elevated the gym experience with pristine custom equipment, eucalyptus steam suites, and white-glove member concierge.',
    aboutImgUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
    ctaBgUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'pure-wellness',
    name: 'Pure Wellness (Holistic & Flow)',
    tag: 'HOLISTIC & MOBILITY',
    description: 'Calming emerald and mint accents on dark forest slate. Focus on longevity, posture, strength, and mindful fitness.',
    previewGradient: 'from-emerald-400 to-teal-700',
    primaryColor: '#10b981',
    secondaryColor: '#14b8a6',
    fontFamily: 'poppins',
    heroBadge: 'HOLISTIC BODY & MIND TRANSFORMATION',
    heroTitle: 'SUSTAINABLE LIFELONG VITALITY',
    heroSubtitle: 'Build functional strength, master flexibility, and revitalize your health with comprehensive wellness and nutrition programs.',
    heroBgUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80',
    aboutTitle: 'BALANCE, STRENGTH & RECOVERY',
    aboutDesc: 'Our philosophy connects mindful movement with progressive strength training, creating sustainable lifelong vitality.',
    aboutImgUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    ctaBgUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'sunset-forge',
    name: 'Sunset Forge (High-Energy HIIT)',
    tag: 'HIIT & FUNCTIONAL',
    description: 'Electrifying sunset amber orange on deep night tones. Maximum calorie burn, high tempo music, and team energy.',
    previewGradient: 'from-orange-500 to-amber-700',
    primaryColor: '#f97316',
    secondaryColor: '#ea580c',
    fontFamily: 'inter',
    heroBadge: 'HIGH-VOLTAGE ENERGY TRAINING',
    heroTitle: 'IGNITE YOUR METABOLIC FIRE',
    heroSubtitle: 'Heart-pumping group classes, dynamic intervals, and an unbeatable community vibe pushing you past your comfort zone.',
    heroBgUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1600&q=80',
    aboutTitle: 'HIGH TEMPO. UNSTOPPABLE DRIVE.',
    aboutDesc: 'Join high-octane workout sessions programmed to maximize athletic endurance, explosive power, and full-body conditioning.',
    aboutImgUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=1200&q=80',
    ctaBgUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1600&q=80',
  },
];

