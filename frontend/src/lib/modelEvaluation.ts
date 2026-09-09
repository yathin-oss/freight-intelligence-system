// Static offline evaluation results, copied verbatim from this repo's
// ml/evaluation/results.json (reproduced independently by
// `python3 ml/evaluation/evaluate.py`, which prints a MATCH/DRIFT check
// against this exact file). NOT a live API field - there is no backend
// endpoint for model metrics, and there is no live AIS/market feed behind
// any of these numbers. Shown on the Status page as a disclosed, static,
// reproducible reference table - re-run the script above any time to
// verify these haven't drifted from what's actually in the repo.
export const MODEL_EVALUATION = {
  deployedModel: "Linear Regression",
  selectionNote:
    "Naive Persistence scores lowest MAPE but 0% directional accuracy (it always predicts \"no change\"), so it's disqualified before ranking - see train.py.",
  testSetMetrics: {
    naive_persistence: { mae: 0.693, rmse: 1.017, mape: 3.66, directionalAccuracy: 0.0 },
    moving_average_4wk: { mae: 0.89, rmse: 1.226, mape: 4.63, directionalAccuracy: 53.3 },
    linear_regression: { mae: 0.697, rmse: 1.015, mape: 3.76, directionalAccuracy: 61.7 },
    random_forest: { mae: 0.732, rmse: 1.091, mape: 3.87, directionalAccuracy: 61.1 },
  },
  featureSet: [
    "Lag features: 1 / 2 / 4 / 8 week freight rate",
    "Rolling mean & std (4wk, 8wk), computed with shift(1) before windowing",
    "Calendar seasonality (sin/cos of week-of-year)",
    "Bunker price proxy, held at last observed value during multi-step forecast",
  ],
  splitMethod: "Chronological 70% train / 15% val / 15% test - no shuffling, no random split.",
} as const;
