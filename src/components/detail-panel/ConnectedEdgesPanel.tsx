"use client";

import { Badge } from "@/components/ui/badge";
import { getNodeById, useEdgesByNodeId } from "@/stores/plan/planDataStore";
import { ArrowRight } from "lucide-react";

export function ConnectedEdgesPanel({ nodeId }: { nodeId: number }) {
  const edges = useEdgesByNodeId(nodeId);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Connected Edges</h3>
      {!edges?.length ? (
        <p className="text-sm text-muted-foreground py-2 text-center">
          No edges connected
        </p>
      ) : (
        <div className="space-y-2">
          <div className="space-y-2">
            {edges.map((edge) => {
              const direction = edge.fromNodeId === nodeId ? "out" : "in";
              const otherNodeId = direction === "out" ? edge.toNodeId : edge.fromNodeId;
              const otherNode = getNodeById(otherNodeId);

              const title = otherNode?.title ?? `Node ${otherNodeId}`;
              return (
                <div
                  key={edge.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {direction === "out" ? (
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ArrowRight className="w-3 h-3 text-muted-foreground rotate-180" />
                    )}
                    <span className="font-medium">{title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {edge.kind}
                    </Badge>
                    {edge.role && (
                      <Badge variant="secondary" className="text-[10px]">
                        {edge.role}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// type EdgeListProps = {
//   label: string;
//   edges: PlanEdge[];
//   direction: "from" | "to";
//   nodeId: number;
//   nodesById: Map<number, PlanNode>;
// };

// function EdgeList({ label, edges, direction, nodeId }: EdgeListProps) {
//   const nodesById = useNodesById();
//   if (edges.length === 0) {
//     return (
//       <div className="space-y-1">
//         <div className="text-xs font-medium text-muted-foreground">{label}</div>
//         <div className="text-sm text-muted-foreground">None</div>
//       </div>
//     );
//   }
//   return (
//     <div className="space-y-2">
//       <div className="text-xs font-medium text-muted-foreground">{label}</div>
//       <div className="space-y-2">
//         {edges.map((edge) => {
//           const otherId = direction === "from" ? edge.fromNodeId : edge.toNodeId;
//           const otherNode = nodesById.get(otherId);
//           const title = otherNode?.title ?? `Node ${otherId}`;
//           return (
//             <div
//               key={edge.id}
//               className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
//             >
//               <div className="flex items-center gap-2">
//                 <span className="text-xs text-muted-foreground">{direction}</span>
//                 <span className="font-medium">{title}</span>
//               </div>
//               <div className="flex items-center gap-1">
//                 <Badge variant="outline" className="text-[10px]">
//                   {edge.kind}
//                 </Badge>
//                 {edge.role && (
//                   <Badge variant="secondary" className="text-[10px]">
//                     {edge.role}
//                   </Badge>
//                 )}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }
