import { FlaskConical } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { MODEL_EVALUATION } from "@/lib/modelEvaluation";

const ROW_ORDER = ["naive_persistence", "moving_average_4wk", "linear_regression", "random_forest"] as const;
const ROW_LABEL: Record<(typeof ROW_ORDER)[number], string> = {
  naive_persistence: "Naive Persistence",
  moving_average_4wk: "Moving Average (4wk)",
  linear_regression: "Linear Regression (deployed)",
  random_forest: "Random Forest",
};

// Same panel shape as the Stitch reference's "Model Calibration & Data
// Provenance Monitor" - a dense terminal-style validation readout - but
// every number is the real, reproducible offline evaluation from this
// repo (see lib/modelEvaluation.ts), not an invented "Transformer-LSTM
// Ensemble v2.4.1" with fabricated feature-importance weights.
export function ModelValidationPanel() {
  return (
    <Panel
      title="Model Validation (Offline Evaluation)"
      subtitle="Reproduce with: python3 ml/evaluation/evaluate.py — prints a MATCH/DRIFT check against this table."
      right={<FlaskConical className="h-4 w-4 text-base-500" />}
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-base-100/[0.08] bg-base-900/50 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-base-500">Deployed Model</div>
          <div className="mt-0.5 text-[13px] font-semibold text-base-100">{MODEL_EVALUATION.deployedModel}</div>
        </div>
        <div className="rounded border border-base-100/[0.08] bg-base-900/50 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-base-500">Train / Val / Test Split</div>
          <div className="mt-0.5 text-[12px] text-base-100">{MODEL_EVALUATION.splitMethod}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-base-100/[0.08] text-[10px] uppercase tracking-wider text-base-500">
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">MAE</th>
              <th className="px-3 py-2 font-medium">RMSE</th>
              <th className="px-3 py-2 font-medium">MAPE</th>
              <th className="px-3 py-2 font-medium">Directional Acc.</th>
            </tr>
          </thead>
          <tbody>
            {ROW_ORDER.map((key) => {
              const m = MODEL_EVALUATION.testSetMetrics[key];
              const deployed = key === "linear_regression";
              return (
                <tr key={key} className={`border-b border-base-100/[0.04] last:border-b-0 ${deployed ? "bg-accent-gold/[0.05]" : ""}`}>
                  <td className={`px-3 py-2 font-medium ${deployed ? "text-accent-gold" : "text-base-100"}`}>{ROW_LABEL[key]}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-base-500">{m.mae.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-base-500">{m.rmse.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-base-500">{m.mape.toFixed(2)}%</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-base-500">{m.directionalAccuracy.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-base-500">{MODEL_EVALUATION.selectionNote}</p>

      <div className="mt-3 border-t border-base-100/[0.08] pt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-base-500">Feature Set</div>
        <ul className="space-y-1 text-[11.5px] text-base-500">
          {MODEL_EVALUATION.featureSet.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
