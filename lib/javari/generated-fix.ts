// [JAVARI-FIX] architectureBrain.ts
import { PlatformState, TechnicalPlan } from './interfaces';
import { Analyzer } from './analyzer';
import { Planner } from './planner';

class ArchitectureBrain {
    private analyzer: Analyzer;
    private planner: Planner;

    constructor() {
        this.analyzer = new Analyzer();
        this.planner = new Planner();
    }

    public analyzeAndPlan(platformState: PlatformState): TechnicalPlan {
        const gaps = this.analyzer.identifyGaps(platformState);
        const technicalPlan = this.planner.generatePlan(gaps);
        return technicalPlan;
    }
}

export default ArchitectureBrain;