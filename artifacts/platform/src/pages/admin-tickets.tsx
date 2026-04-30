import React, { useState } from "react";
import { 
  Shield, 
  MessageCircle, 
  Clock, 
  ChevronLeft,
  Send,
  User as UserIcon,
  Search,
  Filter
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const apiFetch = async (endpoint: string, options: any = {}) => {
  const token = localStorage.getItem("pro_token");
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export default function AdminTickets() {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => apiFetch("/support")
  });

  const { data: ticketDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["admin-ticket", selectedTicketId],
    queryFn: () => apiFetch(`/support/${selectedTicketId}`),
    enabled: !!selectedTicketId
  });

  const replyMutation = useMutation({
    mutationFn: (data: { id: number, message: string }) => 
      apiFetch(`/support/${data.id}/messages`, { method: "POST", body: JSON.stringify({ message: data.message }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast({ title: "Reply sent and ticket updated" });
    }
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/support/${id}/close`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", selectedTicketId] });
      toast({ title: "Ticket closed" });
    }
  });

  const [newMessage, setNewMessage] = useState("");

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicketId) return;
    replyMutation.mutate({ id: selectedTicketId, message: newMessage });
    setNewMessage("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">New</Badge>;
      case "in_progress": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Replied</Badge>;
      case "closed": return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTickets = tickets?.filter((t: any) => 
    t.subject.toLowerCase().includes(search.toLowerCase()) || 
    t.userName?.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toString() === search
  );

  if (selectedTicketId && ticketDetail) {
    const { ticket, messages } = ticketDetail;
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => setSelectedTicketId(null)} className="mb-6 gap-2">
          <ChevronLeft className="w-4 h-4" /> Back to Admin Panel
        </Button>

        <div className="grid grid-cols-1 gap-6">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{ticket.subject}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <UserIcon className="w-3 h-3" /> {ticket.userName} ({ticket.userEmail})
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant={ticket.priority === 'urgent' ? 'destructive' : 'outline'}>{ticket.priority}</Badge>
                {getStatusBadge(ticket.status)}
              </div>
            </CardHeader>
          </Card>

          <div className="space-y-4 max-h-[500px] overflow-y-auto px-2">
            {messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.isAdmin 
                    ? 'bg-primary/10 border border-primary/20 rounded-tr-none' 
                    : 'bg-muted border rounded-tl-none'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {msg.isAdmin ? <Shield className="w-4 h-4 text-primary" /> : <UserIcon className="w-4 h-4" />}
                    <span className="font-bold text-xs uppercase">
                      {msg.isAdmin ? 'You (Support)' : ticket.userName}
                    </span>
                    <span className="text-[10px] opacity-50">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleReply} className="space-y-4">
                <Textarea 
                  placeholder="Type your reply to the user..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[120px]"
                />
                <div className="flex justify-between items-center">
                  <Button type="submit" className="gap-2" disabled={replyMutation.isPending}>
                    <Send className="w-4 h-4" /> Send Reply
                  </Button>
                  {ticket.status !== 'closed' && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => closeMutation.mutate(ticket.id)}
                    >
                      Close Ticket
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="text-primary w-8 h-8" /> Support Ticket Management
        </h1>
        <p className="text-muted-foreground mt-1">Monitor and resolve user issues</p>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by subject, username or ticket ID..." 
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" /> Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted/50 text-muted-foreground text-sm">
            <tr>
              <th className="p-4 font-medium">Ticket ID</th>
              <th className="p-4 font-medium">User</th>
              <th className="p-4 font-medium">Subject</th>
              <th className="p-4 font-medium">Priority</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Last Update</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loadingTickets ? (
              <tr><td colSpan={6} className="p-8 text-center">Loading...</td></tr>
            ) : filteredTickets?.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No tickets matching your search</td></tr>
            ) : (
              filteredTickets?.map((t: any) => (
                <tr 
                  key={t.id} 
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedTicketId(t.id)}
                >
                  <td className="p-4 font-mono text-xs">#{t.id}</td>
                  <td className="p-4">
                    <div className="font-medium text-sm">{t.userName}</div>
                    <div className="text-[10px] text-muted-foreground">{t.userEmail}</div>
                  </td>
                  <td className="p-4 font-medium">{t.subject}</td>
                  <td className="p-4">
                    <Badge variant={t.priority === 'urgent' ? 'destructive' : 'outline'} className="text-[10px]">
                      {t.priority}
                    </Badge>
                  </td>
                  <td className="p-4">{getStatusBadge(t.status)}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(t.updatedAt).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
