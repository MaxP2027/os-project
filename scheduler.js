/* Pure, event-driven scheduling engine. Works in the browser and Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Scheduler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_PROCESSES = 30;
  const MAX_TIME = 10000;

  function validate(processes, algorithm, quantum = 2) {
    const errors = [];
    if (!['fcfs', 'sjf', 'rr'].includes(algorithm)) errors.push('Choose a supported algorithm.');
    if (!Array.isArray(processes) || !processes.length || processes.length > MAX_PROCESSES) {
      errors.push(`Enter between 1 and ${MAX_PROCESSES} processes.`);
      return errors;
    }
    const ids = new Set();
    processes.forEach((p, i) => {
      if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id))
        errors.push(`Process ${i + 1} needs a unique ID.`);
      if (p) {
        ids.add(p.id);
        if (!Number.isInteger(p.arrivalTime) || p.arrivalTime < 0 || p.arrivalTime > MAX_TIME)
          errors.push(`${p.id}: arrival must be an integer from 0 to ${MAX_TIME}.`);
        if (!Number.isInteger(p.burstTime) || p.burstTime < 1 || p.burstTime > MAX_TIME)
          errors.push(`${p.id}: burst must be an integer from 1 to ${MAX_TIME}.`);
      }
    });
    if (
      processes.reduce((sum, p) => sum + (Number.isFinite(p?.burstTime) ? p.burstTime : 0), 0) >
      MAX_TIME
    )
      errors.push(`Total CPU burst time must not exceed ${MAX_TIME} units.`);
    if (algorithm === 'rr' && (!Number.isInteger(quantum) || quantum < 1 || quantum > MAX_TIME))
      errors.push(`Quantum must be an integer from 1 to ${MAX_TIME}.`);
    return errors;
  }

  function schedule(processes, algorithm, quantum = 2) {
    const errors = validate(processes, algorithm, quantum);
    if (errors.length) throw new Error(errors.join(' '));
    const jobs = processes.map((p, order) => ({ ...p, order, remaining: p.burstTime }));
    const arrivals = [...jobs].sort((a, b) => a.arrivalTime - b.arrivalTime || a.order - b.order);
    const queue = [],
      completed = [],
      intervals = [],
      snapshots = [];
    let time = 0,
      next = 0;
    function snapshot(at, running = null, started = at) {
      const item = {
        time: at,
        running: running ? running.id : null,
        remaining: running ? running.remaining - (at - started) : 0,
        ready: queue.map((p) => ({ id: p.id, remaining: p.remaining })),
        completed: completed.map((p) => p.id),
      };
      if (snapshots.length && snapshots[snapshots.length - 1].time === at)
        snapshots[snapshots.length - 1] = item;
      else snapshots.push(item);
    }
    function enqueueThrough(at, running = null, started = at) {
      while (next < arrivals.length && arrivals[next].arrivalTime <= at) {
        const arrival = arrivals[next].arrivalTime;
        while (next < arrivals.length && arrivals[next].arrivalTime === arrival)
          queue.push(arrivals[next++]);
        if (running && arrival < at) snapshot(arrival, running, started);
      }
    }
    while (completed.length < jobs.length) {
      enqueueThrough(time);
      if (!queue.length) {
        const end = arrivals[next].arrivalTime;
        intervals.push({ id: null, start: time, end });
        snapshot(time);
        time = end;
        enqueueThrough(time);
      }
      if (algorithm === 'sjf')
        queue.sort(
          (a, b) => a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime || a.order - b.order,
        );
      const job = queue.shift();
      const duration = algorithm === 'rr' ? Math.min(quantum, job.remaining) : job.remaining;
      const end = time + duration;
      intervals.push({ id: job.id, start: time, end });
      snapshot(time, job);
      // Boundary arrivals join before an unfinished process is requeued.
      enqueueThrough(end, job, time);
      job.remaining -= duration;
      time = end;
      if (!job.remaining) {
        job.completionTime = time;
        completed.push(job);
      } else queue.push(job);
    }
    snapshot(time);
    const metrics = jobs.map((p) => ({
      id: p.id,
      arrivalTime: p.arrivalTime,
      burstTime: p.burstTime,
      completionTime: p.completionTime,
      turnaroundTime: p.completionTime - p.arrivalTime,
      waitingTime: p.completionTime - p.arrivalTime - p.burstTime,
    }));
    return {
      algorithm,
      quantum,
      intervals,
      snapshots,
      metrics,
      totalTime: time,
      totalBurst: jobs.reduce((sum, p) => sum + p.burstTime, 0),
      averageWaiting: metrics.reduce((sum, p) => sum + p.waitingTime, 0) / jobs.length,
      averageTurnaround: metrics.reduce((sum, p) => sum + p.turnaroundTime, 0) / jobs.length,
    };
  }

  function snapshotAt(result, time) {
    const at = Math.max(0, Math.min(result.totalTime, time));
    let low = 0,
      high = result.snapshots.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (result.snapshots[mid].time <= at) low = mid;
      else high = mid - 1;
    }
    const base = result.snapshots[low];
    return { ...base, time: at, remaining: base.running ? base.remaining - (at - base.time) : 0 };
  }
  return { schedule, snapshotAt, validate, MAX_PROCESSES, MAX_TIME };
});
