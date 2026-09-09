# Demo Script (~2–3 minutes)

Preconditions: `docker compose up --build` or `./scripts/dev.sh` is running;
<http://localhost:3000> is open. It lands on **Global Network** by default.

1. **Global Network.** Point out the world map: overseas origins (blue dots
   — Australia, Indonesia, Mozambique, Russia, United States) connected by
   arcs to East Coast India ports (cyan dots). Mention the stat tiles (7
   ports, 42 lanes tracked). Note the amber "Offline basemap (bundled)"
   pill — the map works with zero internet dependency and zero API key.

2. **India / East Coast focus.** Click **India**, then **East Coast** in
   the top-right view control. The map flies in; all 7 ports become
   individually distinguishable.

3. **Hover Paradip.** Point the cursor at the Paradip marker. The popup
   shows port type, draft/LOA/beam limits, congestion, risk, compatible
   vessel classes, and a `ESTIMATED` data-status badge — say out loud:
   "every value here is either real or explicitly labelled, nothing is
   invented silently."

4. **Hover a route, then click it.** Hover the Australia→Paradip arc — the
   popup shows distance, reference freight, 8-week trend, congestion, risk,
   and indicative volume, with a note that live forecast/confidence is
   computed in the Decision Workspace (not faked in the hover). Click the
   arc — it opens **Decision Workspace** with Origin=Australia,
   Destination=Paradip, Cargo=Coal already filled in.

5. **Run Analysis.** Set Quantity to 80,000 t (or just use the prefilled
   demo defaults / click **Demo Mode** in the nav from anywhere). Click
   **Run Analysis**.

6. **Freight Forecast.** Point out the chart (historical actuals →
   dashed-boundary forecast with widening confidence band), the current
   rate, trend arrow, confidence %, and volatility — all computed by the
   trained model, not hardcoded.

7. **Vessel Optimizer — reject then recommend.** Scroll to Section 4.
   Handysize/Supramax/Panamax are shown **REJECTED** with the literal
   reason ("Cargo capacity 34,000 t is below the 80,000 t shipment
   quantity" etc.) — point out that nothing was silently dropped, every
   candidate is shown. Capesize is **FEASIBLE** and marked Recommended.

8. **Risk Center.** Four factors, each with its own explanation string
   tracing to a real input (forecast confidence, port congestion, etc.),
   rolled up into one overall LOW/MEDIUM/HIGH badge.

9. **What-If Simulator.** Four scenario cards — Book Now / Wait N weeks /
   Alternative Vessel / Alternative Port — each priced with a full cost
   breakdown, one flagged **Best Expected Option**. Point out that this is
   a real price comparison, not a static list.

10. **Total Expected Cost.** The stacked bar breakdown (freight + idle +
    demurrage + deadheading + risk penalty) with the assumption strings
    underneath — say: "every dollar here traces to a documented formula in
    `cost_service.py`, labelled ESTIMATED/SIMULATED where appropriate."

11. **"Why This Recommendation?"** The final numbered explanation — read 2–3
    of the numbered statements aloud, then the headline action (BOOK NOW /
    WAIT / BOOK WITHIN X–Y WEEKS / MONITOR MARKET). Emphasize: this is the
    product's differentiation — not "freight will decrease," but "freight
    will move X%, confidence Y%, this vessel is feasible, risk is Z,
    waiting produces a lower/higher expected cost, therefore: ACTION."

12. **(Optional) Data / Model status page.** One extra beat if time allows —
    show the full provenance table and the explicitly `NOT CONNECTED`
    future integrations (AIS, licensed freight index). This is the page to
    open if a judge asks "is this real data?" before you even finish the
    sentence.

**If asked to repeat instantly:** the **Demo Mode** button in the top nav
(and the CTA on the Global Network page) reloads the exact same Australia →
Paradip → Coal → 80,000 t scenario from anywhere in the app in one click.
