# CPU Lab · os-project

The interactive CPU scheduling app for **os-project**, built with HTML, CSS, and plain JavaScript. Enter processes, choose an algorithm, and follow their journey from the ready queue through the CPU to completion.

## Use the app

Open `index.html` directly in a browser. No installation, server, account, database, environment variables, API keys, or cloud service is needed.

1. Choose **FCFS**, **SJF**, or **Round Robin**.
2. Add processes and set their arrival and CPU burst times. For Round Robin, set the quantum.
3. Start playback or advance one time unit with **Step**.
4. Pause/resume, change speed, and inspect the growing Gantt timeline.
5. Review completion, waiting, and turnaround times. Reset to edit the configuration.

## Scheduling rules

- **FCFS:** arrival order; a dispatched process finishes before the next starts.
- **SJF:** non-preemptive; choose the smallest burst among arrived processes when the CPU becomes available. Equal bursts use arrival time, then original row order.
- **Round Robin:** FIFO ready queue; run for the quantum or until completion. Arrivals at a slice boundary join before the unfinished process is requeued.

## GitHub Pages deployment

Target repository: [MaxP2027/os-project](https://github.com/MaxP2027/os-project).

1. Push this project to the repository's `main` branch.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Open **Actions → Verify and deploy CPU Lab**. Run the workflow on `main` if the initial run happened before Pages was enabled.
4. Use the deployment URL reported by the `github-pages` environment after the workflow succeeds.

Expected URL after a successful deployment: `https://maxp2027.github.io/os-project/`.

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
