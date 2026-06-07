import { describe, it, expect } from 'vitest';
import {
  estimateMatrixElements,
  estimateBilledElements,
  countUniqueLegs,
  assessMatrixRequest,
  createRouteBudget,
  consumeBudgetElements,
} from '../routesApiBudget.js';

describe('routesApiBudget', () => {
  it('calculates 12 origins x 12 destinations = 144 elements', () => {
    const origins = Array.from({ length: 12 }, (_, i) => ({ lat: 43 + i * 0.01, lng: -70 }));
    const destinations = Array.from({ length: 12 }, (_, i) => ({ lat: 44 + i * 0.01, lng: -71 }));
    const legs = origins.flatMap(o => destinations.map(d => ({ origin: o, destination: d })));
    expect(estimateMatrixElements(legs)).toBe(144);
  });

  it('targeted insertion legs bill far fewer elements than a full stop matrix', () => {
    const stops = Array.from({ length: 12 }, (_, i) => ({ lat: 43 + i * 0.02, lng: -70 - i * 0.01 }));
    const lead = { lat: 43.5, lng: -70.5 };
    const start = { lat: 43, lng: -70 };
    const end = { lat: 43.5, lng: -70.5 };
    const targeted = [];
    targeted.push({ origin: start, destination: stops[0] });
    for (let i = 0; i < stops.length - 1; i++) {
      targeted.push({ origin: stops[i], destination: stops[i + 1] });
    }
    targeted.push({ origin: stops[stops.length - 1], destination: end });
    for (let insertIdx = -1; insertIdx < stops.length; insertIdx++) {
      const prev = insertIdx >= 0 ? stops[insertIdx] : start;
      const next = insertIdx + 1 < stops.length ? stops[insertIdx + 1] : end;
      targeted.push({ origin: prev, destination: lead });
      targeted.push({ origin: lead, destination: next });
    }

    const fullGrid = stops.flatMap(o => stops.map(d => ({ origin: o, destination: d })));
    expect(estimateMatrixElements(fullGrid)).toBe(144);
    expect(countUniqueLegs(targeted)).toBeLessThan(144);
    expect(estimateBilledElements(targeted)).toBeLessThan(estimateBilledElements(fullGrid));
  });

  it('rejects matrix when route exceeds per-route element budget', () => {
    const budget = createRouteBudget({ budget: { maxElementsPerRoute: 50, remainingSearchElements: 250 } });
    const legs = Array.from({ length: 8 }, (_, i) => ({
      origin: { lat: 43 + i * 0.1, lng: -70 },
      destination: { lat: 44 + i * 0.1, lng: -71 },
    }));
    const assessment = assessMatrixRequest(legs, budget);
    expect(assessment.allowed).toBe(false);
    expect(assessment.reason).toBe('route_element_budget');
  });

  it('rejects matrix when search budget would be exceeded', () => {
    const budget = createRouteBudget({ budget: { maxElementsPerRoute: 100, remainingSearchElements: 10 } });
    const legs = [
      { origin: { lat: 43.1, lng: -70.1 }, destination: { lat: 43.2, lng: -70.2 } },
      { origin: { lat: 43.3, lng: -70.3 }, destination: { lat: 43.4, lng: -70.4 } },
      { origin: { lat: 43.5, lng: -70.5 }, destination: { lat: 43.6, lng: -70.6 } },
      { origin: { lat: 43.7, lng: -70.7 }, destination: { lat: 43.8, lng: -70.8 } },
    ];
    const assessment = assessMatrixRequest(legs, budget);
    expect(assessment.allowed).toBe(false);
    expect(assessment.reason).toBe('search_element_budget');
  });

  it('tracks consumed budget elements', () => {
    const budget = createRouteBudget({ budget: { remainingSearchElements: 100 } });
    consumeBudgetElements(budget, 25, { fromCache: 3 });
    expect(budget.elementsRequested).toBe(25);
    expect(budget.elementsFromCache).toBe(3);
    expect(budget.remainingSearchElements).toBe(75);
  });
});
