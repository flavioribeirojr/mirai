import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Wallet, TrendingUp } from "lucide-react";
import { SignIn } from "@clerk/clerk-react";

export default function Auth() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SignIn />
    </div>
  );
}
