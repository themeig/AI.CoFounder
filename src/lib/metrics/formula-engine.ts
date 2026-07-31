export interface MetricValueMap {
  [metricSlugOrTitle: string]: number;
}

export interface PresetFormula {
  name: string;
  slug: string;
  category: string;
  formula: string;
  description: string;
  unit: string;
}

export const PRESET_FORMULAS: PresetFormula[] = [
  {
    name: "Customer Acquisition Cost (CAC)",
    slug: "cac",
    category: "Acquisizione",
    formula: "metrica('spesa_marketing') / metrica('nuovi_clienti')",
    description: "Costo totale sostenuto per acquisire ciascun nuovo cliente payante.",
    unit: "€"
  },
  {
    name: "LTV / CAC Ratio",
    slug: "ltv_cac_ratio",
    category: "Efficienza",
    formula: "metrica('ltv') / metrica('cac')",
    description: "Rapporto tra il valore generato da un cliente nel tempo e il costo per acquisirlo. Ottimale > 3.0x.",
    unit: "x"
  },
  {
    name: "Payback Period",
    slug: "payback_period",
    category: "Efficienza",
    formula: "metrica('cac') / metrica('arpu')",
    description: "Numero di mesi necessari per recuperare il costo di acquisizione del cliente.",
    unit: "mesi"
  },
  {
    name: "Runway (Mesi di Autonomia)",
    slug: "runway",
    category: "Finanza",
    formula: "metrica('cassa_attuale') / metrica('burn_rate')",
    description: "Mesi di sopravvivenza rimanenti al ritmo attuale di spesa prima di esaurire la cassa.",
    unit: "mesi"
  },
  {
    name: "Net Revenue Retention (NRR)",
    slug: "nrr",
    category: "Retention",
    formula: "((metrica('mrr') + metrica('espansione') - metrica('churn_mrr')) / metrica('mrr')) * 100",
    description: "Percentuale di ricavi ricorrenti mantenuta ed espansa sulla base clienti esistente.",
    unit: "%"
  }
];

/**
 * Safely evaluates a custom math formula string referencing metrics via `metrica('slug')`
 */
export function evaluateFormula(formulaStr: string, valuesMap: MetricValueMap): { success: boolean; result: number; error?: string } {
  if (!formulaStr || !formulaStr.trim()) {
    return { success: false, result: 0, error: "Formula vuota" };
  }

  try {
    let expr = formulaStr.trim();

    // Replace metrica('slug') or metrica("slug") with numeric value from map
    const metricaRegex = /metrica\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
    let missingMetric: string | null = null;

    expr = expr.replace(metricaRegex, (_, rawSlug) => {
      const slugKey = rawSlug.trim().toLowerCase().replace(/\s+/g, '_');
      
      // Find matching key case-insensitively or via fuzzy slug
      let matchedVal: number | undefined = valuesMap[slugKey];
      if (matchedVal === undefined) {
        const foundKey = Object.keys(valuesMap).find(k => k.toLowerCase().replace(/\s+/g, '_') === slugKey);
        if (foundKey) matchedVal = valuesMap[foundKey];
      }

      if (matchedVal === undefined || isNaN(matchedVal)) {
        missingMetric = rawSlug;
        return "0";
      }

      return matchedVal.toString();
    });

    if (missingMetric) {
      return { success: false, result: 0, error: `Metrica dipendente non trovata o vuota: "${missingMetric}"` };
    }

    // Sanitize expression (only allow numbers, math operators, spaces, parentheses)
    const safeExpr = expr.replace(/[^0-9\.\+\-\*\/\(\)\s]/g, "");
    
    // Evaluate safely using Function constructor inside controlled sandbox
    const fn = new Function(`"use strict"; return (${safeExpr});`);
    const val = Number(fn());

    if (isNaN(val) || !isFinite(val)) {
      return { success: false, result: 0, error: "Risultato non valido (divisione per zero o valore indefinito)" };
    }

    return { success: true, result: Number(val.toFixed(2)) };
  } catch (err: any) {
    return { success: false, result: 0, error: `Errore di sintassi nella formula: ${err.message}` };
  }
}
