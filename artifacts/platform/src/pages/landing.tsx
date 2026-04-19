import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Bot, Zap, Globe, FileText, TrendingUp, Star, Check,
  ArrowRight, Sparkles, Shield, MessageCircle, Mail,
  ExternalLink, LogIn, UserPlus, Image, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SiteInfo {
  settings: Record<string, string>;
  plans: Array<{
    id: number;
    name: string;
    slug: string;
    priceMonthly: number;
    priceYearly: number;
    cardsPerDay: number;
    maxSites: number;
    articlesPerMonth: number;
    hasTelegramBot: boolean;
    hasBlogAutomation: boolean;
    hasImageGenerator: boolean;
    credits: number;
    isActive: boolean;
    sortOrder: number;
  }>;
}

const PLATFORM_FEATURES = [
  { icon: Sparkles, title: "AI Content Generation", desc: "Generate SEO-optimized articles in minutes using advanced AI models.", color: "text-orange-400 bg-orange-500/10" },
  { icon: Globe, title: "WordPress Auto-Publish", desc: "Connect multiple WordPress sites and publish automatically.", color: "text-blue-400 bg-blue-500/10" },
  { icon: TrendingUp, title: "RSS Feed Monitoring", desc: "Monitor niche feeds and trigger content generation automatically.", color: "text-emerald-400 bg-emerald-500/10" },
  { icon: Shield, title: "Built-in SEO Engine", desc: "Every article is structured with proper headings, meta tags, and keyword optimization.", color: "text-purple-400 bg-purple-500/10" },
  { icon: Image, title: "News Card Generator", desc: "Create stunning news cards with AI-powered templates in seconds.", color: "text-pink-400 bg-pink-500/10" },
  { icon: Bot, title: "Telegram Bot Integration", desc: "Send news cards directly to Telegram channels. Manage your account via bot.", color: "text-cyan-400 bg-cyan-500/10" },
];

export default function Landing() {
  const { data } = useQuery<SiteInfo>({
    queryKey: ["public", "site-info"],
    queryFn: async () => {
      const r = await fetch("/api/public/site-info");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const settings = data?.settings ?? {};
  const plans = data?.plans ?? [];
  const siteName = settings.site_name || "NewsCard Pro";
  const landingTitle = settings.landing_title || "AI-Powered Content Automation";
  const landingSubtitle = settings.landing_subtitle || "Generate, publish, and automate your content workflow.";
  const heroBadge = settings.landing_hero_badge || "Trusted by content creators";
  const registrationEnabled = settings.registration_enabled !== "false";

  const channels = [
    settings.channel_whatsapp_number && settings.channel_whatsapp_enabled === "true"
      ? { icon: "📱", label: "WhatsApp", href: `https://wa.me/${settings.channel_whatsapp_number.replace(/\D/g, "")}`, color: "text-green-400" }
      : null,
    settings.channel_telegram_url && settings.channel_telegram_enabled === "true"
      ? { icon: "✈️", label: "Telegram", href: settings.channel_telegram_url, color: "text-blue-400" }
      : null,
    settings.channel_discord_url && settings.channel_discord_enabled === "true"
      ? { icon: "💬", label: "Discord", href: settings.channel_discord_url, color: "text-indigo-400" }
      : null,
    settings.channel_email && settings.channel_email_enabled === "true"
      ? { icon: "📧", label: "Email", href: `mailto:${settings.channel_email}`, color: "text-orange-400" }
      : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#080c14]/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white tracking-tight">{siteName}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="gap-2 text-zinc-400 hover:text-white">
              <LogIn className="w-4 h-4" /> Login
            </Button>
          </Link>
          {registrationEnabled && (
            <Link href="/register">
              <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <UserPlus className="w-4 h-4" /> Get Started
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto space-y-6">
          <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
            {heroBadge}
          </Badge>
          <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight">
            {landingTitle}
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            {landingSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {registrationEnabled ? (
              <Link href="/register">
                <Button size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-700 px-8">
                  Start for Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : null}
            <Link href="/login">
              <Button size="lg" variant="outline" className="gap-2 border-white/10 text-zinc-300 hover:border-white/30">
                <LogIn className="w-4 h-4" /> Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-black text-white mb-2">Everything You Need</h2>
          <p className="text-zinc-500 text-sm">One platform for news cards and blog automation</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLATFORM_FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-white/10 transition-colors">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", color)}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      {plans.length > 0 && (
        <section className="py-20 px-6 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-white mb-2">Simple Pricing</h2>
            <p className="text-zinc-500 text-sm">Choose the plan that fits your workflow</p>
          </div>
          <div className={cn("grid gap-6", plans.length <= 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto" : "grid-cols-1 md:grid-cols-3")}>
            {[...plans].sort((a, b) => a.sortOrder - b.sortOrder).map((plan) => {
              const isFree = plan.priceMonthly === 0;
              const isPopular = plan.sortOrder === 1 || (!isFree && plans.length > 2 && plan.sortOrder === Math.floor(plans.length / 2));
              return (
                <div key={plan.id} className={cn(
                  "relative p-6 rounded-2xl border transition-all",
                  isPopular ? "border-indigo-500/50 bg-indigo-500/5" : "border-white/8 bg-white/[0.02]"
                )}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-indigo-600 text-white text-xs font-bold px-3">Most Popular</Badge>
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="font-black text-white text-lg">{plan.name}</h3>
                    <div className="flex items-end gap-1 mt-2">
                      {isFree ? (
                        <span className="text-3xl font-black text-white">Free</span>
                      ) : (
                        <>
                          <span className="text-3xl font-black text-white">${plan.priceMonthly}</span>
                          <span className="text-zinc-500 text-sm mb-1">/month</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {[
                      plan.cardsPerDay > 0 && `${plan.cardsPerDay === 999 ? "Unlimited" : plan.cardsPerDay} cards/day`,
                      plan.articlesPerMonth > 0 && `${plan.articlesPerMonth} articles/month`,
                      plan.maxSites > 0 && `${plan.maxSites >= 999 ? "Unlimited" : plan.maxSites} WordPress sites`,
                      plan.hasBlogAutomation && "Blog Automation",
                      plan.hasImageGenerator && "News Card Generator",
                      plan.hasTelegramBot && "Telegram Bot",
                      plan.credits > 0 && `${plan.credits} credits included`,
                    ].filter(Boolean).map((feature) => (
                      <li key={String(feature)} className="flex items-center gap-2 text-sm text-zinc-300">
                        <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {registrationEnabled && (
                    <Link href="/register">
                      <Button className={cn("w-full", isPopular ? "bg-indigo-600 hover:bg-indigo-700" : "bg-white/8 hover:bg-white/12 text-white border border-white/10")}>
                        Get Started
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Channels */}
      {channels.length > 0 && (
        <section className="py-16 px-6 text-center">
          <h2 className="text-xl font-black text-white mb-2">Get in Touch</h2>
          <p className="text-zinc-500 text-sm mb-8">We're here to help</p>
          <div className="flex flex-wrap justify-center gap-4">
            {channels.map((ch) => ch && (
              <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/20 transition-colors text-sm font-medium text-zinc-300">
                <span>{ch.icon}</span> {ch.label} <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-zinc-600 text-xs">© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
