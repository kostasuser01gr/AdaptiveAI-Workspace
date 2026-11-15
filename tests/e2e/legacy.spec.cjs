'use strict';
const {test,expect}=require('@playwright/test');

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('adaptiveai_toured','1');
    localStorage.setItem('adaptiveai_tour_v5','done');
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
});
test('original command prompt still generates a navigable surface',async({page})=>{
  await page.locator('#prompt').fill('fleet utilisation');
  await page.locator('#sendBtn').click();
  await expect.poll(async()=>page.locator('#tabs .gx-tab').count()).toBeGreaterThan(0);
  await expect(page.locator('#stage .gx-surface:visible').first()).toBeVisible();
});
test('original enterprise Assets navigation remains functional',async({page})=>{
  await page.locator('#navAssets').click();
  await expect(page.locator('#assetBg')).toHaveClass(/open/);
  await page.locator('#assetClose').click();
  await expect(page.locator('#assetBg')).not.toHaveClass(/open/);
});
test('command palette opens and closes via keyboard shortcut',async({page})=>{
  await page.keyboard.press('Control+k');
  await expect(page.locator('#cmdkModal')).toHaveClass(/open/);
  await page.locator('#cmdkInput').fill('fleet');
  await expect(page.locator('#cmdkResults')).not.toBeEmpty();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmdkModal')).not.toHaveClass(/open/);
});
test('role switcher changes visible role and persists preference',async({page})=>{
  await page.locator('#roleBtn').click();
  await page.locator('#roleMenu .role-opt[data-role="manager"]').click();
  await expect(page.locator('#roleName')).toHaveText('Elena Papadaki');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('role'))).toBe('manager');
});
test('simulated telemetry and status are explicitly marked, not misrepresented as live',async({page})=>{
  await expect(page.locator('#sbLatency')).toHaveText('N/A');
  await expect(page.locator('#sbSla')).toHaveText('N/A');
  await expect(page.locator('#kpiBar')).toBeVisible({timeout:15000});
  await expect(page.locator('#kpiBar')).toHaveAttribute('data-source','simulated');
  await expect(page.locator('#wsIndicator')).toContainText('SIMULATED FEED',{timeout:15000});
  await expect(page.locator('#connText')).toContainText('Demo');
});
