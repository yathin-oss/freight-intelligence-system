import { Suspense } from "react";
import { DecisionWorkspaceClient } from "@/components/decision/DecisionWorkspaceClient";

export default function DecisionPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-base-500">Loading Decision Workspace...</div>}>
      <DecisionWorkspaceClient />
    </Suspense>
  );
}
