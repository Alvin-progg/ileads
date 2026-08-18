// The comparator primitive every cut-off rests on. Tested exhaustively at the
// boundaries because an off-by-one-inclusive here silently mislabels learners
// across every instrument at once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { satisfies, firstMatchingLabel } from "./predicates.ts";

test("each bound applies at its own boundary", () => {
  assert.equal(satisfies(5, { gt: 5 }), false, "gt excludes the bound");
  assert.equal(satisfies(6, { gt: 5 }), true);

  assert.equal(satisfies(5, { gte: 5 }), true, "gte includes the bound");
  assert.equal(satisfies(4, { gte: 5 }), false);

  assert.equal(satisfies(5, { lt: 5 }), false, "lt excludes the bound");
  assert.equal(satisfies(4, { lt: 5 }), true);

  assert.equal(satisfies(5, { lte: 5 }), true, "lte includes the bound");
  assert.equal(satisfies(6, { lte: 5 }), false);
});

test("bounds combine as an AND", () => {
  const band = { gte: 0.25, lt: 0.5 };
  assert.equal(satisfies(0.25, band), true, "lower bound included");
  assert.equal(satisfies(0.4, band), true);
  assert.equal(satisfies(0.5, band), false, "upper bound excluded");
  assert.equal(satisfies(0.24, band), false);
});

test("mixed strictness is preserved rather than normalised", () => {
  // The instruments pair `<=0.50` with `<0.51` and `>0.75` with `<0.76`;
  // values in those seams must land exactly where the source puts them.
  assert.equal(satisfies(0.5, { gt: 0.25, lte: 0.5 }), true);
  assert.equal(satisfies(0.5, { gt: 0.25, lt: 0.51 }), true);
  assert.equal(satisfies(0.505, { gt: 0.25, lte: 0.5 }), false);
  assert.equal(satisfies(0.505, { gt: 0.5, lt: 0.76 }), true);
  assert.equal(satisfies(0.76, { gt: 0.75 }), true);
  assert.equal(satisfies(0.76, { lt: 0.76 }), false);
});

test("an empty predicate matches anything", () => {
  assert.equal(satisfies(0, {}), true);
  assert.equal(satisfies(-1, {}), true);
});

test("first matching band wins, in declared order", () => {
  const bands = [
    { label: "low", lt: 0.25 },
    { label: "mid", gte: 0.25, lt: 0.75 },
    { label: "high", gte: 0.75 },
  ];

  assert.equal(firstMatchingLabel(0.1, bands), "low");
  assert.equal(firstMatchingLabel(0.25, bands), "mid");
  assert.equal(firstMatchingLabel(0.74, bands), "mid");
  assert.equal(firstMatchingLabel(0.75, bands), "high");
  assert.equal(firstMatchingLabel(1, bands), "high");
});

test("overlapping bands resolve to the earlier one", () => {
  // Order is load-bearing: the ladders are transcribed as first-match, so a
  // later band must never steal a value the earlier one already claims.
  const bands = [
    { label: "first", gte: 0.5 },
    { label: "second", gte: 0.5 },
  ];
  assert.equal(firstMatchingLabel(0.6, bands), "first");
});

test("a value outside every band returns null, not a default", () => {
  const bands = [{ label: "only", gte: 0.9 }];
  assert.equal(firstMatchingLabel(0.1, bands), null);
});
