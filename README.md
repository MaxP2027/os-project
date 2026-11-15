# CPU Lab · os-project

The interactive CPU scheduling app for **os-project**, built with HTML, CSS, and plain JavaScript. Enter processes, choose an algorithm, and follow their journey from the ready queue through the CPU to completion.

## Use the app

Open `index.html` directly in a browser. No installation, server, account, database, environment variables, API keys, or cloud service is needed.

1. Choose **FCFS**, **SJF**, or **Round Robin**.
2. Add processes and set their arrival and CPU burst times. For Round Robin, set the quantum.
3. Start playback or advance one time unit with **Step**.
4. Pause/resume, change speed, and inspect the growing Gantt timeline.
5. Review completion, waiting, and turnaround times. Reset to edit the configuration.

The default example is P1 `(arrival 0, burst 5)`, P2 `(1, 3)`, and P3 `(2, 1)`.

## Scheduling rules

- **FCFS:** arrival order; a dispatched process finishes before the next starts.
- **SJF:** non-preemptive; choose the smallest burst among arrived processes when the CPU becomes available. Equal bursts use arrival time, then original row order.
- **Round Robin:** FIFO ready queue; run for the quantum or until completion. Arrivals at a slice boundary join before the unfinished process is requeued.
- Equal arrivals preserve original row order. Removing a row does not renumber other processes.
- One CPU, integer time units, no I/O waits, and no context-switch overhead. Idle time is shown explicitly.
- Arrival: 0–10,000. Burst/quantum: 1–10,000. At most 30 processes and 10,000 combined burst units keep simulation costs bounded.
- Configuration is locked during playback and pause. Reset retains inputs and clears execution. Run again repeats the configuration. Hidden tabs automatically pause.
- Metrics appear as each process completes; averages appear after the whole run.

`turnaround = completion − arrival`  
`waiting = turnaround − burst`

| Algorithm        | Example execution                                   | Average waiting | Average turnaround |
| ---------------- | --------------------------------------------------- | --------------- | ------------------ |
| FCFS             | P1 0–5 → P2 5–8 → P3 8–9                            | 3.33            | 6.33               |
| SJF              | P1 0–5 → P3 5–6 → P2 6–9                            | 2.67            | 5.67               |
| Round Robin, q=2 | P1 0–2 → P2 2–4 → P3 4–5 → P1 5–7 → P2 7–8 → P1 8–9 | 3.33            | 6.33               |

## Development and verification

Node.js 22 or newer is required only for development tools. CI uses Node 24 and pnpm 11.25.0.

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile --ignore-scripts
pnpm start
```

Open `http://127.0.0.1:4173`. The local server also supports `/os-project/` to verify GitHub Pages project paths. It binds only to loopback and serves an explicit allowlist of app assets.

```sh
pnpm check
pnpm format:check
pnpm test
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm audit
```

`pnpm format` formats source files. Playwright tests cover desktop and mobile Chromium, all scheduling methods, validation, idle gaps, pause/resume, speed, stepping, reset, repeat runs, keyboard input, reduced motion, and automated accessibility checks. Browser tests generate ready-state screenshots under ignored `artifacts/`. HTML reports are in `playwright-report/`; failures retain screenshots and traces.

For an already running server, set `TEST_BASE_URL` to its full project URL before testing. This skips Playwright's automatic development server. If OneDrive holds dependency files open, run development tools from a copy outside the synced folder. The app itself still opens directly without dependencies.

## GitHub Pages deployment

Target repository: [MaxP2027/os-project](https://github.com/MaxP2027/os-project).

1. Push this project to the repository's `main` branch.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Open **Actions → Verify and deploy CPU Lab**. Run the workflow on `main` if the initial run happened before Pages was enabled.
4. Use the deployment URL reported by the `github-pages` environment after the workflow succeeds.

Expected URL after a successful deployment: `https://maxp2027.github.io/os-project/`. This is a target address, not proof that publication has completed.

The workflow installs locked development dependencies, checks formatting and syntax, runs engine/browser/accessibility tests, and deploys only the five runtime assets. Pull requests run checks without deployment. No personal access token or paid cloud provider is required; deployment uses GitHub's short-lived workflow identity.

This follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

To roll back, revert the offending commit on `main` and push. The same verification gates run before the reverted version is published. Inspect Actions logs and the downloadable Playwright report for failures. No migrations or production secrets are involved.

## Architecture

```text
index.html                    Accessible page structure
styles.css                    Responsive umber/ochre/turquoise design
scheduler.js                  Pure validation, scheduling, and snapshot lookup
app.js                        Forms, application state, rendering, and playback
.nojekyll                     Static delivery marker
package.json / pnpm-lock.yaml  Development scripts and pinned dependencies
playwright.config.js          Desktop/mobile browser projects and local server
tests/scheduler.test.js        Deterministic engine tests and invariants
tests/browser/simulator.spec.js Browser workflows and accessibility checks
tools/serve.js                 Dependency-free local static server
.github/workflows/pages.yml   Verification and GitHub Pages deployment
docs/verification.md          Delivery status and measured evidence
.gitattributes / .gitignore   Line endings and generated-file exclusions
.prettierrc.json               Formatting conventions
.prettierignore                Generated-file formatting exclusions
```

`Scheduler.schedule(processes, algorithm, quantum)` accepts records `{ id, arrivalTime, burstTime }` and the algorithm `fcfs`, `sjf`, or `rr`. It returns execution intervals, event-boundary snapshots, per-process metrics, averages, total time, and total burst time. Invalid inputs throw a descriptive error. Inputs are never mutated.

`Scheduler.snapshotAt(result, time)` uses binary search to return running, ready, and completed state at a clamped time. Scheduling advances between events, so long idle gaps do not allocate one object per time unit. Playback speed changes presentation only; they never change the calculated schedule.

The palette uses dune ochre `#AE6C37`, deep umber `#2B1A12`, turquoise `#30C9C0`, readable light text, and supporting process accents. Process IDs and status text supplement color. Reduced-motion users get immediate state changes. Google Fonts are optional visual enhancement; system fallbacks keep the app usable when fonts cannot load.

No process data leaves the browser or persists after reload. No analytics, cookies, accounts, local storage, or runtime packages are used. Optional Google Fonts requests are the only external app resource requests.
