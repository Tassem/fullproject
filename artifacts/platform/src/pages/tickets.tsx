import React, { useState } from "react";
import { 
  LifeBuoy, 
  Plus, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  Send,
  User as UserIcon,
  Shield
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Helper to fetch from our new API
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

export default function Tickets() {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiFetch("/support")
  });

  const { data: ticketDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["ticket", selectedTicketId],
    queryFn: () => apiFetch(`/support/${selectedTicketId}`),
    enabled: !!selectedTicketId
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/support", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setShowCreate(false);
      toast({ title: "Ticket created successfully" });
    }
  });

  const replyMutation = useMutation({
    mutationFn: (data: { id: number, message: string }) => 
      apiFetch(`/support/${data.id}/messages`, { method: "POST", body: JSON.stringify({ message: data.message }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", selectedTicketId] });
      toast({ title: "Reply sent" });
    }
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/support/${id}/close`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", selectedTicketId] });
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
      case "open": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Open</Badge>;
      case "in_progress": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">In Progress</Badge>;
      case "closed": return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return <Badge variant="destructive">Urgent</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      default: return null;
    }
  };

  if (selectedTicketId && ticketDetail) {
    const { ticket, messages } = ticketDetail;
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => setSelectedTicketId(null)} className="mb-6 gap-2">
          <ChevronLeft className="w-4 h-4" /> Back to Tickets
        </Button>

        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-2xl">{ticket.subject}</CardTitle>
                <CardDescription className="mt-1">
                  Ticket #{ticket.id} • {new Date(ticket.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {getPriorityBadge(ticket.priority)}
                {getStatusBadge(ticket.status)}
              </div>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            {messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.isAdmin 
                    ? 'bg-primary/10 border border-primary/20 rounded-tl-none' 
                    : 'bg-muted border rounded-tr-none'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {msg.isAdmin ? <Shield className="w-4 h-4 text-primary" /> : <UserIcon className="w-4 h-4" />}
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {msg.isAdmin ? 'Support Team' : 'You'}
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

          {ticket.status !== 'closed' && (
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleReply} className="space-y-4">
                  <Textarea 
                    placeholder="Type your reply here..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[120px]"
                  />
                  <div className="flex justify-between items-center">
                    <Button type="submit" className="gap-2" disabled={replyMutation.isPending}>
                      <Send className="w-4 h-4" /> Send Reply
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => closeMutation.mutate(ticket.id)}
                    >
                      Close Ticket
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LifeBuoy className="text-primary w-8 h-8" /> Support Tickets
          </h1>
          <p className="text-muted-foreground mt-1">We are here to help you with any issues</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-8 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle>Create New Support Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createMutation.mutate(Object.fromEntries(formData));
            }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input name="subject" placeholder="e.g., WordPress connection issue" required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select name="category" defaultValue="general">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="billing">Billing & Subscriptions</SelectItem>
                      <SelectItem value="technical">Technical Issue</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Your Message</Label>
                <Textarea name="message" placeholder="Explain the issue in detail..." className="min-h-[150px]" required />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={createMutation.isPending}>Create Ticket</Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loadingTickets ? (
          <p>Loading...</p>
        ) : tickets?.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 opacity-20" />
            </div>
            <h3 className="text-xl font-bold">No tickets yet</h3>
            <p className="text-muted-foreground">If you face any issues, don't hesitate to open a new ticket.</p>
          </Card>
        ) : (
          tickets?.map((t: any) => (
            <Card key={t.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedTicketId(t.id)}>
              <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${t.status === 'closed' ? 'bg-muted' : 'bg-primary/10 text-primary'}`}>
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t.subject}</CardTitle>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(t.updatedAt).toLocaleDateString()}</span>
                      <span>#{t.id}</span>
                      <span>{t.category}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getPriorityBadge(t.priority)}
                  {getStatusBadge(t.status)}
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
