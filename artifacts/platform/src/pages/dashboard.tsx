import { useGetStats, getGetStatsQueryKey, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Image as ImageIcon, Layers, Target, Clock, KeySquare } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStats({
    query: {
      queryKey: getGetStatsQueryKey(),
      enabled: !!localStorage.getItem("pro_token"),
    }
  });

  const { data: user, isLoading: userLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!localStorage.getItem("pro_token"),
    }
  });

  if (statsLoading || userLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2"></div>
          <div className="h-4 w-64 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                <div className="h-4 w-4 bg-muted animate-pulse rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mt-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const usagePercent = stats ? Math.min(100, Math.round((stats.imagesToday / stats.dailyLimit) * 100)) : 0;
  const isNearLimit = usagePercent > 80;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">Here's an overview of your usage today</p>
        </div>
        <Button asChild>
          <Link href="/generate">
            <ImageIcon className="mr-2 h-4 w-4" />
            Create New Card
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Cards</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.imagesToday || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">of {stats?.dailyLimit || 0} daily limit</p>
            <Progress value={usagePercent} className={`mt-3 h-2 ${isNearLimit ? "bg-destructive/20 [&>div]:bg-destructive" : ""}`} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalImages || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Since account creation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Templates</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTemplates || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">custom templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plan Type</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{stats?.plan === 'pro' ? 'Pro' : 'Free'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.plan === 'pro' ? 'Full access' : 'Daily usage limit'}
            </p>
          </CardContent>
        </Card>

        {(user?.planDetails?.telegramBot || user?.isAdmin) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-primary">Bot Secret Code</CardTitle>
              <KeySquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold tracking-wider text-primary">
                {user?.botCode || "Not set"}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Send to bot: `account: {user?.botCode}`</p>
            </CardContent>
          </Card>
        )}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Quick links to core features</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/generate">
                <ImageIcon className="mr-2 h-4 w-4" />
                Create News Card
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/templates">
                <Layers className="mr-2 h-4 w-4" />
                Manage Templates
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/history">
                <Clock className="mr-2 h-4 w-4" />
                View Card History
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
