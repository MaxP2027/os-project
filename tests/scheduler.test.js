const { test } = require('node:test');
const assert = require('node:assert/strict');
const { schedule, snapshotAt, validate } = require('../scheduler.js');
const sample = [
  { id: 'P1', arrivalTime: 0, burstTime: 5 },
  { id: 'P2', arrivalTime: 1, burstTime: 3 },
  { id: 'P3', arrivalTime: 2, burstTime: 1 },
];
const intervals = (result) => result.intervals.map((p) => [p.id, p.start, p.end]);

test('FCFS reference execution and complete metrics', () => {
  const r = schedule(sample, 'fcfs');
  assert.deepEqual(intervals(r), [
    ['P1', 0, 5],
    ['P2', 5, 8],
    ['P3', 8, 9],
  ]);
  assert.deepEqual(
    r.metrics.map((p) => [p.completionTime, p.turnaroundTime, p.waitingTime]),
    [
      [5, 5, 0],
      [8, 7, 4],
      [9, 7, 6],
    ],
  );
  assert.equal(r.averageWaiting, 10 / 3);
  assert.equal(r.averageTurnaround, 19 / 3);
});
test('SJF is non-preemptive and considers arrived jobs only', () => {
  const r = schedule(sample, 'sjf');
  assert.deepEqual(intervals(r), [
    ['P1', 0, 5],
    ['P3', 5, 6],
    ['P2', 6, 9],
  ]);
  assert.equal(r.averageWaiting, 8 / 3);
  assert.equal(r.averageTurnaround, 17 / 3);
});
test('Round Robin reference, including arrivals before boundary requeue', () => {
  const r = schedule(sample, 'rr', 2);
  assert.deepEqual(intervals(r), [
    ['P1', 0, 2],
    ['P2', 2, 4],
    ['P3', 4, 5],
    ['P1', 5, 7],
    ['P2', 7, 8],
    ['P1', 8, 9],
  ]);
  assert.deepEqual(
    r.metrics.map((p) => p.waitingTime),
    [4, 4, 2],
  );
  assert.equal(r.averageWaiting, 10 / 3);
});
test('single job and quantum greater than burst finish without extra slice', () => {
  for (const algorithm of ['fcfs', 'sjf', 'rr'])
    assert.deepEqual(
      intervals(schedule([{ id: 'A', arrivalTime: 0, burstTime: 2 }], algorithm, 10)),
      [['A', 0, 2]],
    );
});
test('initial and intermediate idle periods are explicit', () => {
  const r = schedule(
    [
      { id: 'A', arrivalTime: 3, burstTime: 2 },
      { id: 'B', arrivalTime: 8, burstTime: 1 },
    ],
    'fcfs',
  );
  assert.deepEqual(intervals(r), [
    [null, 0, 3],
    ['A', 3, 5],
    [null, 5, 8],
    ['B', 8, 9],
  ]);
  assert.equal(snapshotAt(r, 2).running, null);
  assert.equal(snapshotAt(r, 3).running, 'A');
  assert.equal(snapshotAt(r, 6).running, null);
});
test('ties preserve input order with arrival as SJF secondary priority', () => {
  const jobs = [
    { id: 'A', arrivalTime: 0, burstTime: 4 },
    { id: 'B', arrivalTime: 2, burstTime: 1 },
    { id: 'C', arrivalTime: 1, burstTime: 1 },
    { id: 'D', arrivalTime: 1, burstTime: 1 },
  ];
  assert.deepEqual(
    schedule(jobs, 'sjf').intervals.map((p) => p.id),
    ['A', 'C', 'D', 'B'],
  );
  const equal = jobs.map((p) => ({ ...p, arrivalTime: 0, burstTime: 1 }));
  for (const method of ['fcfs', 'sjf', 'rr'])
    assert.deepEqual(
      schedule(equal, method, 1).intervals.map((p) => p.id),
      ['A', 'B', 'C', 'D'],
    );
});
test('snapshots include intermediate arrivals, remaining work, and final completion', () => {
  const r = schedule(sample, 'fcfs');
  assert.deepEqual(
    snapshotAt(r, 2).ready.map((p) => p.id),
    ['P2', 'P3'],
  );
  assert.equal(snapshotAt(r, 3).remaining, 2);
  assert.equal(snapshotAt(r, 5).running, 'P2');
  assert.deepEqual(snapshotAt(r, 5).completed, ['P1']);
  assert.equal(snapshotAt(r, 100).running, null);
  assert.deepEqual(snapshotAt(r, 100).completed, ['P1', 'P2', 'P3']);
});
test('exact quantum completion never requeues a completed job', () => {
  const r = schedule(
    [
      { id: 'A', arrivalTime: 0, burstTime: 2 },
      { id: 'B', arrivalTime: 2, burstTime: 2 },
    ],
    'rr',
    2,
  );
  assert.deepEqual(intervals(r), [
    ['A', 0, 2],
    ['B', 2, 4],
  ]);
  assert.deepEqual(snapshotAt(r, 2).ready, []);
  assert.deepEqual(snapshotAt(r, 2).completed, ['A']);
});
test('invalid and oversized configurations fail before simulation', () => {
  for (const value of [-1, 0.5, NaN, Infinity, 10001])
    assert.ok(validate([{ id: 'A', arrivalTime: value, burstTime: 1 }], 'fcfs').length);
  for (const value of [-1, 0, 0.5, NaN, Infinity, 10001])
    assert.ok(validate([{ id: 'A', arrivalTime: 0, burstTime: value }], 'fcfs').length);
  assert.throws(() => schedule(sample, 'rr', 0));
  assert.throws(() => schedule([], 'fcfs'));
  assert.throws(() => schedule([...sample, sample[0]], 'fcfs'));
  assert.throws(() => schedule(sample, 'unknown'));
  assert.throws(() =>
    schedule(
      Array.from({ length: 31 }, (_, i) => ({ id: String(i), arrivalTime: 0, burstTime: 1 })),
      'fcfs',
    ),
  );
  assert.throws(() =>
    schedule(
      sample.map((p) => ({ ...p, burstTime: 5000 })),
      'rr',
      1,
    ),
  );
});
test('scheduler does not mutate input and sparse arrivals do not allocate per tick', () => {
  const input = sample.map((p) => Object.freeze({ ...p }));
  schedule(Object.freeze(input), 'rr', 2);
  const r = schedule([{ id: 'A', arrivalTime: 10000, burstTime: 1 }], 'fcfs');
  assert.equal(r.snapshots.length, 3);
  assert.equal(r.totalTime, 10001);
});
test('all methods conserve CPU work and produce consistent snapshots over varied jobs', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const jobs = Array.from({ length: 5 }, (_, i) => ({
      id: `J${i}`,
      arrivalTime: (seed * (i + 3)) % 9,
      burstTime: ((seed + i * 3) % 7) + 1,
    }));
    for (const method of ['fcfs', 'sjf', 'rr']) {
      const r = schedule(jobs, method, (seed % 4) + 1);
      for (const job of jobs) {
        assert.equal(
          r.intervals.filter((x) => x.id === job.id).reduce((sum, x) => sum + x.end - x.start, 0),
          job.burstTime,
        );
        const metric = r.metrics.find((m) => m.id === job.id);
        assert.ok(metric.waitingTime >= 0);
        assert.equal(metric.turnaroundTime, metric.waitingTime + job.burstTime);
      }
      for (let t = 0; t <= r.totalTime; t++) {
        const s = snapshotAt(r, t);
        const interval = r.intervals.find((x) => x.start <= t && t < x.end);
        assert.equal(s.running, interval?.id ?? null);
        assert.equal(
          new Set([...s.completed, ...s.ready.map((p) => p.id), ...(s.running ? [s.running] : [])])
            .size,
          jobs.filter((p) => p.arrivalTime <= t).length,
        );
      }
    }
  }
});
