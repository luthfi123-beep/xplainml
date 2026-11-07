"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export function EmptyState({ title, description, actionLabel, actionHref }: Props) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-orange-400/10 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-orange-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      <Button onClick={() => router.push(actionHref)}>{actionLabel}</Button>
    </div>
  );
}