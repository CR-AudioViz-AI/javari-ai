// tests/javari-step3.test.ts
// Unit tests for Step 3: Autonomy + Roadmap

import { AutonomyEnforcer } from '../lib/javari-autonomy-enforcer';

describe('AutonomyEnforcer', () => {
  let enforcer: AutonomyEnforcer;

  beforeEach(() => {
    enforcer = new AutonomyEnforcer();
  });

  // Forbidden phrase detection tests
  test('Detects "should we" as violation', () => {
    const response = 'I can build this. Should we proceed with the implementation?';
    const result = enforcer.checkResponse(response, 'BUILD');
    
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('Detects "would you like" as violation', () => {
    const response = 'Would you like me to create a new component?';
    const result = enforcer.checkResponse(response, 'EXECUTE');
    
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('Detects "do you want" as violation', () => {
    const response = 'Do you want me to add error handling?';
    const result = enforcer.checkResponse(response, 'BUILD');
    
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('Detects "can I" as violation', () => {
    const response = 'Can I proceed with the deployment?';
    const result = enforcer.checkResponse(response, 'EXECUTE');
    
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('Detects excessive questions (>4)', () => {
    const response = 'What color? What size? What style? What format? What timing?';
    const result = enforcer.checkResponse(response, 'BUILD');
    
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('Too many questions'))).toBe(true);
  });

  // Passing tests
  test('Allows autonomous statements in BUILD mode', () => {
    const response = "I'll build the component now. Assumptions: React, TypeScript, Tailwind.";
    const result = enforcer.checkResponse(response, 'BUILD');
    
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  test('Allows autonomous statements in EXECUTE mode', () => {
    const response = "Creating PR now. Changes: updated API endpoint, added error handling.";
    const result = enforcer.checkResponse(response, 'EXECUTE');
    
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  test('Allows questions in RECOVER mode', () => {
    const response = 'The build failed. Should we try a different approach?';
    const result = enforcer.checkResponse(response, 'RECOVER');
    
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  test('Allows up to 4 questions', () => {
    const response = 'Building now. Colors? Size? Layout? Style?';
    const result = enforcer.checkResponse(response, 'BUILD');
    
    expect(result.passed).toBe(true);
  });

  // Response correction tests
  test('Corrects response by removing permission-seeking', () => {
    const response = 'I can build this. Should we proceed?';
    const result = enforcer.checkResponse(response, 'BUILD');
    
    expect(result.correctedResponse).toBeTruthy();
    expect(result.correctedResponse).not.toContain('Should we');
    expect(result.correctedResponse).toContain('Proceeding');
  });

  // Autonomous response generation
  test('Generates autonomous response with assumptions', () => {
    const response = enforcer.generateAutonomousResponse(
      'build a login component',
      ['Email/password authentication', 'Material-UI styling', 'Form validation']
    );
    
    expect(response).toContain("I'll build a login component");
    expect(response).toContain('Assumptions:');
    expect(response).toContain('Email/password authentication');
    expect(response).toContain('Starting implementation now');
  });

  test('Formats minimal questions', () => {
    const verbose = 'Would you like to use TypeScript or JavaScript for this component?';
    const minimal = enforcer.formatMinimalQuestion(verbose);
    
    expect(minimal).not.toContain('Would you like');
    expect(minimal.length).toBeLessThan(verbose.length);
    expect(minimal).toMatch(/\?$/);
  });
});

// Roadmap next action tests
describe('RoadmapEngine Next Action Selection', () => {
  test('Selects highest priority actionable item', () => {
    const items = [
      { priority: 'medium', status: 'planned', dependencies: [] },
      { priority: 'critical', status: 'planned', dependencies: [] },
      { priority: 'high', status: 'planned', dependencies: [] },
    ];

    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const sorted = items.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    expect(sorted[0].priority).toBe('critical');
  });

  test('Filters out blocked items', () => {
    const items = [
      { priority: 'critical', status: 'blocked', dependencies: [] },
      { priority: 'high', status: 'planned', dependencies: [] },
    ];

    const actionable = items.filter(item => item.status !== 'blocked');

    expect(actionable.length).toBe(1);
    expect(actionable[0].status).toBe('planned');
  });

  test('Filters out items with dependencies', () => {
    const items = [
      { priority: 'critical', status: 'planned', dependencies: ['task-1'] },
      { priority: 'high', status: 'planned', dependencies: [] },
    ];

    const actionable = items.filter(item => 
      !item.dependencies || item.dependencies.length === 0
    );

    expect(actionable.length).toBe(1);
    expect(actionable[0].dependencies).toHaveLength(0);
  });
});

export {};
