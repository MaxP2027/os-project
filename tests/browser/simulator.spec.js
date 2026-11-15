const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});
async function finishByStepping(page, count = 9) {
  for (let i = 0; i < count; i++)
    await page.getByRole('button', { name: 'Step forward one time unit' }).click();
}
test('loads at a GitHub Pages subpath without errors or horizontal overflow', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Scheduling, made visible.' })).toBeVisible();
  await expect(page.locator('.process-row')).toHaveCount(3);
  await expect(page.locator('#clock')).toHaveText('00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-ready.png`, fullPage: true });
});
for (const [method, wait, turnaround, order] of [
  ['FCFS', '3.33', '6.33', ['P1', 'P2', 'P3']],
  ['SJF', '2.67', '5.67', ['P1', 'P3', 'P2']],
  ['Round Robin', '3.33', '6.33', ['P1', 'P2', 'P3', 'P1', 'P2', 'P1']],
]) {
  test(`${method} renders the reference order and final metrics`, async ({ page }) => {
    await page.getByRole('button', { name: method, exact: true }).click();
    await finishByStepping(page);
    await expect(page.locator('#run-status')).toHaveText('Complete');
    await expect(page.locator('#avg-waiting')).toHaveText(wait);
    await expect(page.locator('#avg-turnaround')).toHaveText(turnaround);
    await expect(page.locator('#completion-percent')).toHaveText('100% finished');
    await expect(page.getByRole('button', { name: 'Step forward one time unit' })).toBeDisabled();
    expect(
      await page
        .locator('.gantt-block')
        .evaluateAll((nodes) => nodes.map((n) => n.firstChild.textContent)),
    ).toEqual(order);
    await expect(page.locator('#results-body .done')).toHaveCount(3);
  });
}
test('playback pauses, resumes, changes speed, steps, and resets cleanly', async ({ page }) => {
  await page.clock.install();
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.getByRole('button', { name: 'FCFS', exact: true })).toBeDisabled();
  await page.clock.runFor(1000);
  await expect(page.locator('#clock')).toHaveText('01');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.runFor(3000);
  await expect(page.locator('#clock')).toHaveText('01');
  await page.getByRole('combobox', { name: 'SPEED', exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(500);
  await expect(page.locator('#clock')).toHaveText('03');
  await page.getByRole('button', { name: 'Step forward one time unit' }).click();
  await expect(page.locator('#clock')).toHaveText('04');
  await page.clock.runFor(2000);
  await expect(page.locator('#clock')).toHaveText('04');
  await page.getByRole('button', { name: 'Reset simulation' }).click();
  await expect(page.locator('#clock')).toHaveText('00');
  await expect(page.getByLabel('P1 burst time')).toHaveValue('5');
  await expect(page.getByRole('button', { name: 'FCFS', exact: true })).toBeEnabled();
  await page.clock.runFor(2000);
  await expect(page.locator('#clock')).toHaveText('00');
});
test('process editor adds, removes, preserves IDs, and loads example', async ({ page }) => {
  await page.getByRole('button', { name: 'Add process' }).click();
  await expect(page.getByLabel('P4 arrival time')).toBeFocused();
  await page.getByRole('button', { name: 'Remove P2' }).click();
  await expect(page.getByLabel('P3 burst time')).toHaveValue('1');
  await page.getByRole('button', { name: 'Add process' }).click();
  await expect(page.getByLabel('P5 arrival time')).toBeVisible();
  await page.getByRole('button', { name: 'Load example' }).click();
  await expect(page.locator('.process-row')).toHaveCount(3);
  await expect(page.getByLabel('P2 burst time')).toHaveValue('3');
});
test('validation blocks missing, fractional, and invalid burst/quantum values', async ({
  page,
}) => {
  await page.getByLabel('P1 burst time').fill('');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.getByLabel('P1 burst time')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#clock')).toHaveText('00');
  await page.getByLabel('P1 burst time').fill('0.5');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.getByLabel('P1 burst time')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('P1 burst time').fill('5');
  await page.getByRole('button', { name: 'Round Robin', exact: true }).click();
  await page.getByLabel('Time quantum').fill('0');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.getByLabel('Time quantum')).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'FCFS', exact: true }).click();
  await page.getByRole('button', { name: 'Step forward one time unit' }).click();
  await expect(page.locator('#clock')).toHaveText('01');
});
test('idle gaps, pending arrivals, and final completion render correctly', async ({ page }) => {
  await page.getByRole('button', { name: 'Remove P3' }).click();
  await page.getByLabel('P1 arrival time').fill('2');
  await page.getByLabel('P1 burst time').fill('1');
  await page.getByLabel('P2 arrival time').fill('5');
  await page.getByLabel('P2 burst time').fill('1');
  await finishByStepping(page, 1);
  await expect(page.locator('#cpu-process')).toHaveText('Idle');
  await expect(page.locator('#results-body')).toContainText('Not arrived');
  await finishByStepping(page, 5);
  await expect(page.locator('.gantt-block.idle')).toHaveCount(2);
  await expect(page.locator('#avg-waiting')).toHaveText('0.00');
  await expect(page.locator('#avg-turnaround')).toHaveText('1.00');
});
test('run again starts at zero without old timeline blocks', async ({ page }) => {
  await finishByStepping(page);
  await page.getByRole('button', { name: 'Run again' }).click();
  await expect(page.locator('#clock')).toHaveText('00');
  await expect(page.locator('.gantt-block')).toHaveCount(0);
  await expect(page.locator('#completed-count')).toHaveText('0');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
});
test('reduced motion and keyboard operation remain functional', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'SJF', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'SJF', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Step forward one time unit' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#clock')).toHaveText('01');
  const duration = await page
    .locator('#cpu')
    .evaluate((n) => getComputedStyle(n).transitionDuration);
  expect(duration).toBe('0s');
});
test('initial and paused Round Robin screens pass automated accessibility checks', async ({
  page,
}) => {
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Round Robin', exact: true }).click();
  await finishByStepping(page, 3);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
