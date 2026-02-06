import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../dbs/drizzle";
import {
  tenants,
  nodes,
  planNodes,
  stageNodes,
  jobNodes,
  contextNodes,
  dataNodes,
  planEdges,
} from "../dbs/drizzle/schema";
import { buildPath, getPathDepth } from "../lib/ltree";

/**
 * Seed Example Plan using the new hierarchical node schema
 * Creates a comprehensive AI Code Review Pipeline plan with:
 * - Multiple parts
 * - Jobs within parts
 * - Context nodes at plan, stage, and job levels
 * - Data nodes for inputs and outputs
 */

async function seedExamplePlan() {
  console.log("Seeding example plan with node-based schema...");

  // Create a default tenant first
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Default Tenant",
      slug: "default",
    })
    .onConflictDoNothing()
    .returning();

  const tenantId = tenant?.id ?? 1;
  console.log(`Using tenant ID: ${tenantId}`);

  // ==========================================
  // PLAN NODE
  // ==========================================
  const [planNode] = await db
    .insert(nodes)
    .values({
      type: "plan",
      name: "AI Code Review Pipeline",
      path: "temp",
      depth: 0,
      parentId: null,
      planId: null,
      tenantId,
    })
    .returning();

  // Update path and planId
  const planPath = buildPath(null, "plan", planNode.id);
  await db
    .update(nodes)
    .set({ path: planPath, planId: planNode.id })
    .where(eq(nodes.id, planNode.id));

  // Insert plan-specific data
  await db.insert(planNodes).values({
    nodeId: planNode.id,
    goal: "Automated code review with context-aware analysis, security scanning, and improvement suggestions",
    version: 1,
  });

  console.log(`Created plan: ${planNode.name} (ID: ${planNode.id})`);

  // ==========================================
  // PLAN-LEVEL CONTEXT NODES
  // ==========================================
  const [ctx1] = await createContextNode({
    tenantId,
    planId: planNode.id,
    parentId: planNode.id,
    parentPath: planPath,
    name: "Code Quality Standards",
    contextType: "requirement",
    payload: JSON.stringify({
      minCoverage: 80,
      maxComplexity: 10,
      languages: ["typescript", "python", "go"],
      lintRules: "strict",
    }),
  });

  const [ctx2] = await createContextNode({
    tenantId,
    planId: planNode.id,
    parentId: planNode.id,
    parentPath: planPath,
    name: "Resource Limits",
    contextType: "constraint",
    payload: JSON.stringify({
      maxExecutionTime: "5m",
      maxMemory: "2GB",
      parallelWorkers: 4,
    }),
  });

  console.log(`Created 2 plan-level context nodes`);

  // ==========================================
  // PARTS (STAGES) + JOBS
  // ==========================================
  const [stage1, stage1Path] = await createStageNode({
    tenantId,
    planId: planNode.id,
    parentId: planNode.id,
    parentPath: planPath,
    name: "Code Ingestion",
    description: "Fetch and prepare code for analysis",
    executionMode: "sequential",
  });

  // Stage 1 context
  await createContextNode({
    tenantId,
    planId: planNode.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Supported VCS",
    contextType: "note",
    payload: "GitHub, GitLab, Bitbucket, local git repos",
  });

  // Stage 1 jobs
  const [job1_1, job1_1Path] = await createJobNode({
    tenantId,
    planId: planNode.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Clone Repository",
    description: "Clone or fetch the target repository",
    disableDependencyInheritance: true,
  });

  const [job1_2, job1_2Path] = await createJobNode({
    tenantId,
    planId: planNode.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Detect Languages",
    description: "Analyze file extensions and detect programming languages",
    includeDependencyIds: [job1_1.id],
  });

  const [job1_3] = await createJobNode({
    tenantId,
    planId: planNode.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Parse AST",
    description: "Generate Abstract Syntax Trees for each file",
    includeDependencyIds: [job1_2.id],
    excludeDependencyIds: [job1_1.id],
  });

  console.log(`Created stage: ${stage1.name} with 3 jobs`);

  const [stage2, stage2Path] = await createStageNode({
    tenantId,
    planId: planNode.id,
    parentId: planNode.id,
    parentPath: planPath,
    name: "AI-Powered Analysis",
    description: "Use LLMs for deep code understanding",
    executionMode: "sequential",
    includeDependencyIds: [stage1.id],
  });

  await createContextNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2.id,
    parentPath: stage2Path,
    name: "Analysis Prompt Template",
    contextType: "code",
    payload: `You are a senior code reviewer. Analyze the following code for:
1. Code quality and maintainability
2. Potential bugs and edge cases
3. Performance optimizations
4. Best practices adherence

Provide specific, actionable feedback with code examples where appropriate.`,
  });

  const [job2_1, job2_1Path] = await createJobNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2.id,
    parentPath: stage2Path,
    name: "Code Quality Assessment",
    description: "Analyze code quality using AI",
    includeDependencyIds: [job1_3.id],
  });

  await createContextNode({
    tenantId,
    planId: planNode.id,
    parentId: job2_1.id,
    parentPath: job2_1Path,
    name: "Model Configuration",
    contextType: "constraint",
    payload: JSON.stringify({
      model: "claude-3-5-sonnet",
      temperature: 0.3,
      maxTokens: 4096,
    }),
  });

  const [job2_2] = await createJobNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2.id,
    parentPath: stage2Path,
    name: "Bug Detection",
    description: "Identify potential bugs and issues",
    includeDependencyIds: [job2_1.id],
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2.id,
    parentPath: stage2Path,
    name: "Improvement Suggestions",
    description: "Generate refactoring and optimization suggestions",
    includeDependencyIds: [job2_2.id],
    disableDependencyInheritance: true,
  });

  // ==========================================
  // DATA NODES
  // ==========================================

  // Input data node for stage 1
  await createDataNode({
    tenantId,
    planId: planNode.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Repository URL Input",
    payload: {
      repoUrl: "https://github.com/example/repo",
      branch: "main",
      commitSha: "abc123",
    },
  });

  // Output data node for stage 1
  await createDataNode({
    tenantId,
    planId: planNode.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "AST Artifacts Output",
    payload: {
      astFiles: ["src/**/*.ast.json"],
      metadata: "repo-metadata.json",
    },
  });

  // Input data node for AI analysis stage
  await createDataNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2.id,
    parentPath: stage2Path,
    name: "Code Chunks Input",
    payload: {
      codeChunks: "chunks/*.json",
      staticAnalysisResults: "static-analysis-results.json",
    },
  });

  // Output data node for AI analysis stage
  await createDataNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2.id,
    parentPath: stage2Path,
    name: "AI Findings Output",
    payload: {
      aiFindings: "ai-findings.json",
      suggestions: "suggestions.json",
    },
  });

  console.log("Created data nodes");

  // ==========================================
  // PLAN EDGES (DATA FLOW)
  // ==========================================
  await db.insert(planEdges).values([
    {
      fromNodeId: job1_1.id,
      toNodeId: job1_2.id,
      kind: "data",
      role: "required",
    },
    {
      fromNodeId: job1_2.id,
      toNodeId: job1_3.id,
      kind: "data",
      role: "required",
    },
    {
      fromNodeId: job1_3.id,
      toNodeId: job2_1.id,
      kind: "data",
      role: "required",
    },
    {
      fromNodeId: job2_1.id,
      toNodeId: job2_2.id,
      kind: "data",
      role: "optional",
    },
  ]);

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log("\n=== Seed Complete ===");
  console.log(`Plan ID: ${planNode.id}`);
  console.log(`Plan Name: ${planNode.name}`);
  console.log("Structure:");
  console.log("  - Part 1: Code Ingestion (3 jobs)");
  console.log("  - Part 2: AI-Powered Analysis (3 jobs)");
  console.log("\nContext Nodes: plan-level (2), part-level (2), job-level (1)");
  console.log("Data Nodes: 4 configured");

  return planNode;
}

// ==========================================
// Helper Functions
// ==========================================

async function createStageNode(params: {
  tenantId: number;
  planId: number;
  parentId: number;
  parentPath: string;
  name: string;
  description?: string;
  executionMode?: "sequential" | "parallel";
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
  disableDependencyInheritance?: boolean;
}): Promise<[typeof nodes.$inferSelect, string]> {
  const [node] = await db
    .insert(nodes)
    .values({
      type: "stage",
      name: params.name,
      path: "temp",
      depth: 0,
      parentId: params.parentId,
      planId: params.planId,
      tenantId: params.tenantId,
      includeDependencyIds: params.includeDependencyIds ?? [],
      excludeDependencyIds: params.excludeDependencyIds ?? [],
      disableDependencyInheritance: params.disableDependencyInheritance ?? false,
    })
    .returning();

  const path = buildPath(params.parentPath, "stage", node.id);
  const depth = getPathDepth(path);

  await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id));

  await db.insert(stageNodes).values({
    nodeId: node.id,
    description: params.description ?? null,
    executionMode: params.executionMode ?? "sequential",
  });

  return [{ ...node, path, depth }, path];
}

async function createJobNode(params: {
  tenantId: number;
  planId: number;
  parentId: number;
  parentPath: string;
  name: string;
  description?: string;
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
  disableDependencyInheritance?: boolean;
}): Promise<[typeof nodes.$inferSelect, string]> {
  const [node] = await db
    .insert(nodes)
    .values({
      type: "job",
      name: params.name,
      path: "temp",
      depth: 0,
      parentId: params.parentId,
      planId: params.planId,
      tenantId: params.tenantId,
      includeDependencyIds: params.includeDependencyIds ?? [],
      excludeDependencyIds: params.excludeDependencyIds ?? [],
      disableDependencyInheritance: params.disableDependencyInheritance ?? false,
    })
    .returning();

  const path = buildPath(params.parentPath, "job", node.id);
  const depth = getPathDepth(path);

  await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id));

  await db.insert(jobNodes).values({
    nodeId: node.id,
    description: params.description ?? null,
  });

  return [{ ...node, path, depth }, path];
}

async function createContextNode(params: {
  tenantId: number;
  planId: number;
  parentId: number;
  parentPath: string;
  name: string;
  contextType: "requirement" | "constraint" | "decision" | "code" | "note";
  payload: string;
}): Promise<[typeof nodes.$inferSelect, string]> {
  const [node] = await db
    .insert(nodes)
    .values({
      type: "context",
      name: params.name,
      path: "temp",
      depth: 0,
      parentId: params.parentId,
      planId: params.planId,
      tenantId: params.tenantId,
    })
    .returning();

  const path = buildPath(params.parentPath, "context", node.id);
  const depth = getPathDepth(path);

  await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id));

  await db.insert(contextNodes).values({
    nodeId: node.id,
    contextType: params.contextType,
    payload: params.payload,
  });

  return [{ ...node, path, depth }, path];
}

async function createDataNode(params: {
  tenantId: number;
  planId: number;
  parentId: number;
  parentPath: string;
  name: string;
  payload: unknown;
}): Promise<[typeof nodes.$inferSelect, string]> {
  const [node] = await db
    .insert(nodes)
    .values({
      type: "data",
      name: params.name,
      path: "temp",
      depth: 0,
      parentId: params.parentId,
      planId: params.planId,
      tenantId: params.tenantId,
    })
    .returning();

  const path = buildPath(params.parentPath, "data", node.id);
  const depth = getPathDepth(path);

  await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id));

  await db.insert(dataNodes).values({
    nodeId: node.id,
    payload: params.payload,
  });

  return [{ ...node, path, depth }, path];
}

// Run the seed
seedExamplePlan()
  .then((plan) => {
    console.log(`\nView the plan at: http://localhost:3000/plans/${plan.id}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
