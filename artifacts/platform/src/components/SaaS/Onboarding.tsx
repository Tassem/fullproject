import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Check, Rocket, Globe, Brain, 
  LayoutDashboard, ArrowRight, ArrowLeft,
  Sparkles, ShieldCheck, Zap, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: "Welcome to Mission Control",
    description: "Your all-in-one AI blogging automation engine is ready. Let's set up your workspace.",
    icon: Rocket,
    color: "bg-indigo-500",
    content: (
       <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
             <div className="flex gap-3">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300">Multi-tenant isolation active</p>
             </div>
             <div className="flex gap-3">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300">Hybrid AI Pipeline initialized</p>
             </div>
             <div className="flex gap-3">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300">WordPress REST API ready</p>
             </div>
          </div>
       </div>
    )
  },
  {
    title: "Connect Your Sites",
    description: "Add your WordPress websites. We use the official REST API for high-performance publishing.",
    icon: Globe,
    color: "bg-blue-500",
    content: (
       <div className="space-y-4 text-center">
          <div className="w-full aspect-video rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent" />
             <div className="relative z-10 flex flex-col items-center gap-2">
                <Globe className="w-12 h-12 text-blue-400 animate-pulse" />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Site Management Layer</span>
             </div>
          </div>
          <p className="text-xs text-slate-400">Navigate to <span className="text-white font-bold">Sites</span> to add your first domain.</p>
       </div>
    )
  },
  {
    title: "Configure AI Agents",
    description: "Each site can have its own custom AI personality. Control prompts, models, and creativity.",
    icon: Brain,
    color: "bg-purple-500",
    content: (
       <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
             <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                <Brain className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <span className="text-[10px] text-purple-300 font-bold">Writer Agent</span>
             </div>
             <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                <Zap className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                <span className="text-[10px] text-indigo-300 font-bold">SEO Specialist</span>
             </div>
          </div>
          <p className="text-xs text-slate-400 text-center">Tailor the response style for every niche automatically.</p>
       </div>
    )
  },
  {
    title: "Monitor Performance",
    description: "Track your article pipeline in real-time. Watch as RSS feeds transform into premium blog posts.",
    icon: LayoutDashboard,
    color: "bg-orange-500",
    content: (
       <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20">
             <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-orange-500 uppercase">Automation Stream</span>
                <span className="text-[10px] text-slate-500 font-mono">LIVE</span>
             </div>
             <div className="space-y-2">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-orange-500 w-[65%] animate-pulse" />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                   <span>RESEARCHING</span>
                   <span>65%</span>
                </div>
             </div>
          </div>
       </div>
    )
  }
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const { toast } = useToast();

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      onComplete();
    },
    onError: (err) => {
      console.error("Onboarding completion failed:", err);
      toast({
        title: "Connection Issue",
        description: "Could not save onboarding status. You've been skipped to dashboard.",
        variant: "destructive"
      });
      // Fallback: complete anyway on the client side so they aren't stuck
      onComplete();
    }
  });

  const nextStep = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeMutation.mutate();
    }
  };

  const handleSkip = () => {
    toast({
      title: "Onboarding Skipped",
      description: "You can find settings in the sidebar.",
    });
    completeMutation.mutate();
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Background Overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={handleSkip}
      />

      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto"
      >
        {/* Skip button overlay */}
        <button 
          onClick={handleSkip}
          className="absolute top-6 right-6 z-20 p-2 rounded-full bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all active:scale-90"
          title="Skip Onboarding"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
           <motion.div 
             className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
             initial={{ width: "0%" }}
             animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
           />
        </div>

        <div className="p-8 md:p-12">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <motion.div 
              key={step}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-16 h-16 rounded-3xl ${current.color} flex items-center justify-center text-white shadow-xl mb-6`}
            >
              <current.icon className="w-8 h-8" />
            </motion.div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">{current.title}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{current.description}</p>
          </div>

          {/* Content Area */}
          <div className="min-h-[160px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {current.content}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          <div className="mt-12 flex items-center justify-between gap-4">
            <Button 
              variant="ghost" 
              className="text-slate-500 hover:text-white"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            <Button 
              className="bg-white text-black hover:bg-slate-100 font-bold px-8 h-12 rounded-2xl group shadow-lg shadow-white/5 active:scale-95 transition-all"
              onClick={nextStep}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : step === STEPS.length - 1 ? (
                <>Get Started <Sparkles className="w-4 h-4 ml-2 text-indigo-500" /></>
              ) : (
                <>Next Step <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
