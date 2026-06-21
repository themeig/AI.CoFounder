// rice-prioritization.ts

class Feature {
    name: string;
    reach: number;       // Numero stimato di utenti raggiunti (es. in un mese/trimestre)
    impact: number;      // Impatto sull'utente: 3 (massimo), 2 (alto), 1 (medio), 0.5 (basso), 0.25 (minimo)
    confidence: number;  // Percentuale di confidenza nella stima (es. 1 per 100%, 0.8 per 80%)
    effort: number;      // Tempo/sforzo stimato in mesi-persona (es. 1.5, 3)
    riceScore: number;

    constructor(name: string, reach: number, impact: number, confidence: number, effort: number) {
        this.name = name;
        this.reach = reach;
        this.impact = impact;
        this.confidence = confidence;
        this.effort = effort;
        this.riceScore = this.calculateRiceScore();
    }

    private calculateRiceScore(): number {
        // Formula RICE: (Reach * Impact * Confidence) / Effort
        if (this.effort <= 0) {
            // Evitiamo divisioni per zero o sforzi negativi impostando uno sforzo minimo
            return (this.reach * this.impact * this.confidence) / 0.1;
        }
        return (this.reach * this.impact * this.confidence) / this.effort;
    }
}

class BacklogManager {
    private features: Feature[] = [];

    addFeature(name: string, reach: number, impact: number, confidence: number, effort: number): void {
        const feature = new Feature(name, reach, impact, confidence, effort);
        this.features.push(feature);
    }

    getPrioritizedFeatures(): Feature[] {
        // Ordina le funzionalità in base al punteggio RICE decrescente
        return [...this.features].sort((a, b) => b.riceScore - a.riceScore);
    }

    printPrioritizedFeatures(): void {
        console.log("--- FUNZIONALITÀ PRIORITIZZATE (RICE SCORE) ---");
        const prioritized = this.getPrioritizedFeatures();
        
        if (prioritized.length === 0) {
            console.log("Il backlog è vuoto.");
            return;
        }

        prioritized.forEach((feature, index) => {
            console.log(`${index + 1}. ${feature.name}`);
            console.log(`   [R] Reach: ${feature.reach} utenti | [I] Impatto: ${feature.impact} | [C] Confidenza: ${(feature.confidence * 100).toFixed(0)}% | [E] Sforzo: ${feature.effort} PM`);
            console.log(`   RICE Score: ${feature.riceScore.toFixed(2)}`);
            if (index < prioritized.length - 1) {
                console.log("-".repeat(45));
            }
        });
        console.log("-----------------------------------------------");
    }
}

// Inizializzazione backlog e aggiunta di 3 feature d'esempio
const backlog = new BacklogManager();

backlog.addFeature("Ottimizzazione Lead Form", 100000, 1.0, 0.85, 1.0);  // R: 100k, I: 1.0, C: 85%, E: 1.0 PM
backlog.addFeature("Implementazione Autenticazione Social", 50000, 2.0, 0.90, 3.0); // R: 50k, I: 2.0, C: 90%, E: 3.0 PM
backlog.addFeature("Dashboard Analitica Avanzata", 10000, 3.0, 0.70, 5.0); // R: 10k, I: 3.0, C: 70%, E: 5.0 PM

// Stampa della lista prioritizzata
backlog.printPrioritizedFeatures();
