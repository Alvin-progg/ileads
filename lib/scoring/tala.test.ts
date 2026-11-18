import assert from "node:assert/strict";
import { test } from "node:test";
import { TALA_G1, TALA_G2, TALA_G3, TALA_G4, TALA_G5, TALA_G6 } from "./instruments.ts";
import { completedTala10, computeTala, computeTalaMovement } from "./tala.ts";
import { summariseTala } from "./tala-summary.ts";

const GRADES = [TALA_G1, TALA_G2, TALA_G3, TALA_G4, TALA_G5, TALA_G6];
const prof = (wcpm: number | null, c: number | null, r = TALA_G4) =>
  computeTala({ wcpm, comprehensionCorrect: c }, r);

// Paper-form rows 1–6 style cases (Grade 4); rows 2 and 4 are the corrected ones.
test("grade 4 paper fixture", () => {
  assert.equal(prof(55, 4).profile, "S-C-");
  assert.equal(prof(55, 4).program, "TALA-SULONG");
  assert.equal(prof(100, 5).program, "TALA-SULONG");
  assert.equal(prof(115, 8).program, "TALA-HUSAY");
  assert.equal(prof(110, 8).profile, "S-C+");
  assert.equal(prof(110, 8).program, "TALA-BILIS");
  assert.equal(prof(120, 6).program, "TALA-UNAWA");
});

test("boundaries for every grade", () => {
  for (const r of GRADES) {
    const b = r.wcpmBenchmark;
    const p = r.comprehension.plusAt;
    assert.equal(prof(b, 0, r).speed, "+");
    assert.equal(prof(b - 1, 0, r).speed, "-");
    assert.equal(prof(0, p, r).comprehension, "+");
    assert.equal(prof(0, p - 1, r).comprehension, "-");
  }
});

test("half-encoded row has null profile but its own sign", () => {
  const r = prof(120, null);
  assert.equal(r.speed, "+");
  assert.equal(r.profile, null);
  assert.equal(r.program, null);
  assert.equal(prof(null, 9).profile, null);
});

test("monthly status branches", () => {
  const m = (a: string | null, b: string | null) => computeTalaMovement(a, b, TALA_G4);
  assert.equal(m("S-C-", null), null);
  assert.equal(m(null, null), null);
  assert.equal(m(null, "S+C+"), "First record");
  assert.equal(m("S-C-", "S-C+"), "Moved up");
  assert.equal(m("S+C-", "S+C-"), "Maintained");
  assert.equal(m("S+C+", "S-C+"), "Moved down");
});

test("TALA 10", () => {
  assert.equal(completedTala10(9, TALA_G4), false);
  assert.equal(completedTala10(10, TALA_G4), true);
  assert.equal(completedTala10(null, TALA_G4), false);
});

test("summary uses assessed denominator", () => {
  const e = (profile: string | null, frequency: number | null) => ({
    profile,
    movement: computeTalaMovement(null, profile, TALA_G4),
    frequency,
  });
  const s = summariseTala(
    [e("S-C-", 10), e("S-C+", 10), e("S+C-", 9), e("S+C+", 10), e(null, null)],
    TALA_G4
  );
  assert.equal(s.enrolled, 5);
  assert.equal(s.assessed, 4);
  assert.equal(s.profiles[0].percent, 0.25);
  assert.equal(s.tala10, 3);
  assert.equal(s.philiriEquivalent.find((c) => c.label === "Instructional")?.count, 2);
  assert.equal(s.movements.find((x) => x.label === "First record")?.count, 4);
});

test("empty class gives null percentages", () => {
  const s = summariseTala([{ profile: null, movement: null, frequency: null }], TALA_G4);
  assert.equal(s.assessed, 0);
  assert.ok(s.profiles.every((p) => p.percent === null));
});
