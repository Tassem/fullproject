import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CreditCard, Zap, CheckCircle2, Loader2, Upload, X,
  Link, Hash, Send, MessageCircle, Mail, Phone, ArrowRight, ExternalLink,
} from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: number;
  planName: string;
  price: number;
  type?: "plan_upgrade" | "points_purchase";
  pointsAmount?: number;
}

interface SiteInfo {
  settings: Record<string, string>;
}

export function UpgradeModal({
  open,
  onOpenChange,
  planId,
  planName,
  price,
  type = "plan_upgrade",
  pointsAmount,
}: UpgradeModalProps) {
  const [step, setStep] = useState<"select" | "proof" | "success">("select");
  const [method, setMethod] = useState<"paypal" | "bank_transfer">("paypal");
  const [proofType, setProofType] = useState<"text" | "link" | "image">("link");
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: siteInfo } = useQuery<SiteInfo>({
    queryKey: ["public", "site-info"],
    queryFn: async () => {
      const r = await fetch("/api/public/site-info");
      if (!r.ok) return { settings: {} };
      return r.json();
    },
    staleTime: 0, // Always fetch fresh data when modal opens
    gcTime: 0,
  });

  const settings = siteInfo?.settings ?? {};
  const isPoints = type === "points_purchase";

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getProofDetails = () => {
    if (proofType === "text") return proofText || notes || "No details provided";
    if (proofType === "link") return proofLink || "No link provided";
    if (proofType === "image") return imagePreview || "Image attached";
    return notes || "Manual payment submitted";
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const proof = getProofDetails();

      const body: any = {
        type,
        payment_method: method,
        proof_details: proof,
      };

      if (isPoints && pointsAmount) {
        body.points_amount = pointsAmount;
      } else {
        body.plan_id = planId;
      }

      const r = await fetch("/api/payments/request", {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("pro_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) throw new Error("Submission failed");
      setStep("success");
    } catch (err) {
      alert("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("select");
    setProofText("");
    setProofLink("");
    setNotes("");
    setSelectedImage(null);
    setImagePreview(null);
    onOpenChange(false);
  };

  const displayPrice = price > 0 ? `${price} MAD` : "Free";

  const channels = [
    settings.channel_discord_enabled === "true" && settings.channel_discord_url && {
      label: "Discord", icon: "💬", href: settings.channel_discord_url, color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
    },
    settings.channel_whatsapp_enabled === "true" && settings.channel_whatsapp_number && {
      label: "WhatsApp", icon: "📱", href: `https://wa.me/${settings.channel_whatsapp_number.replace(/\D/g, "")}`, color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
    },
    settings.channel_telegram_enabled === "true" && settings.channel_telegram_url && {
      label: "Telegram", icon: "✈️", href: settings.channel_telegram_url, color: "bg-blue-500/10 border-blue-500/20 text-blue-400"
    },
    settings.channel_email_enabled === "true" && settings.channel_email && {
      label: "Email", icon: "📧", href: `mailto:${settings.channel_email}`, color: "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
    },
  ].filter(Boolean) as any[];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-950 border-white/10 rounded-[2rem] max-w-lg w-full p-0 overflow-hidden">
        {/* Header */}
        <div className={cn(
          "p-8 border-b border-white/5",
          isPoints ? "bg-amber-500/5" : "bg-indigo-500/5"
        )}>
          <DialogHeader>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", isPoints ? "bg-amber-500/20" : "bg-indigo-500/20")}>
              {isPoints ? <Zap className="w-6 h-6 text-amber-400" /> : <CreditCard className="w-6 h-6 text-indigo-400" />}
            </div>
            <DialogTitle className="text-xl font-black text-white tracking-tight">
              {step === "success" ? "Request Submitted!" : isPoints ? `Purchase ${pointsAmount} PT` : `Upgrade to ${planName}`}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {step === "success"
                ? "Your payment proof has been sent for review. We'll activate your plan shortly."
                : `${displayPrice}${isPoints ? ` — ${pointsAmount} points at ${price} MAD each` : "/month"}`
              }
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-8">
          {step === "success" ? (
            <div className="text-center space-y-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
              <div>
                <p className="text-sm text-zinc-400">Your request is in the verification queue.</p>
                <p className="text-xs text-zinc-600 mt-2">Usually processed within 1–24 hours.</p>
              </div>
              {channels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Need help? Contact us:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {channels.map((ch: any) => (
                      <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer"
                        className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:opacity-80", ch.color)}>
                        {ch.icon} {ch.label} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={handleClose} className="w-full h-12 rounded-xl">Done</Button>
            </div>
          ) : step === "select" ? (
            <div className="space-y-6">
              {/* Payment Method */}
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "paypal", label: "PayPal", emoji: "🔵" },
                    { id: "bank_transfer", label: "Bank Transfer", emoji: "🏦" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id as any)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        method === m.id
                          ? "border-indigo-500/60 bg-indigo-500/10"
                          : "border-white/5 bg-white/[0.02] hover:border-white/10"
                      )}
                    >
                      <span className="text-xl">{m.emoji}</span>
                      <p className="text-xs font-black text-white mt-2">{m.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Details */}
              <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Payment Details</p>
                {method === "paypal" ? (
                  <div className="space-y-2">
                    {settings.payment_paypal_email && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">Email</span>
                        <span className="text-xs font-mono text-white">{settings.payment_paypal_email}</span>
                      </div>
                    )}
                    {settings.payment_paypal_link && (
                      <a href={settings.payment_paypal_link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-indigo-400 hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" /> Pay via PayPal.me
                      </a>
                    )}
                    {!settings.payment_paypal_email && !settings.payment_paypal_link && (
                      <p className="text-xs text-zinc-600">Contact support for PayPal details.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[
                      { label: "Bank", value: settings.payment_bank_name },
                      { label: "Holder", value: settings.payment_bank_holder },
                      { label: "IBAN", value: settings.payment_bank_iban },
                      { label: "SWIFT", value: settings.payment_bank_swift },
                    ].filter((f) => f.value).map((f) => (
                      <div key={f.label} className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">{f.label}</span>
                        <span className="text-xs font-mono text-white">{f.value}</span>
                      </div>
                    ))}
                    {!settings.payment_bank_name && (
                      <p className="text-xs text-zinc-600">Contact support for bank details.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Contact channels */}
              {channels.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Questions? Reach us:</p>
                  <div className="flex flex-wrap gap-2">
                    {channels.map((ch: any) => (
                      <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer"
                        className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border", ch.color)}>
                        {ch.icon} {ch.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setStep("proof")}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-black"
              >
                I've Made the Payment <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Proof type selector */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Proof Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "link", label: "Screenshot Link", icon: Link },
                    { id: "text", label: "Transaction ID", icon: Hash },
                    { id: "image", label: "Upload Image", icon: Upload },
                  ].map((pt) => (
                    <button
                      key={pt.id}
                      onClick={() => setProofType(pt.id as any)}
                      className={cn(
                        "p-3 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all flex flex-col items-center gap-1.5",
                        proofType === pt.id ? "border-orange-500/50 bg-orange-500/10 text-orange-400" : "border-white/5 bg-white/[0.02] text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <pt.icon className="w-4 h-4" />
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Proof input */}
              {proofType === "link" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-zinc-500">Screenshot URL</Label>
                  <Input
                    value={proofLink}
                    onChange={(e) => setProofLink(e.target.value)}
                    placeholder="https://drive.google.com/... or imgur.com/..."
                    className="bg-black border-white/10 h-12 rounded-xl"
                  />
                </div>
              )}

              {proofType === "text" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-zinc-500">Transaction ID / Reference</Label>
                  <Textarea
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    placeholder="e.g. PAYID-ABC123XYZ or any reference number"
                    className="bg-black border-white/10 rounded-xl resize-none"
                    rows={3}
                  />
                </div>
              )}

              {proofType === "image" && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-zinc-500">Payment Screenshot</Label>
                  {!imagePreview ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-orange-500/40 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-orange-400 transition-all"
                    >
                      <Upload className="w-6 h-6" />
                      <p className="text-xs font-bold">Click to Upload (max 5MB)</p>
                      <p className="text-[10px]">PNG, JPG, WEBP</p>
                    </button>
                  ) : (
                    <div className="relative">
                      <img src={imagePreview} alt="proof" className="w-full h-48 object-cover rounded-xl border border-white/10" />
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/80 flex items-center justify-center text-rose-400 hover:bg-black"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={submitting || (proofType === "link" && !proofLink) || (proofType === "text" && !proofText) || (proofType === "image" && !imagePreview)}
                className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-500 font-black"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {submitting ? "Submitting..." : "Submit Payment Proof"}
              </Button>
              <button onClick={() => setStep("select")} className="w-full text-center text-[10px] text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-widest">
                ← Back
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
