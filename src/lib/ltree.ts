import type { NodeType } from "@/dbs/drizzle/schema";

/**
 * ltree Path Utilities
 *
 * Path format: {type}_{id}.{type}_{id}...
 * Example: plan_1.stage_2.job_3.context_4
 *
 * PostgreSQL ltree uses '.' as separator
 * Each segment is: {nodeType}_{nodeId}
 */

/**
 * Create a path segment from type and id
 */
export function createPathSegment(type: NodeType, id: number): string {
  return `${type}_${id}`;
}

/**
 * Parse a path segment into type and id
 */
export function parsePathSegment(segment: string): { type: NodeType; id: number } | null {
  const match = segment.match(/^(plan|stage|job|context|io)_(\d+)$/);
  if (!match) return null;
  return {
    type: match[1] as NodeType,
    id: parseInt(match[2], 10),
  };
}

/**
 * Build a full path from parent path and new segment
 */
export function buildPath(parentPath: string | null, type: NodeType, id: number): string {
  const segment = createPathSegment(type, id);
  return parentPath ? `${parentPath}.${segment}` : segment;
}

/**
 * Get parent path from a path (removes last segment)
 */
export function getParentPath(path: string): string | null {
  const segments = path.split(".");
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join(".");
}

/**
 * Get the depth of a path (number of segments)
 */
export function getPathDepth(path: string): number {
  return path.split(".").length - 1; // Root is depth 0
}

/**
 * Get all ancestor paths from a path
 * Example: "plan_1.stage_2.job_3" => ["plan_1", "plan_1.stage_2"]
 */
export function getAncestorPaths(path: string): string[] {
  const segments = path.split(".");
  const ancestors: string[] = [];

  for (let i = 1; i < segments.length; i++) {
    ancestors.push(segments.slice(0, i).join("."));
  }

  return ancestors;
}

/**
 * Check if path is a descendant of another path
 */
export function isDescendantOf(childPath: string, ancestorPath: string): boolean {
  return childPath.startsWith(ancestorPath + ".") || childPath === ancestorPath;
}

/**
 * Check if path is a direct child of another path
 */
export function isDirectChildOf(childPath: string, parentPath: string): boolean {
  const expectedPrefix = parentPath + ".";
  if (!childPath.startsWith(expectedPrefix)) return false;
  const suffix = childPath.slice(expectedPrefix.length);
  return !suffix.includes(".");
}

/**
 * Get the root segment (plan) from a path
 */
export function getRootSegment(path: string): string {
  return path.split(".")[0];
}

/**
 * Extract the node id from a path (from the last segment)
 */
export function getNodeIdFromPath(path: string): number | null {
  const segments = path.split(".");
  const lastSegment = segments[segments.length - 1];
  const parsed = parsePathSegment(lastSegment);
  return parsed?.id ?? null;
}

/**
 * Get the node type from the last segment of a path
 */
export function getNodeTypeFromPath(path: string): NodeType | null {
  const segments = path.split(".");
  const lastSegment = segments[segments.length - 1];
  const parsed = parsePathSegment(lastSegment);
  return parsed?.type ?? null;
}

/**
 * Update path when a node's ID changes (for use after insert)
 * This replaces a placeholder segment with the real ID
 */
export function updatePathWithId(
  tempPath: string,
  tempId: string,
  realId: number
): string {
  // Replace temp_X with type_realId
  const segments = tempPath.split(".");
  return segments
    .map((seg) => {
      if (seg.endsWith(`_${tempId}`)) {
        const type = seg.split("_")[0] as NodeType;
        return createPathSegment(type, realId);
      }
      return seg;
    })
    .join(".");
}

/**
 * SQL fragments for ltree queries
 * Note: These require the ltree extension to be enabled in PostgreSQL
 */
export const ltreeQueries = {
  /**
   * Check if path is descendant of prefix (includes self)
   * Usage: sql`${path} <@ ${prefix}::ltree`
   */
  isDescendant: (path: string, ancestorPath: string) =>
    `'${path}'::ltree <@ '${ancestorPath}'::ltree`,

  /**
   * Check if path is ancestor of target (includes self)
   * Usage: sql`${targetPath}::ltree <@ ${path}`
   */
  isAncestor: (path: string, descendantPath: string) =>
    `'${descendantPath}'::ltree <@ '${path}'::ltree`,

  /**
   * Get the number of labels (depth + 1) in path
   * Usage: sql`nlevel(${path}::ltree)`
   */
  depth: (path: string) => `nlevel('${path}'::ltree) - 1`,
};
