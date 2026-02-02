import QueryClientProviderWrapper from "@/ctx/ctx/QueryClientProviderWrapper";

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return <QueryClientProviderWrapper>{children}</QueryClientProviderWrapper>;
}
