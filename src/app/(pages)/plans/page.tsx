import Link from "next/link";
import { Plus, FolderTree, Clock, GitBranch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPlans } from "@/actions/plan-actions";

//http://localhost:3000/plans
export default async function PlansPage() {
  const plans = await getPlans();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderTree className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Plans</h1>
          </div>
          <Link href="/plans/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Plan
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {plans.length === 0 ? (
          <div className="text-center py-16">
            <FolderTree className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No plans yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first plan to get started with deterministic execution.
            </p>
            <Link href="/plans/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((item) => (
              <Link
                key={item.plan.id}
                href={`/plans/${item.plan.id}`}
                className="block p-4 border rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.plan.name}</h3>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {item.plan.goal || "No goal set"}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0">
                    v{item.plan.version ?? 1}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(item.plan.updatedAt).toLocaleDateString()}
                  </div>
                  {item.plan.parentVersion && (
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      Forked from v{item.plan.parentVersion}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
