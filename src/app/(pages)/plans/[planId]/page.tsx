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
    // initialData: usePlanDataStore.getState().plan, // Try to get plan from store first
    queryFn: () => getPlanForStore(Number(planId)),
  });
  if (isLoading || !plan) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading plan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500">
        Error loading plan: {(error as Error).message}
      </div>
    );
  }

  if (!isLoading && !plan) return notFound();

  console.log("PlanPage rendering with plan:", plan);
  if (plan) return <PlanClient initialPlan={plan} />;
}
