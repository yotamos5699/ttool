"use client";

import { notFound } from "next/navigation";
import { PlanClient } from "./PlanClient";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { getPlanForStore } from "@/actions/query-actions";

type Props = {
  params: Promise<{ planId: string }>;
};

export default function PlanPage({ params }: Props) {
  const { planId } = use(params);

  const {
    data: plan,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["plan", planId],
    queryFn: () => getPlanForStore(Number(planId)),
  });
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading plan...</div>
      </div>
    );
  }

  if (error || !plan) {
    notFound();
  }

  return <PlanClient initialPlan={plan} />;
}
