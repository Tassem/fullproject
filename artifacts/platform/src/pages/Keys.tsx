import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeySquare, RefreshCw, Eye, EyeOff, Zap, CheckCircle2 } from "lucide-react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function Keys() {
  const { toast } = useToast();
  const [apiKey, setApiKey]       = useState<string>("");
  const [loading, setLoading]     = useState(true);
  const [regenerating, setRegen]  = useState(false);
  const [show, setShow]           = useState(false);
  const [copied, setCopied]       = useState<string | null>(null);

  const token = () => localStorage.getItem("pro_token") || "";

  useEffect(() => {
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(d => { if (d.apiKey) setApiKey(d.apiKey); })
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      toast({ title: "تم النسخ ✓", description: label });
    });
  };

  const handleRegenerate = async () => {
    if (!window.confirm("هل أنت متأكد؟ المفتاح القديم سيتوقف فوراً.")) return;
    setRegen(true);
    try {
      const r = await fetch(`${API}/api/keys/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.apiKey) {
        setApiKey(d.apiKey);
        setShow(true);
        toast({ title: "✅ تم إنشاء مفتاح جديد" });
      }
    } catch {
      toast({ title: "خطأ", variant: "destructive" });
    } finally {
      setRegen(false);
    }
  };

  const baseUrl = window.location.origin;
  const keyDisplay = show ? apiKey : apiKey ? apiKey.slice(0, 8) + "••••••••••••••••••••" : "لم يُنشأ بعد";

  const n8nSteps = [
    { n: "1", title: "HTTP Request Node", desc: "أضف عقدة HTTP Request في n8n" },
    { n: "2", title: "Method: POST",      desc: `URL: ${baseUrl}/api/v1/generate-card` },
    { n: "3", title: "Authentication",    desc: "Header: X-API-Key = مفتاحك أدناه" },
    { n: "4", title: "Body (JSON)",       desc: '{ "title": "{{ $json.title }}", "photoUrl": "{{ $json.photo }}" }' },
    { n: "5", title: "Response",          desc: "imageFullUrl يحوي رابط الصورة الجاهزة" },
  ];

  const curlExample = `curl -X POST ${baseUrl}/api/v1/generate-card \\
  -H "X-API-Key: ${apiKey || "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "عنوان الخبر هنا",
    "label": "عاجل",
    "photoUrl": "https://example.com/photo.jpg",
    "aspectRatio": "1:1"
  }'`;

  const n8nBodyExample = `{
  "title": "{{ $json.title }}",
  "label": "{{ $json.label }}",
  "photoUrl": "{{ $json.imageUrl }}",
  "templateId": 1,
  "aspectRatio": "1:1"
}`;

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">مفاتيح API</h1>
        <p className="text-muted-foreground mt-1">
          استخدم مفتاح API للتكامل مع n8n و Zapier وغيرها
        </p>
      </div>

      {/* API Key Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeySquare className="h-5 w-5 text-primary" />
            مفتاح الوصول السري
          </CardTitle>
          <CardDescription>
            استخدمه في header الطلبات:&nbsp;
            <code className="bg-muted px-1 rounded text-xs">X-API-Key: {apiKey || "..."}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={loading ? "جارٍ التحميل..." : keyDisplay}
              readOnly
              dir="ltr"
              className="font-mono bg-muted/50 flex-1"
            />
            <Button variant="ghost" size="icon" onClick={() => setShow(s => !s)} title={show ? "إخفاء" : "إظهار"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => handleCopy(apiKey, "مفتاح API")}
              disabled={!apiKey}
              title="نسخ"
            >
              {copied === "مفتاح API" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleRegenerate}
            disabled={regenerating || loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "جارٍ الإنشاء..." : "إنشاء مفتاح جديد"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            ⚠️ لا تشارك هذا المفتاح مع أي أحد — كل من يملكه يستطيع استخدام رصيدك
          </p>
        </CardContent>
      </Card>

      {/* n8n Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            الربط مع n8n — دليل خطوة بخطوة
          </CardTitle>
          <CardDescription>أتمتة توليد البطاقات الإخبارية مباشرة من سير عملك</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Steps */}
          <div className="space-y-3">
            {n8nSteps.map(s => (
              <div key={s.n} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {s.n}
                </div>
                <div>
                  <p className="font-semibold text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Endpoint Info */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endpoint</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono flex-1 break-all" dir="ltr">
                POST {baseUrl}/api/v1/generate-card
              </code>
              <Button variant="ghost" size="sm" onClick={() => handleCopy(`${baseUrl}/api/v1/generate-card`, "URL")}>
                {copied === "URL" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* n8n Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Body في n8n (JSON)</p>
              <Button variant="ghost" size="sm" onClick={() => handleCopy(n8nBodyExample, "Body n8n")}>
                {copied === "Body n8n" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto" dir="ltr">
              <pre className="text-xs font-mono leading-relaxed">{n8nBodyExample}</pre>
            </div>
          </div>

          {/* cURL example */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">مثال cURL كامل</p>
              <Button variant="ghost" size="sm" onClick={() => handleCopy(curlExample, "cURL")}>
                {copied === "cURL" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto" dir="ltr">
              <pre className="text-xs font-mono leading-relaxed">{curlExample}</pre>
            </div>
          </div>

          {/* Response */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Response</p>
            <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto" dir="ltr">
              <pre className="text-xs font-mono leading-relaxed">{`{
  "success": true,
  "imageUrl": "/api/photo/file/card-xxx.png",
  "imageFullUrl": "${baseUrl}/api/photo/file/card-xxx.png",
  "creditsUsed": 1,
  "creditsRemaining": 98
}`}</pre>
            </div>
          </div>

          {/* List templates */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">قائمة القوالب</p>
            <code className="text-xs font-mono block" dir="ltr">
              GET {baseUrl}/api/v1/templates
            </code>
            <p className="text-xs text-muted-foreground">يُرجع IDs القوالب لاستخدامها في templateId</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
