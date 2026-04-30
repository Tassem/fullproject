import {
  useGetStats, getGetStatsQueryKey,
  useGetStatsOverview, getGetStatsOverviewQueryKey,
  useGetPipelineStats, getGetPipelineStatsQueryKey,
  useGetRecentActivity, getGetRecentActivityQueryKey,
  useGetMe, getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Image as ImageIcon, Layers, Target, Clock, KeySquare,
  Rss, FileText, CheckCircle2, AlertCircle, Zap, Activity,
  TrendingUp, Globe, Bot, Coins, Calendar
} from "lucide-react";
import { Link } from "wouter";
import { getUserCredits } from "@/lib/creditUtils";


function StatCard({
  title, value, sub, icon: Icon, accent = false
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className={`text-sm font-medium ${accent ? "text-primary" : ""}`}>{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-muted animate-pulse rounded mt-2" />
        <div className="h-3 w-28 bg-muted animate-pulse rounded mt-2" />
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const token = localStorage.getItem("pro_token");
  const queryOpts = { query: { enabled: !!token } };

  const { data: user, isLoading: userLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: !!token } });
  const { data: cardStats, isLoading: cardLoading } = useGetStats({ query: { queryKey: getGetStatsQueryKey(), enabled: !!token } });
  const { data: blogOverview, isLoading: blogLoading } = useGetStatsOverview({ query: { queryKey: getGetStatsOverviewQueryKey(), enabled: !!token } });
  const { data: pipelineStats, isLoading: pipelineLoading } = useGetPipelineStats({ query: { queryKey: getGetPipelineStatsQueryKey(), enabled: !!token } });
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey(), enabled: !!token } });

  const isLoading = userLoading || cardLoading || blogLoading || pipelineLoading || activityLoading;
  const { monthly, purchased, total } = getUserCredits(user);

  const cardUsagePercent = cardStats ? Math.min(100, Math.round(((cardStats as any).daily_usage / (cardStats as any).daily_limit) * 100)) : 0;

  const isNearLimit = cardUsagePercent > 80;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {userLoading ? "Loading..." : `Welcome, ${user?.name ?? "User"}`}
          </h1>
          <p className="text-muted-foreground mt-1">Unified overview — News Cards & Blog Automation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/sites">
              <Globe className="mr-2 h-4 w-4" />
              Blog Sites
            </Link>
          </Button>
          <Button asChild>
            <Link href="/template-builder">
              <ImageIcon className="mr-2 h-4 w-4" />
              Create Card
            </Link>
          </Button>
        </div>
      </div>

      {/* ── News Card Stats ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">News Card Generator</h2>
          <Badge variant="secondary">Card Stats</Badge>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {isLoading ? (
            [1,2,3,4].map(i => <SkeletonCard key={i} />)
          ) : (<>
            <Card className={isNearLimit ? "border-destructive/30 bg-destructive/5" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Today's Operations</CardTitle>
                <Zap className={`h-4 w-4 ${isNearLimit ? "text-destructive" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${isNearLimit ? "text-destructive" : ""}`}>{(cardStats as any)?.daily_usage ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">of {(cardStats as any)?.daily_limit ?? 0} daily capacity</p>
                <Progress
                  value={cardUsagePercent}
                  className={`mt-3 h-2 ${isNearLimit ? "bg-destructive/20 [&>div]:bg-destructive" : ""}`}
                />
              </CardContent>
            </Card>

            <StatCard title="Total Cards" value={cardStats?.totalImages ?? 0} sub="Since account creation" icon={ImageIcon} />
            <StatCard title="My Templates" value={cardStats?.totalTemplates ?? 0} sub="Custom templates" icon={Layers} />
            <StatCard
              title="Plan"
              value={cardStats?.plan === "pro" ? "Pro" : "Free"}
              sub={cardStats?.plan === "pro" ? "Full access" : "Daily operation limit"}
              icon={Target}
            />

            {((user as any)?.planDetails?.has_telegram_bot || user?.isAdmin) && (
              <StatCard
                title="Bot Secret Code"
                value={user?.botCode ?? "Not set"}
                sub={`Send to bot: account: ${user?.botCode}`}
                icon={KeySquare}
                accent
              />
            )}
          </>)}
        </div>
      </div>

      {/* ── Credits Overview ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Credits Overview</h2>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Balance</Badge>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {isLoading ? (
            [1,2,3].map(i => <SkeletonCard key={i} />)
          ) : (<>
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Monthly Plan Credits</CardTitle>
                <Calendar className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {monthly} / {(user as any)?.planDetails?.monthly_credits ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">remaining this month</p>
                {user?.credits_reset_date && (
                  <p className="text-[10px] text-muted-foreground mt-2 border-t pt-2 border-orange-500/10">
                    Resets on: {new Date(user.credits_reset_date).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Purchased Credits</CardTitle>
                <Coins className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{purchased}</div>
                <p className="text-xs text-muted-foreground mt-1">available for all services</p>
                <p className="text-[10px] text-emerald-500 font-medium mt-2 border-t pt-2 border-border/50">
                  Do not expire
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Available</CardTitle>
                <Zap className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-primary">{total}</div>
                <div className="mt-3 p-2 rounded-md bg-primary/10 text-[10px] text-primary/80 leading-snug">
                  <span className="font-bold uppercase tracking-tighter block mb-1">Consumption Order:</span>
                  1. Monthly credits first <br />
                  2. Purchased credits second
                </div>
              </CardContent>
            </Card>

          </>)}
        </div>
      </div>

      {/* ── Blog Automation Stats ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Blog Automation</h2>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            Pipeline Stats
          </Badge>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            [1,2,3,4].map(i => <SkeletonCard key={i} />)
          ) : (<>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(blogOverview as any)?.total_articles ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(blogOverview as any)?.done ?? 0} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(blogOverview as any)?.published_today ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">published today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pipeline Success</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {pipelineStats?.successRate != null ? `${Math.round(pipelineStats.successRate)}%` : "—"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">overall success rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">RSS Feeds</CardTitle>
                <Rss className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{blogOverview?.totalSites ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">connected sites</p>
              </CardContent>
            </Card>
          </>)}
        </div>
      </div>

      {/* ── Bottom Section: Quick Links + Recent Activity ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump to your most-used features</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">News Cards</div>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/template-builder"><ImageIcon className="mr-2 h-4 w-4" />Create News Card</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/templates"><Layers className="mr-2 h-4 w-4" />Manage Templates</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/history"><Clock className="mr-2 h-4 w-4" />Card History</Link>
            </Button>

            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1">Blog Automation</div>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/sites"><Globe className="mr-2 h-4 w-4" />WordPress Sites</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/articles"><FileText className="mr-2 h-4 w-4" />Articles</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/pipeline"><Zap className="mr-2 h-4 w-4" />Run Pipeline</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest pipeline events</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-4 w-4 bg-muted animate-pulse rounded-full mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.slice(0, 6).map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {item.status === "success" || item.status === "published" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    ) : item.status === "failed" ? (
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    ) : (
                      <Activity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title ?? item.stage ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground">Run the pipeline to see events here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
