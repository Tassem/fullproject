import { useState } from "react";
import { useListHistory, getListHistoryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Download, Image as ImageIcon } from "lucide-react";

export default function History() {
  const [page, setPage] = useState(0);
  const limit = 20;
  
  const { data, isLoading } = useListHistory(
    { limit, offset: page * limit },
    {
      query: {
        queryKey: getListHistoryQueryKey({ limit, offset: page * limit }),
        enabled: !!localStorage.getItem("pro_token"),
      }
    }
  );

  const images = data?.images || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2"></div>
          <div className="h-4 w-64 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-square bg-muted animate-pulse" />
              <CardContent className="p-4">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Card History</h1>
        <p className="text-muted-foreground mt-1">Browse and download your previously created cards</p>
      </div>

      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-muted/10 border-dashed">
          <ImageIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">No cards yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            You haven't created any cards yet. Go to "Create Card" to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {images.map((img) => (
              <Card key={img.id} className="overflow-hidden flex flex-col group">
                <div className="relative aspect-square bg-muted border-b overflow-hidden group-hover:opacity-90 transition-opacity">
                  <img 
                    src={img.imageUrl} 
                    alt={img.title} 
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm shadow-sm" dir="ltr">
                      {img.aspectRatio}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4 flex-1">
                  <p className="text-sm font-medium line-clamp-2 leading-snug" title={img.title}>
                    {img.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2" dir="ltr">
                    {format(new Date(img.createdAt), "dd MMM yyyy, HH:mm")}
                  </p>
                </CardContent>
                <CardFooter className="p-4 pt-0 gap-2">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => window.open(img.imageUrl, '_blank')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <div className="flex items-center px-4 text-sm font-medium">
                Page {page + 1} of {totalPages}
              </div>
              <Button
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
