import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asList,
  calculateAge,
  calculateDiscount,
  clampLimit,
  clampPage,
  flattenSearch,
} from './utils.ts';

describe('calculateAge', () => {
  it('returns 0 for invalid dates', () => {
    assert.equal(calculateAge('not-a-date'), 0);
  });

  it('does not return negative ages', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 2);
    assert.equal(calculateAge(future), 0);
  });
});

describe('pagination clamps', () => {
  it('clamps page and limit', () => {
    assert.equal(clampPage(0), 1);
    assert.equal(clampPage(3.9), 3);
    assert.equal(clampLimit(1000, 20, 50), 50);
    assert.equal(clampLimit(undefined), 20);
  });
});

describe('asList', () => {
  it('reads items, data, or a raw array', () => {
    assert.deepEqual(asList([1, 2]), [1, 2]);
    assert.deepEqual(asList({ items: [1] }), [1]);
    assert.deepEqual(asList({ data: [2] }), [2]);
    assert.deepEqual(asList({ total: 0 }), []);
  });
});

describe('flattenSearch', () => {
  it('does not crash on grouped API payload', () => {
    const hits = flattenSearch({
      patients: [{ id: 'p1', firstName: 'Анна', lastName: 'Иванова', phone: '1' }],
      staff: [{ id: 's1', firstName: 'Иван', lastName: 'Петров', specialization: 'Массаж' }],
      services: [{ id: 'sv1', name: 'Остеопатия', durationMinutes: 60 }],
    });
    assert.equal(hits.length, 3);
    assert.equal(hits[0].type, 'patient');
    assert.equal(hits[0].title, 'Иванова Анна');
  });

  it('prefers a results array when present', () => {
    const hits = flattenSearch({
      results: [{ id: 'x', type: 'patient', title: 'Готово' }],
      patients: [{ id: 'p1', firstName: 'A', lastName: 'B' }],
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].title, 'Готово');
  });
});

describe('calculateDiscount', () => {
  it('caps percent discounts at 100', () => {
    const { discountAmount, finalPrice } = calculateDiscount(1000, 'PERCENT', 250);
    assert.equal(discountAmount, 1000);
    assert.equal(finalPrice, 0);
  });
});
