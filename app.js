/* DOM rendering and playback are separate from scheduling calculations. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const palette = ['#30c9c0', '#dfa574', '#b6a0d4', '#a8c781', '#e1b964', '#dc9392'];
  const descriptions = {
    fcfs: [
      'FIRST COME FIRST SERVE',
      'First in, first out. Each process runs to completion in the order it arrives.',
    ],
    sjf: [
      'SHORTEST JOB FIRST',
      'The shortest available burst goes next. Running processes are never interrupted.',
    ],
    rr: [
      'ROUND ROBIN',
      'A little time for everyone. Each process gets a turn, then rejoins the queue if needed.',
    ],
  };
  let processes = [],
    nextId = 1,
    algorithm = 'fcfs',
    result = null,
    time = 0,
    phase = 'ready',
    timer = null;
  let timelineBlocks = [],
    queueSignature = '',
    completedSignature = '',
    lastRunning = null;
  let previousSnapshot = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function announce(message) {
    $('announcements').textContent = message;
  }
  function color(id) {
    return processes.find((p) => p.id === id)?.color || palette[0];
  }
  function number(value) {
    return value.trim() === '' ? NaN : Number(value);
  }
  function config() {
    return processes.map((p) => ({
      id: p.id,
      arrivalTime: number(p.arrival),
      burstTime: number(p.burst),
    }));
  }
  function example() {
    processes = [
      { id: 'P1', arrival: '0', burst: '5', color: palette[0] },
      { id: 'P2', arrival: '1', burst: '3', color: palette[1] },
      { id: 'P3', arrival: '2', burst: '1', color: palette[2] },
    ];
    nextId = 4;
    renderRows();
    render();
  }
  function renderRows() {
    $('process-rows').replaceChildren();
    for (const process of processes) {
      const row = element('div', 'process-row');
      row.dataset.process = process.id;
      const label = element('span', 'process-label');
      const dot = element('span', 'process-dot');
      dot.style.setProperty('--process-color', process.color);
      label.append(dot, document.createTextNode(process.id));
      row.append(label);
      for (const [field, name, min] of [
        ['arrival', 'Arrival time', 0],
        ['burst', 'Burst time', 1],
      ]) {
        const input = element('input');
        input.type = 'number';
        input.min = min;
        input.max = Scheduler.MAX_TIME;
        input.step = 1;
        input.inputMode = 'numeric';
        input.value = process[field];
        input.setAttribute('aria-label', `${process.id} ${name.toLowerCase()}`);
        input.setAttribute('aria-describedby', `${process.id}-error`);
        input.addEventListener('input', () => {
          process[field] = input.value;
          clearErrors();
          render();
        });
        row.append(input);
      }
      const remove = element('button', 'remove-process', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${process.id}`);
      remove.disabled = processes.length === 1;
      remove.addEventListener('click', () => {
        const index = processes.indexOf(process);
        processes = processes.filter((p) => p !== process);
        clearErrors();
        renderRows();
        render();
        const rows = $('process-rows').querySelectorAll('.process-row');
        rows[Math.min(index, rows.length - 1)]?.querySelector('input').focus();
        announce(`${process.id} removed.`);
      });
      row.append(remove);
      const error = element('span', 'row-error');
      error.id = `${process.id}-error`;
      row.append(error);
      $('process-rows').append(row);
    }
    $('process-count').textContent = processes.length;
    $('add-process').disabled = processes.length >= Scheduler.MAX_PROCESSES;
  }
  function clearErrors() {
    $('validation-message').textContent = '';
    $('quantum-error').textContent = '';
    document
      .querySelectorAll('[aria-invalid]')
      .forEach((input) => input.removeAttribute('aria-invalid'));
    document.querySelectorAll('.row-error').forEach((node) => {
      node.textContent = '';
    });
  }
  function validate() {
    clearErrors();
    const jobs = config();
    const errors = Scheduler.validate(jobs, algorithm, number($('quantum').value));
    for (const job of jobs) {
      const row = [...$('process-rows').children].find((r) => r.dataset.process === job.id);
      const inputs = row.querySelectorAll('input');
      const fields = [
        [job.arrivalTime, 0, inputs[0], 'Arrival'],
        [job.burstTime, 1, inputs[1], 'Burst'],
      ];
      const messages = [];
      for (const [value, min, input, name] of fields) {
        if (!Number.isInteger(value) || value < min || value > Scheduler.MAX_TIME) {
          input.setAttribute('aria-invalid', 'true');
          messages.push(`${name}: ${min}–${Scheduler.MAX_TIME}, whole numbers only.`);
        }
      }
      $(`${job.id}-error`).textContent = messages.join(' ');
    }
    const quantum = number($('quantum').value);
    if (
      algorithm === 'rr' &&
      (!Number.isInteger(quantum) || quantum < 1 || quantum > Scheduler.MAX_TIME)
    ) {
      $('quantum').setAttribute('aria-invalid', 'true');
      $('quantum-error').textContent = `Use a whole number from 1 to ${Scheduler.MAX_TIME}.`;
    }
    if (errors.length) {
      $('validation-message').textContent = errors.some((e) => e.startsWith('Total'))
        ? errors[errors.length - 1]
        : 'Check the highlighted fields before starting.';
      document.querySelector('[aria-invalid=true]')?.focus();
      return false;
    }
    return true;
  }
  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }
  function clearTimeline() {
    timelineBlocks = [];
    $('timeline').replaceChildren();
  }
  function clearTransfers() {
    document.querySelectorAll('.transfer-chip').forEach((node) => {
      node.getAnimations().forEach((animation) => animation.cancel());
      node.remove();
    });
    previousSnapshot = null;
  }
  function transfer(id, fromSelector, toSelector) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const stage = document.querySelector('.cpu-stage');
    const bounds = stage.getBoundingClientRect();
    const from = document.querySelector(fromSelector).getBoundingClientRect();
    const to = document.querySelector(toSelector).getBoundingClientRect();
    const chip = element('span', 'transfer-chip', id);
    chip.setAttribute('aria-hidden', 'true');
    chip.style.setProperty('--process-color', color(id));
    chip.style.left = `${from.left + from.width / 2 - bounds.left - 22}px`;
    chip.style.top = `${from.top + from.height / 2 - bounds.top - 15}px`;
    stage.append(chip);
    const animation = chip.animate(
      [
        { transform: 'translate(0, 0) scale(.85)' },
        {
          transform: `translate(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top + to.height / 2 - from.top - from.height / 2}px) scale(1)`,
        },
      ],
      { duration: Math.min(500, 750 / Number($('speed').value)), easing: 'ease-in-out' },
    );
    animation.onfinish = () => chip.remove();
  }
  function initialize() {
    if (!validate()) return false;
    result = Scheduler.schedule(config(), algorithm, number($('quantum').value));
    time = 0;
    queueSignature = '';
    completedSignature = '';
    lastRunning = null;
    clearTimeline();
    clearTransfers();
    $('configuration-fields').disabled = true;
    $('lock-message').hidden = false;
    return true;
  }
  function startTimer() {
    stopTimer();
    timer = setInterval(advance, 1000 / Number($('speed').value));
  }
  function advance() {
    if (!result) return;
    time = Math.min(result.totalTime, time + 1);
    if (time === result.totalTime) {
      phase = 'complete';
      stopTimer();
      announce(
        `Simulation complete. Average waiting time ${result.averageWaiting.toFixed(2)}. Average turnaround time ${result.averageTurnaround.toFixed(2)}.`,
      );
    }
    render();
  }
  function reset() {
    stopTimer();
    result = null;
    time = 0;
    phase = 'ready';
    queueSignature = '';
    completedSignature = '';
    lastRunning = null;
    clearTimeline();
    clearTransfers();
    clearErrors();
    $('configuration-fields').disabled = false;
    $('lock-message').hidden = true;
    render();
    announce('Simulation reset. Your process inputs are ready to edit.');
  }
  function renderChips(container, items, completed) {
    container.replaceChildren();
    for (const item of items) {
      const chip = element('div', `process-chip${completed ? ' completed' : ''}`);
      chip.style.setProperty('--process-color', color(item.id));
      chip.append(
        element('span', '', item.id),
        element('small', '', completed ? '✓ done' : `${item.remaining} tu`),
      );
      container.append(chip);
    }
  }
  function renderTimeline() {
    if (!result || time === 0) {
      if (!$('timeline').firstChild) {
        const placeholder = element('div', 'timeline-placeholder');
        placeholder.append(
          element('span'),
          element('span'),
          element('span'),
          element(
            'p',
            '',
            result
              ? 'Clock starts at zero. Advance time to trace the first execution.'
              : 'Every block is a moment on the CPU. Start a simulation to build your timeline.',
          ),
        );
        $('timeline').append(placeholder);
      }
      $('timeline-status').textContent = result ? 'Ready at time zero' : 'Waiting for execution';
      $('timeline-duration').textContent = 'TIME UNITS';
      return;
    }
    let track = $('timeline').querySelector('.gantt-track');
    if (!track) {
      track = element('div', 'gantt-track');
      $('timeline').replaceChildren(track);
    }
    const scale = Math.max(5, Math.min(72, ($('timeline').clientWidth - 5) / result.totalTime));
    let i = timelineBlocks.length;
    while (i < result.intervals.length && result.intervals[i].start < time) {
      const interval = result.intervals[i];
      if (i) timelineBlocks[i - 1].querySelector('.gantt-end')?.remove();
      const block = element(
        'div',
        `gantt-block${interval.id ? '' : ' idle'}`,
        interval.id || 'Idle',
      );
      if (interval.id) block.style.setProperty('--process-color', color(interval.id));
      block.append(
        element('span', 'gantt-time', interval.start),
        element('span', 'gantt-time gantt-end'),
      );
      track.append(block);
      timelineBlocks.push(block);
      i++;
    }
    timelineBlocks.forEach((block, index) => {
      const interval = result.intervals[index];
      const end = Math.min(interval.end, time);
      block.style.width = `${Math.max(44, (end - interval.start) * scale)}px`;
      block.setAttribute('aria-label', `${interval.id || 'Idle'}: ${interval.start} to ${end}`);
      block.title = `${interval.id || 'Idle'} · ${interval.start}–${end} time units`;
      const label = block.querySelector('.gantt-end');
      if (label) label.textContent = end;
    });
    $('timeline-status').textContent =
      phase === 'complete'
        ? 'Execution complete'
        : phase === 'paused'
          ? 'Playback paused'
          : 'Tracing execution';
    $('timeline-duration').textContent = `${time} / ${result.totalTime} TIME UNITS`;
  }
  function renderResults(snapshot) {
    const jobs = config();
    const completeIds = snapshot?.completed || [];
    $('results-body').replaceChildren();
    jobs.forEach((p) => {
      const done = completeIds.includes(p.id);
      const running = snapshot?.running === p.id;
      const metric = done ? result.metrics.find((m) => m.id === p.id) : null;
      const tr = element('tr');
      const processCell = element('td');
      const label = element('span', 'table-process');
      const dot = element('span', 'process-dot');
      dot.style.setProperty('--process-color', color(p.id));
      label.append(dot, document.createTextNode(p.id));
      processCell.append(label);
      tr.append(processCell);
      [
        Number.isFinite(p.arrivalTime) ? p.arrivalTime : '—',
        Number.isFinite(p.burstTime) ? p.burstTime : '—',
        metric?.completionTime ?? '—',
        metric?.turnaroundTime ?? '—',
        metric?.waitingTime ?? '—',
      ].forEach((value) => tr.append(element('td', '', value)));
      const statusCell = element('td');
      const status = done
        ? 'Completed'
        : running
          ? 'Running'
          : !result
            ? 'Not started'
            : p.arrivalTime > time
              ? 'Not arrived'
              : 'Waiting';
      statusCell.append(
        element('span', `table-status ${done ? 'done' : running ? 'running' : ''}`, status),
      );
      tr.append(statusCell);
      $('results-body').append(tr);
    });
    $('avg-waiting').textContent = phase === 'complete' ? result.averageWaiting.toFixed(2) : '—';
    $('avg-turnaround').textContent =
      phase === 'complete' ? result.averageTurnaround.toFixed(2) : '—';
    const total = $('completion-total');
    total.replaceChildren(
      document.createTextNode(`${completeIds.length} `),
      element('small', '', `/ ${jobs.length}`),
    );
    const percent = Math.round((100 * completeIds.length) / jobs.length);
    $('completion-percent').textContent = `${percent}% finished`;
    $('completion-fill').style.width = `${percent}%`;
  }
  function render() {
    const snapshot = result ? Scheduler.snapshotAt(result, time) : null;
    if (snapshot && (!previousSnapshot || snapshot.time !== previousSnapshot.time)) {
      for (const id of snapshot.completed) {
        if (!previousSnapshot?.completed.includes(id)) transfer(id, '.cpu', '.completed-area');
      }
      if (
        previousSnapshot?.running &&
        previousSnapshot.running !== snapshot.running &&
        !snapshot.completed.includes(previousSnapshot.running)
      ) {
        transfer(previousSnapshot.running, '.cpu', '.queue-area');
      }
      if (snapshot.running && snapshot.running !== previousSnapshot?.running)
        transfer(snapshot.running, '.queue-area', '.cpu');
      previousSnapshot = snapshot;
    }
    const ready = snapshot?.ready || [];
    const completed = (snapshot?.completed || []).map((id) => ({ id }));
    const queueKey = JSON.stringify(ready),
      doneKey = JSON.stringify(completed);
    if (queueKey !== queueSignature) {
      renderChips($('ready-queue'), ready, false);
      queueSignature = queueKey;
    }
    if (doneKey !== completedSignature) {
      renderChips($('completed-processes'), completed, true);
      completedSignature = doneKey;
    }
    $('queue-empty').hidden = ready.length > 0;
    $('completed-empty').hidden = completed.length > 0;
    $('queue-count').textContent = ready.length;
    $('completed-count').textContent = completed.length;
    $('clock').textContent = String(time).padStart(2, '0');
    const running = snapshot?.running;
    $('cpu').classList.toggle('active', Boolean(running));
    $('cpu-process').textContent =
      running || (phase === 'complete' ? 'Done' : result ? 'Idle' : 'CPU');
    $('cpu-detail').textContent = running
      ? `${snapshot.remaining} time unit${snapshot.remaining === 1 ? '' : 's'} remaining`
      : phase === 'complete'
        ? 'Every process, complete.'
        : result
          ? 'Waiting for the next arrival'
          : 'Awaiting your first run';
    const burst = processes.find((p) => p.id === running)?.burst;
    $('cpu-progress-fill').style.width = running
      ? `${100 * (1 - snapshot.remaining / Number(burst))}%`
      : phase === 'complete'
        ? '100%'
        : '0%';
    const cpuState = running
      ? phase === 'paused'
        ? 'PLAYBACK PAUSED'
        : 'EXECUTING'
      : phase === 'complete'
        ? 'ALL CLEAR'
        : result
          ? 'CPU IDLE'
          : 'STANDING BY';
    $('cpu-state').replaceChildren(
      element('span', 'status-dot'),
      document.createTextNode(` ${cpuState}`),
    );
    if (running !== lastRunning && result && phase !== 'complete') {
      announce(
        running ? `${running} dispatched to the CPU at time ${time}.` : `CPU idle at time ${time}.`,
      );
      lastRunning = running;
    }
    const states = {
      ready: 'Ready to run',
      running: 'Running',
      paused: 'Paused',
      complete: 'Complete',
    };
    $('run-status').replaceChildren(
      element('span', 'status-dot'),
      document.createTextNode(states[phase]),
    );
    $('run-status').dataset.state = phase;
    const startLabels = {
      ready: 'Start simulation',
      running: 'Pause',
      paused: 'Resume',
      complete: 'Run again',
    };
    const playbackIcon = element('span', '', phase === 'running' ? 'Ⅱ' : '▶');
    playbackIcon.setAttribute('aria-hidden', 'true');
    $('start').replaceChildren(playbackIcon, document.createTextNode(` ${startLabels[phase]}`));
    $('step').disabled = phase === 'complete';
    const validBurst = config().reduce(
      (sum, p) => sum + (Number.isFinite(p.burstTime) ? p.burstTime : 0),
      0,
    );
    $('upcoming-label').textContent =
      `${processes.length} process${processes.length === 1 ? '' : 'es'} · ${validBurst} CPU units`;
    $('stage-caption').textContent =
      phase === 'ready'
        ? 'Your processes are ready. Let’s see how they flow.'
        : phase === 'complete'
          ? 'All processes have finished. Explore the results below.'
          : phase === 'paused'
            ? 'Time is on hold. Step through or resume when you’re ready.'
            : running
              ? `${running} is using the CPU. Every other ready process waits its turn.`
              : 'No process is ready yet. The clock keeps moving.';
    renderTimeline();
    renderResults(snapshot);
  }

  document.querySelectorAll('[data-algorithm]').forEach((button) =>
    button.addEventListener('click', () => {
      algorithm = button.dataset.algorithm;
      document
        .querySelectorAll('[data-algorithm]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      $('algorithm-description').textContent = descriptions[algorithm][1];
      $('algorithm-name').textContent = descriptions[algorithm][0];
      $('quantum-field').hidden = algorithm !== 'rr';
      clearErrors();
      render();
    }),
  );
  $('add-process').addEventListener('click', () => {
    if (processes.length >= Scheduler.MAX_PROCESSES) return;
    const id = nextId++;
    processes.push({
      id: `P${id}`,
      arrival: '0',
      burst: '1',
      color: palette[(id - 1) % palette.length],
    });
    clearErrors();
    renderRows();
    render();
    $('process-rows').lastElementChild.querySelector('input').focus();
    announce(`P${id} added.`);
  });
  $('load-example').addEventListener('click', () => {
    clearErrors();
    example();
    announce('Example processes loaded.');
  });
  $('quantum').addEventListener('input', clearErrors);
  $('start').addEventListener('click', () => {
    if (phase === 'running') {
      stopTimer();
      phase = 'paused';
      announce(`Paused at time ${time}.`);
    } else {
      if ((phase === 'ready' || phase === 'complete') && !initialize()) return;
      phase = 'running';
      startTimer();
      announce(`Simulation running at time ${time}.`);
    }
    render();
  });
  $('step').addEventListener('click', () => {
    if (phase === 'ready' && !initialize()) return;
    stopTimer();
    phase = 'paused';
    advance();
    if (phase !== 'complete')
      announce(`Stepped to time ${time}. ${$('cpu-process').textContent} on CPU.`);
  });
  $('reset').addEventListener('click', reset);
  $('speed').addEventListener('change', () => {
    if (phase === 'running') startTimer();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'running') {
      stopTimer();
      phase = 'paused';
      render();
      announce('Playback paused while this tab is hidden.');
    }
  });
  window.addEventListener('pagehide', stopTimer);
  $('algorithm-description').textContent = descriptions.fcfs[1];
  example();
})();
