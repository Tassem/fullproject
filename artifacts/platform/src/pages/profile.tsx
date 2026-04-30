import React, { useState } from "react";
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  AlertTriangle, 
  CreditCard,
  Calendar,
  Save,
  Trash2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const { data: user } = useGetMe();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isUpdating, setIsUpdating] = useState(false);

  const updateProfile = async (data: any) => {
    setIsUpdating(true);
    try {
      const token = localStorage.getItem("pro_token");
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "✅ Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch (err) {
      toast({ title: "❌ Update error", description: String(err), variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast({ title: "Please fill all password fields", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    
    setIsUpdating(true);
    try {
      const token = localStorage.getItem("pro_token");
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to change password");
      
      toast({ title: "✅ Password updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "❌ Error", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      // API call for account deletion
      toast({ title: "Deleting account...", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-bold text-lg">{user?.name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded">
                  {user?.plan?.toUpperCase()}
                </span>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2 w-full">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Joined: {new Date(user?.createdAt || Date.now()).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 w-full">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span>Account Type: {user?.isAdmin ? "Admin" : "User"}</span>
              </div>
            </CardFooter>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {(user?.credits as any)?.total || 0} <span className="text-sm font-normal">Credits</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your name and basic information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-2 opacity-60">
                  <Label htmlFor="email">Email Address (Cannot be changed)</Label>
                  <Input id="email" value={user?.email} disabled />
                </div>
                <Button type="submit" className="gap-2" disabled={isUpdating}>
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Ensure you choose a strong password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current">Current Password</Label>
                  <Input 
                    id="current" 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new">New Password</Label>
                    <Input 
                      id="new" 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm New Password</Label>
                    <Input 
                      id="confirm" 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline" className="gap-2">
                  <Lock className="w-4 h-4" /> Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Danger Zone
              </CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Delete Account</p>
                  <p className="text-sm text-muted-foreground">All your data and credits will be permanently deleted.</p>
                </div>
                <Button variant="destructive" className="gap-2" onClick={handleDeleteAccount}>
                  <Trash2 className="w-4 h-4" /> Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
