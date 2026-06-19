/**
 * P9-07: Golden-path E2E tests — 13 browser tests (requirements A–M)
 *
 * A  Open app
 * B  AgentSystem panel (Multi-Agent button)
 * C  AutonomousWorkflowPanel (Workflow button)
 * D  ChatAgent output (send a message, verify agent reply)
 * E  LegalKB panel
 * F  LegalReview panel
 * G  Phase8DashboardPanel
 * H  AgentTracePanel section inside dashboard
 * I  AgentRegistryPanel section inside dashboard
 * J  AgentFlowPanel section inside dashboard
 * K  AgentLegalCitationPanel section inside dashboard
 * L  AgentErrorPanel section inside dashboard
 * M  ZIP export — verify BiolReport.html entry exists
 */

import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

test.describe('P9-07 · Golden-path E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ─── A: Open app ─────────────────────────────────────────────────────────────

  test('GP-A: app loads and header is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Hệ Thống Tự Động Thiết Lập Hồ Sơ Mua Sắm/ }),
    ).toBeVisible();
  });

  // ─── B: AgentSystem ───────────────────────────────────────────────────────────

  test('GP-B: Multi-Agent button shows agent-provider panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Multi-Agent' }).click();
    await expect(page.locator('[data-panel="agent-provider"]')).toBeVisible();
  });

  // ─── C: AutonomousWorkflow ────────────────────────────────────────────────────

  test('GP-C: Workflow button shows autonomous-workflow panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Workflow' }).click();
    await expect(page.locator('[data-panel="autonomous-workflow"]')).toBeVisible();
  });

  // ─── D: ChatAgent output ──────────────────────────────────────────────────────

  test('GP-D: ChatAgent responds with agent message after user query', async ({ page }) => {
    await page.getByRole('button', { name: 'Chat pháp lý' }).click();
    await expect(page.locator('[data-panel="chat-interface"]')).toBeVisible();
    // pressSequentially fires key events that trigger React's onChange reliably
    await page.locator('[data-field="chat-input"]').click();
    await page.locator('[data-field="chat-input"]').pressSequentially('ngưỡng đấu thầu');
    await page.locator('[data-action="send"]').click();
    // User message renders immediately; agent reply follows (deterministic KB mode)
    await expect(page.locator('[data-role="user"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-role="agent"]')).toBeVisible({ timeout: 10_000 });
  });

  // ─── E: LegalKB ───────────────────────────────────────────────────────────────

  test('GP-E: Legal KB panel visible after button click', async ({ page }) => {
    await page.getByRole('button', { name: 'Tra cứu pháp lý' }).click();
    await expect(page.locator('[data-panel="legal-kb"]')).toBeVisible();
  });

  // ─── F: LegalReview ───────────────────────────────────────────────────────────

  test('GP-F: Legal review panel visible after button click', async ({ page }) => {
    await page.getByRole('button', { name: 'Kiểm tra pháp lý' }).click();
    await expect(page.locator('[data-panel="legal-review"]')).toBeVisible();
  });

  // ─── G: Phase8Dashboard ───────────────────────────────────────────────────────

  test('GP-G: Phase8DashboardPanel renders on click', async ({ page }) => {
    await page.getByRole('button', { name: 'Dashboard Phase 8' }).click();
    await expect(page.locator('[data-panel="phase8-dashboard"]')).toBeVisible();
  });

  // ─── H: AgentTracePanel ───────────────────────────────────────────────────────

  test('GP-H: agent-trace section visible inside Phase8Dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Dashboard Phase 8' }).click();
    await expect(page.locator('[data-section="agent-trace"]')).toBeVisible();
  });

  // ─── I: AgentRegistryPanel ────────────────────────────────────────────────────

  test('GP-I: agent-registry section visible inside Phase8Dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Dashboard Phase 8' }).click();
    await expect(page.locator('[data-section="agent-registry"]')).toBeVisible();
  });

  // ─── J: AgentFlowPanel ────────────────────────────────────────────────────────

  test('GP-J: agent-flow section visible inside Phase8Dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Dashboard Phase 8' }).click();
    await expect(page.locator('[data-section="agent-flow"]')).toBeVisible();
  });

  // ─── K: AgentLegalCitationPanel ───────────────────────────────────────────────

  test('GP-K: agent-legal-citation section visible inside Phase8Dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Dashboard Phase 8' }).click();
    await expect(page.locator('[data-section="agent-legal-citation"]')).toBeVisible();
  });

  // ─── L: AgentErrorPanel ───────────────────────────────────────────────────────

  test('GP-L: agent-error section visible inside Phase8Dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Dashboard Phase 8' }).click();
    await expect(page.locator('[data-section="agent-error"]')).toBeVisible();
  });

  // ─── M: ZIP export — verify BiolReport.html ───────────────────────────────────

  test('GP-M: ZIP export contains BiolReport.html', async ({ page }) => {
    // Auto-accept any confirmation dialogs (warnings about missing dates, etc.)
    page.on('dialog', dialog => dialog.accept());

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /Tải trọn bộ/ }).click();
    const download = await downloadPromise;

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-p907-'));
    const zipPath = path.join(tmpDir, 'export.zip');
    await download.saveAs(zipPath);

    const data = await fs.readFile(zipPath);
    const zip = await JSZip.loadAsync(data);
    expect(Object.keys(zip.files)).toContain('BiolReport.html');

    await fs.rm(tmpDir, { recursive: true });
  });
});
