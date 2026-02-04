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
  console.log("PlanPage rendering with plan:", plan);
  return <PlanClient initialPlan={plan} />;
}
const s = {
  id: 1,
  name: "AI Code Review Pipeline",
  goal: "Automated code review with context-aware analysis, security scanning, and improvement suggestions",
  version: 1,
  parentVersion: null,
  stages: [
    {
      id: 21,
      planId: 1,
      parentStageId: null,
      title: "AI-Powered Analysis",
      description: null,
      executionMode: "sequential",
      dependsOn: [],
      dependsOnStages: [],
      childStages: [],
      jobs: [
        {
          id: 23,
          stageId: 21,
          parentJobId: null,
          title: "Code Quality Assessment",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [
            {
              id: 24,
              level: "context",
              type: "Model Configuration",
              title: "Model Configuration",
              payload: "",
            },
          ],
        },
        {
          id: 25,
          stageId: 21,
          parentJobId: null,
          title: "Bug Detection",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [],
        },
        {
          id: 26,
          stageId: 21,
          parentJobId: null,
          title: "Improvement Suggestions",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [],
        },
      ],
      contextNodes: [
        {
          id: 22,
          level: "context",
          type: "Analysis Prompt Template",
          title: "Analysis Prompt Template",
          payload: "",
        },
      ],
    },
    {
      id: 27,
      planId: 1,
      parentStageId: null,
      title: "Report Generation",
      description: null,
      executionMode: "sequential",
      dependsOn: [],
      dependsOnStages: [],
      childStages: [],
      jobs: [
        {
          id: 28,
          stageId: 27,
          parentJobId: null,
          title: "Aggregate Findings",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [],
        },
        {
          id: 29,
          stageId: 27,
          parentJobId: null,
          title: "Generate Markdown Report",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [],
        },
        {
          id: 30,
          stageId: 27,
          parentJobId: null,
          title: "Create PR Comments",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [],
        },
      ],
      contextNodes: [],
    },
    {
      id: 4,
      planId: 1,
      parentStageId: null,
      title: "Code Ingestion",
      description: null,
      executionMode: "sequential",
      dependsOn: [],
      dependsOnStages: [],
      childStages: [],
      jobs: [
        {
          id: 6,
          stageId: 4,
          parentJobId: null,
          title: "Clone Repository",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [],
        },
        {
          id: 7,
          stageId: 4,
          parentJobId: null,
          title: "Detect Languages",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [],
        },
        {
          id: 8,
          stageId: 4,
          parentJobId: null,
          title: "Parse AST",
          description: null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: [],
          childJobs: [],
          contextNodes: [],
        },
      ],
      contextNodes: [
        {
          id: 5,
          level: "context",
          type: "Supported VCS",
          title: "Supported VCS",
          payload: "",
        },
      ],
    },
    {
      id: 9,
      planId: 1,
      parentStageId: null,
      title: "Static Analysis",
      description: null,
      executionMode: "sequential",
      dependsOn: [],
      dependsOnStages: [],
      childStages: [
        {
          id: 10,
          planId: 1,
          parentStageId: 9,
          title: "Linting",
          description: null,
          executionMode: "sequential",
          dependsOn: [],
          dependsOnStages: [],
          childStages: [],
          jobs: [
            {
              id: 11,
              stageId: 10,
              parentJobId: null,
              title: "ESLint (TypeScript)",
              description: null,
              dependsOn: [],
              dependsOnStages: [],
              dependsOnJobs: [],
              childJobs: [],
              contextNodes: [],
            },
            {
              id: 12,
              stageId: 10,
              parentJobId: null,
              title: "Ruff (Python)",
              description: null,
              dependsOn: [],
              dependsOnStages: [],
              dependsOnJobs: [],
              childJobs: [],
              contextNodes: [],
            },
            {
              id: 13,
              stageId: 10,
              parentJobId: null,
              title: "golangci-lint (Go)",
              description: null,
              dependsOn: [],
              dependsOnStages: [],
              dependsOnJobs: [],
              childJobs: [],
              contextNodes: [],
            },
          ],
          contextNodes: [],
        },
        {
          id: 14,
          planId: 1,
          parentStageId: 9,
          title: "Security Scanning",
          description: null,
          executionMode: "sequential",
          dependsOn: [],
          dependsOnStages: [],
          childStages: [],
          jobs: [
            {
              id: 16,
              stageId: 14,
              parentJobId: null,
              title: "Dependency Audit",
              description: null,
              dependsOn: [],
              dependsOnStages: [],
              dependsOnJobs: [],
              childJobs: [],
              contextNodes: [],
            },
            {
              id: 17,
              stageId: 14,
              parentJobId: null,
              title: "Secret Detection",
              description: null,
              dependsOn: [],
              dependsOnStages: [],
              dependsOnJobs: [],
              childJobs: [],
              contextNodes: [],
            },
            {
              id: 18,
              stageId: 14,
              parentJobId: null,
              title: "SAST Scan",
              description: null,
              dependsOn: [],
              dependsOnStages: [],
              dependsOnJobs: [],
              childJobs: [
                {
                  id: 19,
                  stageId: 14,
                  parentJobId: 18,
                  title: "SQL Injection Check",
                  description: null,
                  dependsOn: [],
                  dependsOnStages: [],
                  dependsOnJobs: [],
                  childJobs: [],
                  contextNodes: [],
                },
                {
                  id: 20,
                  stageId: 14,
                  parentJobId: 18,
                  title: "XSS Detection",
                  description: null,
                  dependsOn: [],
                  dependsOnStages: [],
                  dependsOnJobs: [],
                  childJobs: [],
                  contextNodes: [],
                },
              ],
              contextNodes: [],
            },
          ],
          contextNodes: [
            {
              id: 15,
              level: "context",
              type: "Severity Threshold",
              title: "Severity Threshold",
              payload: "",
            },
          ],
        },
      ],
      jobs: [],
      contextNodes: [],
    },
  ],
  contextNodes: [
    {
      id: 2,
      level: "context",
      type: "Code Quality Standards",
      title: "Code Quality Standards",
      payload: "",
    },
    {
      id: 3,
      level: "context",
      type: "Resource Limits",
      title: "Resource Limits",
      payload: "",
    },
  ],
};
