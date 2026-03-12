// ---------------------------------------------------------------------------
// Intelligence module — export barrel
// ---------------------------------------------------------------------------

export * from "./types.js";
export {
  analyzeMonthlySummary,
  analyzeCashPosition,
  detectAnomalies,
  findUnclassifiedTransactions,
} from "./analyzer.js";
export {
  renderMonthlySummary,
  renderCashPosition,
  renderAnomalies,
  renderUnclassified,
} from "./renderer.js";
