import { useGetMe, getGetMeQueryKey, useRegenerateApiKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeySquare, RefreshCw, Terminal } from "lucide-react";

export default function Keys() {
  const { toast } = useToast();
  
  const { data: user, refetch } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!localStorage.getItem("pro_token"),
    }
  });

  const { mutate: regenerateKey, isPending } = useRegenerateApiKey();

  const handleCopy = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      toast({
        title: "Copied",
        description: "API key copied to clipboard",
      });
    }
  };

  const handleRegenerate = () => {
    if (window.confirm("Are you sure you want to regenerate the API key? The old key will stop working immediately.")) {
      regenerateKey(undefined, {
        onSuccess: () => {
          toast({
            title: "Updated",
            description: "New API key generated successfully",
          });
          refetch();
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to generate new key",
            variant: "destructive",
          });
        }
      });
    }
  };

  const codeExample = `curl -X POST https://api.newscardpro.com/v1/generate \\
  -H "Authorization: Bearer \${YOUR_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Breaking: New Policy Announced",
    "subtitle": "Details on today's announcement...",
    "label": "Breaking",
    "aspectRatio": "1:1",
    "bannerColor": "#E11D48"
  }'`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
        <p className="text-muted-foreground mt-1">Manage access keys for integration with your systems</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeySquare className="h-5 w-5" />
                Current Access Key
              </CardTitle>
              <CardDescription>
                Use this key for authentication when calling the API.
                <br />
                <span className="text-destructive font-medium">Warning: Never share this key.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Secret Key (API Key)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={user?.apiKey || "••••••••••••••••••••••••••••"} 
                    readOnly 
                    dir="ltr" 
                    className="font-mono bg-muted/50" 
                    type="password"
                  />
                  <Button variant="secondary" onClick={handleCopy} title="Copy">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <Button 
                variant="destructive" 
                className="w-full mt-4" 
                onClick={handleRegenerate}
                disabled={isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                {isPending ? "Generating..." : "Generate New Key"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Usage Example
              </CardTitle>
              <CardDescription>
                How to create a card via API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto" dir="ltr">
                <pre className="text-sm font-mono leading-relaxed">
                  <code>{codeExample}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
