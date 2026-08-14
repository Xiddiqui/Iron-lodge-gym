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
}

export interface ThemeSettings {
  primaryColor: string; // e.g. '#f97316' or '#3b82f6' or '#10b981'
  tagline: string;
  announcementText: string;
  showAnnouncement: boolean;
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
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: string; // icon identifier, e.g. 'dumbbell' | 'flame' | 'trophy' | 'heart' | 'shield' | 'clock' | 'users' | 'zap'
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

export interface TrainerCard {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
  bio: string;
  specialties: string[];
}

export interface GalleryItem {
  id: string;
  imageUrl: string;
  caption: string;
}

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatarUrl?: string;
}

export interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  openingHoursWeekday: string;
  openingHoursWeekend: string;
  whatsappNumber: string;
  instagramUrl: string;
  facebookUrl: string;
  mapEmbedUrl?: string;
}

export interface SectionVisibility {
  hero: boolean;
  about: boolean;
  features: boolean;
  pricing: boolean;
  trainers: boolean;
  gallery: boolean;
  testimonials: boolean;
  contact: boolean;
}

export interface LandingPageData {
  theme: ThemeSettings;
  hero: HeroSection;
  about: AboutSection;
  features: FeatureItem[];
  pricing: PricingPlan[];
  trainers: TrainerCard[];
  gallery: GalleryItem[];
  testimonials: TestimonialItem[];
  contact: ContactInfo;
  sections: SectionVisibility;
}

export const defaultLandingPageData: LandingPageData = {
  theme: {
    primaryColor: '#a3e635',
    tagline: 'Transform Your Body, Mind & Spirit',
    announcementText: '🔥 Special Offer: Join today & get 20% off annual memberships!',
    showAnnouncement: true,
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
        'Free Iron Lodge Gym Apparel',
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
  contact: {
    phone: '+92 300 1234567',
    email: 'info@ironlodgegym.com',
    address: 'Plot 45, Main Boulevard, Phase 6, DHA, Lahore',
    openingHoursWeekday: 'Mon - Sat: 6:00 AM - 11:00 PM',
    openingHoursWeekend: 'Sunday: 10:00 AM - 8:00 PM',
    whatsappNumber: '+923001234567',
    instagramUrl: 'https://instagram.com',
    facebookUrl: 'https://facebook.com',
  },
  sections: {
    hero: true,
    about: true,
    features: true,
    pricing: true,
    trainers: true,
    gallery: true,
    testimonials: true,
    contact: true,
  },
};
