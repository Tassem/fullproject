import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Bot, Zap, Globe, FileText, TrendingUp, Star, Check,
  ArrowRight, Sparkles, Shield, Mail, ExternalLink, LogIn,
  UserPlus, Image, ChevronDown, Play, Users, Activity,
  Server, Clock, MessageSquare, Layers, BarChart3, Cpu,
  CheckCircle, Menu, X, Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan {
  id: number; name: string; slug: string; description: string | null;
  price_monthly: number; price_yearly: number;
  monthly_credits: number; max_sites: number;
  rate_limit_daily: number;
  has_telegram_bot: boolean;
  has_blog_automation: boolean; has_image_generator: boolean;
  is_active: boolean; sort_order: number; is_free: boolean;
}
interface SiteInfo { settings: Record<string, string>; plans: Plan[]; }

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  en: {
    login: "Login", getStarted: "Get Started Free", startFree: "Start for Free",
    signIn: "Sign In", viewDemo: "Watch Demo",
    nav_features: "Features", nav_how: "How It Works",
    nav_pricing: "Pricing", nav_faq: "FAQ",
    stats_users: "Active Users", stats_articles: "Articles Generated",
    stats_sites: "Connected Sites", stats_uptime: "Uptime",
    features_badge: "Platform Features",
    how_badge: "Simple Setup",
    pricing_badge: "Transparent Pricing",
    pricing_monthly: "Monthly", pricing_yearly: "Yearly",
    pricing_save: "Save 20%",
    pricing_popular: "Most Popular",
    pricing_cta: "Get Started",
    pricing_free_cta: "Start Free",
    pricing_unlimited: "Unlimited",
    per_month: "/month", per_year: "/year",
    faq_badge: "FAQ",
    testimonials_badge: "Testimonials",
    contact_title: "Need Help?", contact_subtitle: "We're always here for you",
    cta_badge: "Ready to Start?",
    footer_rights: "All rights reserved.",
    unlimited: "Unlimited",
    feature_cards: "cards/day",
    feature_articles: "articles/month",
    feature_sites: "WordPress sites",
    feature_blog: "Blog Automation",
    feature_image: "News Card Generator",
    feature_telegram: "Telegram Bot",
    feature_credits: "credits included",
    billing_yearly: "Billed annually",
  },
  ar: {
    login: "دخول", getStarted: "ابدأ مجاناً", startFree: "ابدأ مجاناً",
    signIn: "تسجيل الدخول", viewDemo: "شاهد العرض",
    nav_features: "المميزات", nav_how: "كيف يعمل",
    nav_pricing: "الأسعار", nav_faq: "الأسئلة الشائعة",
    stats_users: "مستخدم نشط", stats_articles: "مقال منشور",
    stats_sites: "موقع متصل", stats_uptime: "وقت التشغيل",
    features_badge: "مميزات المنصة",
    how_badge: "إعداد سهل",
    pricing_badge: "أسعار شفافة",
    pricing_monthly: "شهري", pricing_yearly: "سنوي",
    pricing_save: "وفر 20%",
    pricing_popular: "الأكثر طلباً",
    pricing_cta: "ابدأ الآن",
    pricing_free_cta: "ابدأ مجاناً",
    pricing_unlimited: "غير محدود",
    per_month: "/شهر", per_year: "/سنة",
    faq_badge: "الأسئلة الشائعة",
    testimonials_badge: "آراء العملاء",
    contact_title: "تحتاج مساعدة؟", contact_subtitle: "نحن هنا دائماً من أجلك",
    cta_badge: "جاهز للبدء؟",
    footer_rights: "جميع الحقوق محفوظة.",
    unlimited: "غير محدود",
    feature_cards: "بطاقة/يوم",
    feature_articles: "مقال/شهر",
    feature_sites: "مواقع WordPress",
    feature_blog: "أتمتة المدونة",
    feature_image: "منشئ البطاقات الإخبارية",
    feature_telegram: "بوت تيليغرام",
    feature_credits: "رصيد مُضمَّن",
    billing_yearly: "يُفوتر سنوياً",
  },
};

// ── Static Feature Cards ───────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Sparkles,
    color: "from-orange-500 to-amber-500",
    bg: "bg-orange-500/10 border-orange-500/20",
    titleEn: "AI Content Generation", titleAr: "توليد محتوى بالذكاء الاصطناعي",
    descEn: "Generate SEO-optimized articles in minutes using the latest AI models (GPT-4, Gemini, Claude).",
    descAr: "أنشئ مقالات محسّنة لمحركات البحث في دقائق باستخدام أحدث نماذج الذكاء الاصطناعي.",
  },
  {
    icon: Globe,
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-500/10 border-blue-500/20",
    titleEn: "WordPress Auto-Publish", titleAr: "نشر تلقائي على WordPress",
    descEn: "Connect unlimited WordPress sites and publish directly from the dashboard — fully automated.",
    descAr: "اربط مواقع WordPress وانشر المحتوى تلقائياً من لوحة التحكم دون أي تدخل يدوي.",
  },
  {
    icon: Activity,
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    titleEn: "RSS Feed Monitoring", titleAr: "مراقبة مصادر RSS",
    descEn: "Monitor niche RSS feeds and trigger AI content generation automatically on new entries.",
    descAr: "راقب مصادر RSS في مجالك وشغّل توليد المحتوى تلقائياً عند ظهور أي منشور جديد.",
  },
  {
    icon: Shield,
    color: "from-purple-500 to-violet-500",
    bg: "bg-purple-500/10 border-purple-500/20",
    titleEn: "Built-in SEO Engine", titleAr: "محرك SEO مدمج",
    descEn: "Every article is optimized with proper headings, meta tags, keywords, and Rank Math scoring.",
    descAr: "كل مقال محسَّن بعناوين صحيحة وميتا تاغ ومفاتيح بحثية ونقاط Rank Math.",
  },
  {
    icon: Image,
    color: "from-pink-500 to-rose-500",
    bg: "bg-pink-500/10 border-pink-500/20",
    titleEn: "News Card Generator", titleAr: "منشئ البطاقات الإخبارية",
    descEn: "Design stunning branded news cards from templates. Post instantly to Telegram channels.",
    descAr: "صمّم بطاقات إخبارية احترافية من قوالب جاهزة وانشرها فوراً في قنوات تيليغرام.",
  },
  {
    icon: Bot,
    color: "from-cyan-500 to-sky-500",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    titleEn: "Telegram Bot Integration", titleAr: "تكامل بوت تيليغرام",
    descEn: "Send news cards to Telegram channels automatically. Manage your account via a dedicated bot.",
    descAr: "أرسل البطاقات تلقائياً إلى قنوات تيليغرام وأدر حسابك عبر بوت مخصص.",
  },
];

// ── Static FAQ ────────────────────────────────────────────────────────────────
const DEFAULT_FAQ_EN = [
  { q: "Is there a free plan?", a: "Yes! Our Free plan includes 5 cards/day and full access to the news card generator. No credit card required." },
  { q: "Can I connect multiple WordPress sites?", a: "Yes. Depending on your plan, you can connect from 1 site (Starter) up to unlimited sites (Agency)." },
  { q: "Which AI providers are supported?", a: "We support OpenAI (GPT-4), OpenRouter (Claude, Gemini, Mistral, etc.), Google Gemini, and custom AI endpoints." },
  { q: "Is my content unique?", a: "Absolutely. Our pipeline rewrites content from source articles using AI, ensuring original, plagiarism-free output." },
  { q: "Can I publish in any language?", a: "Yes. You can configure the AI prompt to generate content in any language including Arabic, English, French, etc." },
  { q: "How does billing work?", a: "Plans are billed monthly or yearly. You can upgrade, downgrade, or cancel anytime from your account dashboard." },
];
const DEFAULT_FAQ_AR = [
  { q: "هل هناك خطة مجانية؟", a: "نعم! خطتنا المجانية تتضمن 5 بطاقات يومياً مع وصول كامل لمنشئ البطاقات. لا حاجة لبطاقة ائتمان." },
  { q: "هل يمكنني ربط عدة مواقع WordPress؟", a: "نعم. بحسب خطتك يمكنك ربط من موقع واحد (Starter) حتى عدد غير محدود (Agency)." },
  { q: "ما هي مزودات الذكاء الاصطناعي المدعومة؟", a: "ندعم OpenAI (GPT-4) وOpenRouter (Claude, Gemini, Mistral...) وGoogle Gemini وواجهات AI مخصصة." },
  { q: "هل المحتوى فريد ومبتكر؟", a: "بالتأكيد. نظام الأتمتة يُعيد كتابة المحتوى بالكامل باستخدام الذكاء الاصطناعي لضمان الأصالة." },
  { q: "هل يمكن النشر بأي لغة؟", a: "نعم. يمكنك ضبط نموذج الذكاء الاصطناعي لتوليد المحتوى بأي لغة (عربي، إنجليزي، فرنسي، إلخ)." },
  { q: "كيف تعمل الفوترة؟", a: "الخطط تُفوتر شهرياً أو سنوياً. يمكنك الترقية أو التخفيض أو الإلغاء في أي وقت من لوحة حسابك." },
];

// ── Static Testimonials ───────────────────────────────────────────────────────
const DEFAULT_TESTIMONIALS = [
  {
    nameEn: "Ahmed Al-Rashidi", nameAr: "أحمد الراشدي",
    roleEn: "News Website Owner", roleAr: "مدير موقع إخباري",
    textEn: "MediaFlow transformed how we publish content. We went from 5 articles/day manually to 50+ articles automatically. The SEO quality is outstanding.",
    textAr: "MediaFlow غيّر طريقة نشرنا للمحتوى كلياً. انتقلنا من 5 مقالات يدوياً إلى أكثر من 50 مقالاً تلقائياً. جودة الـ SEO رائعة.",
    stars: 5,
  },
  {
    nameEn: "Sarah Johnson", nameAr: "سارة جونسون",
    roleEn: "Digital Marketing Agency", roleAr: "وكالة تسويق رقمي",
    textEn: "We manage 12 client websites through MediaFlow. The RSS-to-WordPress pipeline is flawless. Our clients love the consistent posting schedule.",
    textAr: "ندير 12 موقعاً لعملائنا عبر MediaFlow. خط أنابيب RSS إلى WordPress لا تشوبه شائبة. عملاؤنا يحبون انتظام النشر.",
    stars: 5,
  },
  {
    nameEn: "Khalid Al-Mansouri", nameAr: "خالد المنصوري",
    roleEn: "Tech Blogger", roleAr: "مدوّن تقني",
    textEn: "The Telegram bot integration is a game changer. My channel gets fresh news cards every hour and my audience grew 3x in 2 months.",
    textAr: "تكامل بوت تيليغرام غيّر قواعد اللعبة. قناتي تحصل على بطاقات أخبار كل ساعة وجمهوري نما 3 أضعاف في شهرين.",
    stars: 5,
  },
];

// ── FAQ Item Component ────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-semibold text-white text-sm pr-4">{q}</span>
        <ChevronDown className={cn("w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-zinc-400 text-sm leading-relaxed border-t border-white/5 pt-4">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Landing Component ─────────────────────────────────────────────────────
export default function Landing() {
  const [lang, setLang] = useState<"en" | "ar">(() =>
    (localStorage.getItem("landing_lang") as "en" | "ar") || "en"
  );
  const [billingYearly, setBillingYearly] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, navigate] = useLocation();

  const t = T[lang];
  const isAr = lang === "ar";

  const toggleLang = () => {
    const next = lang === "en" ? "ar" : "en";
    setLang(next);
    localStorage.setItem("landing_lang", next);
  };

  const { data } = useQuery<SiteInfo>({
    queryKey: ["public", "site-info"],
    queryFn: async () => {
      const r = await fetch("/api/public/site-info");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const s = data?.settings ?? {};
  const plans = (data?.plans ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const registrationEnabled = s.registration_enabled !== "false";
  const siteName = s.site_name || "MediaFlow";
  const siteLogo = s.site_logo_emoji || "⚡";

  // Hero
  const heroBadge = s.landing_hero_badge || (isAr ? "منصة أتمتة المحتوى" : "Trusted by 2,000+ content creators");
  const heroTitle = isAr
    ? (s.landing_title_ar || "أتمتة المحتوى بالذكاء الاصطناعي")
    : (s.landing_title || "AI-Powered Content Automation Platform");
  const heroSubtitle = isAr
    ? (s.landing_subtitle_ar || "من قراءة RSS إلى نشر مقالات WordPress محسّنة لـ SEO — كل شيء تلقائي بالكامل.")
    : (s.landing_subtitle || "From RSS monitoring to publishing SEO-optimized WordPress articles — fully automated.");

  // Stats
  const stats = [
    { value: s.landing_stats_users || "2,400+", label: isAr ? (s.landing_stats_users_label || t.stats_users) : (s.landing_stats_users_label || t.stats_users), icon: Users, color: "text-indigo-400" },
    { value: s.landing_stats_articles || "120K+", label: isAr ? (s.landing_stats_articles_label || t.stats_articles) : (s.landing_stats_articles_label || t.stats_articles), icon: FileText, color: "text-emerald-400" },
    { value: s.landing_stats_sites || "5,800+", label: isAr ? (s.landing_stats_sites_label || t.stats_sites) : (s.landing_stats_sites_label || t.stats_sites), icon: Server, color: "text-blue-400" },
    { value: s.landing_stats_uptime || "99.9%", label: isAr ? (s.landing_stats_uptime_label || t.stats_uptime) : (s.landing_stats_uptime_label || t.stats_uptime), icon: Clock, color: "text-orange-400" },
  ];

  // Section titles
  const featuresTitle = isAr ? (s.landing_features_title_ar || "كل ما تحتاجه في مكان واحد") : (s.landing_features_title || "Everything You Need");
  const featuresSub = isAr ? (s.landing_features_subtitle_ar || "منصة واحدة للبطاقات الإخبارية وأتمتة المدونة") : (s.landing_features_subtitle || "One platform for news cards and full blog automation");
  const howTitle = isAr ? (s.landing_how_title_ar || "كيف يعمل؟") : (s.landing_how_title || "How It Works");
  const howSub = isAr ? (s.landing_how_subtitle_ar || "ثلاث خطوات للنشر التلقائي") : (s.landing_how_subtitle || "Three steps to automated publishing");
  const pricingTitle = isAr ? (s.landing_pricing_title_ar || "أسعار شفافة وبسيطة") : (s.landing_pricing_title || "Simple, Transparent Pricing");
  const pricingSub = isAr ? (s.landing_pricing_subtitle_ar || "اختر الخطة التي تناسب سير عملك") : (s.landing_pricing_subtitle || "Choose the plan that fits your workflow");
  const faqTitle = isAr ? (s.landing_faq_title_ar || "الأسئلة الشائعة") : (s.landing_faq_title || "Frequently Asked Questions");
  const faqSub = isAr ? (s.landing_faq_subtitle_ar || "كل ما تريد معرفته عن MediaFlow") : (s.landing_faq_subtitle || "Everything you need to know about MediaFlow");
  const testimonialTitle = isAr ? (s.landing_testimonials_title_ar || "ماذا يقول عملاؤنا") : (s.landing_testimonials_title || "What Our Users Say");
  const ctaTitle = isAr ? (s.landing_cta_title_ar || "جاهز لتحويل سير عملك؟") : (s.landing_cta_title || "Ready to Transform Your Workflow?");
  const ctaSub = isAr ? (s.landing_cta_subtitle_ar || "ابدأ مجاناً اليوم — لا حاجة لبطاقة ائتمان.") : (s.landing_cta_subtitle || "Start for free today — no credit card required.");

  // HOW IT WORKS steps
  const steps = [
    {
      num: "01", icon: Activity, color: "from-indigo-500 to-purple-500",
      title: isAr ? (s.landing_how_step1_title_ar || "اربط مصادر RSS") : (s.landing_how_step1_title || "Connect RSS Sources"),
      desc: isAr ? (s.landing_how_step1_desc_ar || "أضف مصادر RSS من أي مجال وضبط جدول المراقبة") : (s.landing_how_step1_desc || "Add RSS feeds from any niche and configure the polling schedule."),
    },
    {
      num: "02", icon: Cpu, color: "from-emerald-500 to-cyan-500",
      title: isAr ? (s.landing_how_step2_title_ar || "الذكاء الاصطناعي يكتب المقالات") : (s.landing_how_step2_title || "AI Writes Articles"),
      desc: isAr ? (s.landing_how_step2_desc_ar || "الذكاء الاصطناعي يحلل المصدر ويكتب مقالاً فريداً محسّناً لـ SEO") : (s.landing_how_step2_desc || "AI analyzes the source and writes unique, SEO-optimized articles with images."),
    },
    {
      num: "03", icon: CheckCircle, color: "from-orange-500 to-rose-500",
      title: isAr ? (s.landing_how_step3_title_ar || "النشر التلقائي على WordPress") : (s.landing_how_step3_title || "Auto-Publish to WordPress"),
      desc: isAr ? (s.landing_how_step3_desc_ar || "المقال يُنشر مباشرة على موقعك مع نقاط Rank Math الكاملة") : (s.landing_how_step3_desc || "Article publishes directly to your site with full Rank Math SEO scores."),
    },
  ];

  // FAQ
  const faqs = DEFAULT_FAQ_EN.map((item, i) => ({
    q: isAr ? (s[`landing_faq_${i + 1}_q_ar`] || DEFAULT_FAQ_AR[i].q) : (s[`landing_faq_${i + 1}_q`] || item.q),
    a: isAr ? (s[`landing_faq_${i + 1}_a_ar`] || DEFAULT_FAQ_AR[i].a) : (s[`landing_faq_${i + 1}_a`] || item.a),
  }));

  // Testimonials
  const testimonials = DEFAULT_TESTIMONIALS.map((t2, i) => ({
    name: isAr ? (s[`landing_testimonial_${i + 1}_name_ar`] || t2.nameAr) : (s[`landing_testimonial_${i + 1}_name`] || t2.nameEn),
    role: isAr ? (s[`landing_testimonial_${i + 1}_role_ar`] || t2.roleAr) : (s[`landing_testimonial_${i + 1}_role`] || t2.roleEn),
    text: isAr ? (s[`landing_testimonial_${i + 1}_text_ar`] || t2.textAr) : (s[`landing_testimonial_${i + 1}_text`] || t2.textEn),
    stars: t2.stars,
  }));

  // Channels
  const channels = [
    s.channel_whatsapp_number && s.channel_whatsapp_enabled === "true"
      ? { icon: "📱", label: "WhatsApp", href: `https://wa.me/${s.channel_whatsapp_number.replace(/\D/g, "")}`, color: "hover:border-green-500/40" } : null,
    s.channel_telegram_url && s.channel_telegram_enabled === "true"
      ? { icon: "✈️", label: "Telegram", href: s.channel_telegram_url, color: "hover:border-blue-500/40" } : null,
    s.channel_discord_url && s.channel_discord_enabled === "true"
      ? { icon: "💬", label: "Discord", href: s.channel_discord_url, color: "hover:border-indigo-500/40" } : null,
    s.channel_email && s.channel_email_enabled === "true"
      ? { icon: "📧", label: "Email", href: `mailto:${s.channel_email}`, color: "hover:border-orange-500/40" } : null,
  ].filter(Boolean);

  const navLinks = [
    { label: t.nav_features, href: "#features" },
    { label: t.nav_how, href: "#how" },
    { label: t.nav_pricing, href: "#pricing" },
    { label: t.nav_faq, href: "#faq" },
  ];

  return (
    <div className={cn("min-h-screen bg-[#060a12] text-white overflow-x-hidden", isAr && "font-arabic")} dir={isAr ? "rtl" : "ltr"}>

      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#060a12]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-indigo-500/30">
              {siteLogo}
            </div>
            <span className="font-black text-white text-lg tracking-tight">{siteName}</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                {l.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button onClick={toggleLang}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/8 text-xs font-semibold text-zinc-400 hover:text-white hover:border-white/20 transition-all">
              <Languages className="w-3.5 h-3.5" />
              {lang === "en" ? "العربية" : "English"}
            </button>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="gap-2 text-zinc-400 hover:text-white text-sm">
                <LogIn className="w-4 h-4" /> {t.login}
              </Button>
            </Link>
            {registrationEnabled && (
              <Link href="/register">
                <Button size="sm" className="gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-lg shadow-indigo-500/20 text-sm font-bold">
                  {t.getStarted}
                </Button>
              </Link>
            )}
            {/* Mobile menu toggle */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 px-5 py-4 space-y-1 bg-[#060a12]">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/5">
                {l.label}
              </a>
            ))}
            <button onClick={toggleLang}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-400 hover:text-white">
              <Languages className="w-4 h-4" />
              {lang === "en" ? "التبديل للعربية" : "Switch to English"}
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-5 text-center overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto space-y-7">
          <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 px-5 py-2 text-xs font-bold uppercase tracking-widest">
            ✨ {heroBadge}
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight tracking-tight">
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              {heroTitle.split(" ").slice(0, -2).join(" ")}
            </span>
            {" "}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              {heroTitle.split(" ").slice(-2).join(" ")}
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            {heroSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {registrationEnabled && (
              <Link href="/register">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 px-8 text-base font-bold shadow-xl shadow-indigo-500/25 h-12">
                  {t.startFree} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <Button size="lg" variant="outline" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
              className="gap-2 border-white/10 text-zinc-300 hover:border-white/30 hover:text-white h-12 px-8 text-base">
              <Play className="w-4 h-4 fill-current" /> {t.viewDemo}
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {[
              isAr ? "✅ بدون بطاقة ائتمان" : "✅ No credit card required",
              isAr ? "🚀 إعداد في 5 دقائق" : "🚀 Setup in 5 minutes",
              isAr ? "🔒 بيانات آمنة 100%" : "🔒 100% secure data",
            ].map((badge) => (
              <span key={badge} className="text-xs text-zinc-500 bg-white/[0.03] border border-white/8 px-3 py-1.5 rounded-full">{badge}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <section className="py-10 px-5 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ value, label, icon: Icon, color }) => (
            <div key={label} className="text-center">
              <div className={cn("text-3xl font-black mb-1", color)}>{value}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section id="features" className="py-24 px-5 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 mb-4 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
            {t.features_badge}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{featuresTitle}</h2>
          <p className="text-zinc-500 text-base max-w-xl mx-auto">{featuresSub}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, color, bg, titleEn, titleAr, descEn, descAr }) => (
            <div key={titleEn}
              className={cn("group p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-black/30", bg)}>
              <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-5 shadow-lg", color)}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-white text-base mb-2">{isAr ? titleAr : titleEn}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{isAr ? descAr : descEn}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section id="how" className="py-24 px-5 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 mb-4 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
              {t.how_badge}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{howTitle}</h2>
            <p className="text-zinc-500 text-base">{howSub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {steps.map(({ num, icon: Icon, color, title, desc }) => (
              <div key={num} className="text-center relative">
                <div className={cn("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-5 shadow-xl", color)}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-5xl font-black text-white/5 absolute -top-2 left-1/2 -translate-x-1/2 select-none">{num}</div>
                <h3 className="font-black text-white text-lg mb-2">{title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────── */}
      {plans.length > 0 && (
        <section id="pricing" className="py-24 px-5 max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 mb-4 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
              {t.pricing_badge}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{pricingTitle}</h2>
            <p className="text-zinc-500 text-base mb-8">{pricingSub}</p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-1 p-1 bg-white/[0.04] border border-white/8 rounded-xl">
              <button onClick={() => setBillingYearly(false)}
                className={cn("px-5 py-2 rounded-lg text-sm font-semibold transition-all", !billingYearly ? "bg-indigo-600 text-white shadow-md" : "text-zinc-400 hover:text-white")}>
                {t.pricing_monthly}
              </button>
              <button onClick={() => setBillingYearly(true)}
                className={cn("px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2", billingYearly ? "bg-indigo-600 text-white shadow-md" : "text-zinc-400 hover:text-white")}>
                {t.pricing_yearly}
                <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-xs px-2 py-0 font-bold">{t.pricing_save}</Badge>
              </button>
            </div>
          </div>

          <div className={cn("grid gap-6", plans.length === 1 ? "max-w-sm mx-auto" : plans.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto" : plans.length === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4")}>
            {plans.map((plan) => {
              const isFree = plan.is_free || plan.price_monthly === 0;
              const isPopular = plan.sort_order === 1 || (plans.length >= 3 && plan.sort_order === 1);
              const price = billingYearly ? plan.price_yearly : plan.price_monthly;
              const features = [
                plan.monthly_credits > 0 && `${plan.monthly_credits >= 999 ? t.unlimited : plan.monthly_credits} ${t.feature_credits}`,
                plan.rate_limit_daily > 0 && `${plan.rate_limit_daily >= 999 ? t.unlimited : plan.rate_limit_daily} ${t.feature_cards}`,
                plan.max_sites > 0 && `${plan.max_sites >= 999 ? t.unlimited : plan.max_sites} ${t.feature_sites}`,
                plan.has_blog_automation && t.feature_blog,
                plan.has_image_generator && t.feature_image,
                plan.has_telegram_bot && t.feature_telegram,
              ].filter(Boolean);

              return (
                <div key={plan.id} className={cn(
                  "relative p-6 rounded-2xl border transition-all duration-300 flex flex-col",
                  isPopular
                    ? "border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-purple-500/5 shadow-xl shadow-indigo-500/10"
                    : "border-white/8 bg-white/[0.02] hover:border-white/15"
                )}>
                  {isPopular && (
                    <div className={cn("absolute -top-3.5", isAr ? "right-1/2 translate-x-1/2" : "left-1/2 -translate-x-1/2")}>
                      <Badge className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-xs font-bold px-4 py-1 shadow-lg">
                        ⭐ {t.pricing_popular}
                      </Badge>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="mb-5">
                    <h3 className="font-black text-white text-xl mb-1">{plan.name}</h3>
                    <div className="flex items-end gap-1 mt-3">
                      {isFree ? (
                        <span className="text-4xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                          {isAr ? "مجاني" : "Free"}
                        </span>
                      ) : (
                        <>
                          <span className="text-4xl font-black text-white">${billingYearly ? (plan.price_yearly / 12).toFixed(0) : plan.price_monthly}</span>
                          <span className="text-zinc-500 text-sm mb-1.5">{t.per_month}</span>
                        </>
                      )}
                    </div>
                    {billingYearly && !isFree && (
                      <p className="text-xs text-zinc-500 mt-1">{t.billing_yearly} — ${plan.price_yearly}{t.per_year}</p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6 flex-1">
                    {features.map((feature) => (
                      <li key={String(feature)} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <Check className={cn("w-4 h-4 mt-0.5 shrink-0", isPopular ? "text-cyan-400" : "text-indigo-400")} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {registrationEnabled && (
                    <Link href="/register">
                      <Button className={cn("w-full font-bold h-11", isPopular
                        ? "bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-lg shadow-indigo-500/25"
                        : "bg-white/8 hover:bg-white/12 text-white border border-white/10")}>
                        {isFree ? t.pricing_free_cta : t.pricing_cta}
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ──────────────────────────────────────── */}
      <section className="py-24 px-5 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 mb-4 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
              {t.testimonials_badge}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{testimonialTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/8 bg-white/[0.02] hover:border-white/15 transition-all">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: item.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-5 italic">"{item.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-black text-sm">
                    {item.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{item.name}</div>
                    <div className="text-zinc-500 text-xs">{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-5 max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 mb-4 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
            {t.faq_badge}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{faqTitle}</h2>
          <p className="text-zinc-500 text-base">{faqSub}</p>
        </div>
        <div className="space-y-3">
          {faqs.map((item, i) => <FAQItem key={i} q={item.q} a={item.a} />)}
        </div>
      </section>

      {/* ── CONTACT ───────────────────────────────────────────── */}
      {channels.length > 0 && (
        <section className="py-16 px-5 border-t border-white/5 bg-white/[0.01]">
          <div className="max-w-3xl mx-auto text-center">
            <MessageSquare className="w-10 h-10 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">{t.contact_title}</h2>
            <p className="text-zinc-500 text-sm mb-8">{t.contact_subtitle}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {channels.map((ch) => ch && (
                <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer"
                  className={cn("flex items-center gap-2.5 px-5 py-3 rounded-xl border border-white/8 bg-white/[0.02] transition-all text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.04]", ch.color)}>
                  <span className="text-base">{ch.icon}</span> {ch.label}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA SECTION ───────────────────────────────────────── */}
      {registrationEnabled && (
        <section className="py-24 px-5">
          <div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-cyan-900/20 p-12 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-cyan-600/10 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-indigo-500/15 blur-3xl pointer-events-none" />
            <div className="relative">
              <Badge className="bg-white/10 text-white border-white/20 mb-6 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
                🚀 {t.cta_badge}
              </Badge>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4">{ctaTitle}</h2>
              <p className="text-zinc-300 text-lg mb-8 max-w-xl mx-auto">{ctaSub}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/register">
                  <Button size="lg" className="gap-2 bg-white text-indigo-900 hover:bg-zinc-100 font-black px-10 h-13 text-base shadow-xl">
                    <UserPlus className="w-4 h-4" /> {t.getStarted}
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10 h-13 px-8 text-base">
                    <LogIn className="w-4 h-4" /> {t.signIn}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center text-sm">
              {siteLogo}
            </div>
            <span className="font-black text-white">{siteName}</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">{l.label}</a>
            ))}
            <Link href="/login" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">{t.login}</Link>
          </nav>

          {/* Copyright */}
          <p className="text-zinc-700 text-xs">
            © {new Date().getFullYear()} {siteName}. {s.landing_footer_copyright || t.footer_rights}
          </p>
        </div>
      </footer>
    </div>
  );
}
