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
  ioNodes,
} from "../dbs/drizzle/schema";
import { buildPath, getPathDepth } from "../lib/ltree";

/**
 * Seed Example Plan using the new hierarchical node schema
 * Creates a comprehensive AI Code Review Pipeline plan with:
 * - Multiple stages (some nested)
 * - Jobs within stages (some nested)
 * - Context nodes at plan, stage, and job levels
 * - IO nodes for inputs and outputs
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
  // STAGE 1: Code Ingestion
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
    stageId: stage1.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Clone Repository",
    description: "Clone or fetch the target repository",
  });

  const [job1_2, job1_2Path] = await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage1.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Detect Languages",
    description: "Analyze file extensions and detect programming languages",
    dependsOnNodeIds: [job1_1.id],
  });

  const [job1_3] = await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage1.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Parse AST",
    description: "Generate Abstract Syntax Trees for each file",
    dependsOnNodeIds: [job1_2.id],
  });

  console.log(`Created stage: ${stage1.name} with 3 jobs`);

  // ==========================================
  // STAGE 2: Static Analysis (Parallel)
  // ==========================================
  const [stage2, stage2Path] = await createStageNode({
    tenantId,
    planId: planNode.id,
    parentId: planNode.id,
    parentPath: planPath,
    name: "Static Analysis",
    description: "Run parallel static analysis checks",
    executionMode: "parallel",
    dependsOnNodeIds: [stage1.id],
  });

  // Stage 2.1: Linting (nested stage)
  const [stage2_1, stage2_1Path] = await createStageNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2.id,
    parentPath: stage2Path,
    name: "Linting",
    description: "Run language-specific linters",
    executionMode: "parallel",
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage2_1.id,
    parentId: stage2_1.id,
    parentPath: stage2_1Path,
    name: "ESLint (TypeScript)",
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage2_1.id,
    parentId: stage2_1.id,
    parentPath: stage2_1Path,
    name: "Ruff (Python)",
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage2_1.id,
    parentId: stage2_1.id,
    parentPath: stage2_1Path,
    name: "golangci-lint (Go)",
  });

  // Stage 2.2: Security Scanning (nested stage)
  const [stage2_2, stage2_2Path] = await createStageNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2.id,
    parentPath: stage2Path,
    name: "Security Scanning",
    description: "Check for security vulnerabilities",
    executionMode: "sequential",
  });

  // Security scanning context
  await createContextNode({
    tenantId,
    planId: planNode.id,
    parentId: stage2_2.id,
    parentPath: stage2_2Path,
    name: "Severity Threshold",
    contextType: "decision",
    payload: JSON.stringify({
      failOn: ["critical", "high"],
      warnOn: ["medium"],
      ignore: ["low", "info"],
    }),
  });

  const [job2_2_1, job2_2_1Path] = await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage2_2.id,
    parentId: stage2_2.id,
    parentPath: stage2_2Path,
    name: "Dependency Audit",
    description: "Check for vulnerable dependencies",
  });

  const [job2_2_2, job2_2_2Path] = await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage2_2.id,
    parentId: stage2_2.id,
    parentPath: stage2_2Path,
    name: "Secret Detection",
    description: "Scan for hardcoded secrets and credentials",
    dependsOnNodeIds: [job2_2_1.id],
  });

  const [job2_2_3, job2_2_3Path] = await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage2_2.id,
    parentId: stage2_2.id,
    parentPath: stage2_2Path,
    name: "SAST Scan",
    description: "Static Application Security Testing",
    dependsOnNodeIds: [job2_2_2.id],
  });

  // Nested sub-jobs under SAST Scan
  const [job2_2_3_1] = await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage2_2.id,
    parentId: job2_2_3.id,
    parentPath: job2_2_3Path,
    name: "SQL Injection Check",
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage2_2.id,
    parentId: job2_2_3.id,
    parentPath: job2_2_3Path,
    name: "XSS Detection",
    dependsOnNodeIds: [job2_2_3_1.id],
  });

  console.log(`Created stage: ${stage2.name} with nested stages and jobs`);

  // ==========================================
  // STAGE 3: AI Analysis
  // ==========================================
  const [stage3, stage3Path] = await createStageNode({
    tenantId,
    planId: planNode.id,
    parentId: planNode.id,
    parentPath: planPath,
    name: "AI-Powered Analysis",
    description: "Use LLMs for deep code understanding",
    executionMode: "sequential",
    dependsOnNodeIds: [stage2.id],
  });

  // Stage 3 context - code style
  await createContextNode({
    tenantId,
    planId: planNode.id,
    parentId: stage3.id,
    parentPath: stage3Path,
    name: "Analysis Prompt Template",
    contextType: "code",
    payload: `You are a senior code reviewer. Analyze the following code for:
1. Code quality and maintainability
2. Potential bugs and edge cases
3. Performance optimizations
4. Best practices adherence

Provide specific, actionable feedback with code examples where appropriate.`,
  });

  const [job3_1, job3_1Path] = await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage3.id,
    parentId: stage3.id,
    parentPath: stage3Path,
    name: "Code Quality Assessment",
    description: "Analyze code quality using AI",
  });

  // Job context
  await createContextNode({
    tenantId,
    planId: planNode.id,
    parentId: job3_1.id,
    parentPath: job3_1Path,
    name: "Model Configuration",
    contextType: "constraint",
    payload: JSON.stringify({
      model: "claude-3-5-sonnet",
      temperature: 0.3,
      maxTokens: 4096,
    }),
  });

  const [job3_2] = await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage3.id,
    parentId: stage3.id,
    parentPath: stage3Path,
    name: "Bug Detection",
    description: "Identify potential bugs and issues",
    dependsOnNodeIds: [job3_1.id],
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage3.id,
    parentId: stage3.id,
    parentPath: stage3Path,
    name: "Improvement Suggestions",
    description: "Generate refactoring and optimization suggestions",
    dependsOnNodeIds: [job3_2.id],
  });

  console.log(`Created stage: ${stage3.name} with 3 jobs`);

  // ==========================================
  // STAGE 4: Report Generation
  // ==========================================
  const [stage4, stage4Path] = await createStageNode({
    tenantId,
    planId: planNode.id,
    parentId: planNode.id,
    parentPath: planPath,
    name: "Report Generation",
    description: "Compile and format the final review report",
    executionMode: "sequential",
    dependsOnNodeIds: [stage3.id],
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage4.id,
    parentId: stage4.id,
    parentPath: stage4Path,
    name: "Aggregate Findings",
    description: "Combine all analysis results",
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage4.id,
    parentId: stage4.id,
    parentPath: stage4Path,
    name: "Generate Markdown Report",
    description: "Create human-readable report",
  });

  await createJobNode({
    tenantId,
    planId: planNode.id,
    stageId: stage4.id,
    parentId: stage4.id,
    parentPath: stage4Path,
    name: "Create PR Comments",
    description: "Format findings as PR review comments",
  });

  console.log(`Created stage: ${stage4.name} with 3 jobs`);

  // ==========================================
  // IO NODES
  // ==========================================

  // Input IO node for stage 1
  await createIONode({
    tenantId,
    planId: planNode.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "Repository URL Input",
    direction: "input",
    ioType: "url",
    data: JSON.stringify({
      repoUrl: "https://github.com/example/repo",
      branch: "main",
      commitSha: "abc123",
    }),
  });

  // Output IO node for stage 1
  await createIONode({
    tenantId,
    planId: planNode.id,
    parentId: stage1.id,
    parentPath: stage1Path,
    name: "AST Artifacts Output",
    direction: "output",
    ioType: "artifact",
    data: JSON.stringify({
      astFiles: ["src/**/*.ast.json"],
      metadata: "repo-metadata.json",
    }),
  });

  // Input IO node for AI analysis stage
  await createIONode({
    tenantId,
    planId: planNode.id,
    parentId: stage3.id,
    parentPath: stage3Path,
    name: "Code Chunks Input",
    direction: "input",
    ioType: "data",
    data: JSON.stringify({
      codeChunks: "chunks/*.json",
      staticAnalysisResults: "static-analysis-results.json",
    }),
  });

  // Output IO node for AI analysis stage
  await createIONode({
    tenantId,
    planId: planNode.id,
    parentId: stage3.id,
    parentPath: stage3Path,
    name: "AI Findings Output",
    direction: "output",
    ioType: "artifact",
    data: JSON.stringify({
      aiFindings: "ai-findings.json",
      suggestions: "suggestions.json",
    }),
  });

  console.log("Created IO nodes");

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log("\n=== Seed Complete ===");
  console.log(`Plan ID: ${planNode.id}`);
  console.log(`Plan Name: ${planNode.name}`);
  console.log("Structure:");
  console.log("  - Stage 1: Code Ingestion (3 jobs)");
  console.log("  - Stage 2: Static Analysis (parallel)");
  console.log("    - Stage 2.1: Linting (3 jobs)");
  console.log("    - Stage 2.2: Security Scanning (3 jobs + 2 sub-jobs)");
  console.log("  - Stage 3: AI-Powered Analysis (3 jobs)");
  console.log("  - Stage 4: Report Generation (3 jobs)");
  console.log("\nContext Nodes: plan-level (2), stage-level (3), job-level (1)");
  console.log("IO Nodes: 4 configured");

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
  dependsOnNodeIds?: number[];
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
    dependsOnNodeIds: params.dependsOnNodeIds ?? [],
  });

  return [{ ...node, path, depth }, path];
}

async function createJobNode(params: {
  tenantId: number;
  planId: number;
  stageId: number;
  parentId: number;
  parentPath: string;
  name: string;
  description?: string;
  dependsOnNodeIds?: number[];
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
      stageId: params.stageId,
      tenantId: params.tenantId,
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
    dependsOnNodeIds: params.dependsOnNodeIds ?? [],
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

async function createIONode(params: {
  tenantId: number;
  planId: number;
  parentId: number;
  parentPath: string;
  name: string;
  direction: "input" | "output";
  ioType: "data" | "generator" | "artifact" | "model" | "dataset" | "url";
  data: string;
}): Promise<[typeof nodes.$inferSelect, string]> {
  const [node] = await db
    .insert(nodes)
    .values({
      type: "io",
      name: params.name,
      path: "temp",
      depth: 0,
      parentId: params.parentId,
      planId: params.planId,
      tenantId: params.tenantId,
    })
    .returning();

  const path = buildPath(params.parentPath, "io", node.id);
  const depth = getPathDepth(path);

  await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id));

  await db.insert(ioNodes).values({
    nodeId: node.id,
    direction: params.direction,
    ioType: params.ioType,
    data: params.data,
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
