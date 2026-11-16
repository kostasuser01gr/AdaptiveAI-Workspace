'use strict';
const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('adaptiveai_toured','1');
    localStorage.setItem('adaptiveai_tour_v5','done');
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#navWorkspaceOS')).toBeAttached();
});
test('premium Workspace OS mounts inside original shell without breaking other modules',async({page})=>{
  await expect(page.locator('#prompt')).toBeAttached();
  await page.locator('#navWorkspaceOS').click();
  await expect(page.locator('#adaptive-workspace-os')).toBeVisible();
  await expect(page.locator('#adaptive-workspace-os h2')).toHaveText('One space. Every capability.');
  await expect(page.locator('#tabs .gx-tab.active .tt')).toHaveText('◈ Workspace OS');
  await expect(page.locator('#navStudio')).toBeAttached();
  await expect(page.locator('#navDataStudio')).toBeAttached();
  await expect(page.locator('.aw5-card')).toHaveCount(4);
});
test('task command creates persistent task, completion toggles and undo/redo work',async({page})=>{
  await page.locator('#navWorkspaceOS').click();
  await page.locator('#aw5-command').fill('/task Review checklist');
  await page.getByRole('button',{name:'Execute ↗'}).click();
  const task=page.locator('.aw5-card').filter({hasText:'Review checklist'});
  await expect(task).toBeVisible();
  await task.getByRole('checkbox').check();
  await expect(task.getByText('COMPLETED')).toBeVisible();
  await page.locator('#aw5-undo').click();
  await expect(page.locator('.aw5-card').filter({hasText:'Review checklist'}).getByRole('checkbox')).not.toBeChecked();
  await page.locator('#aw5-redo').click();
  await expect(page.locator('.aw5-card').filter({hasText:'Review checklist'}).getByRole('checkbox')).toBeChecked();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#navWorkspaceOS').click();
  await expect(page.locator('.aw5-card').filter({hasText:'Review checklist'}).getByRole('checkbox')).toBeChecked();
});
test('board creation, card editing and activity ledger are real stateful controls',async({page})=>{
  await page.locator('#navWorkspaceOS').click();
  await page.getByRole('button',{name:'+ Create board'}).click();
  await page.getByRole('dialog').getByRole('textbox',{name:'Board name'}).fill('Q4 Delivery');
  await page.getByRole('dialog').getByRole('button',{name:'Create board'}).click();
  await expect(page.locator('.aw5-headline h3')).toHaveText('Q4 Delivery');
  await page.getByRole('button',{name:'Add note'}).click();
  await page.getByRole('dialog').getByRole('textbox',{name:'Title'}).fill('Runbook');
  await page.getByRole('dialog').getByRole('textbox',{name:'Description / notes'}).fill('Reviewed source. No cloud claims.');
  await page.getByRole('dialog').getByRole('button',{name:'Add card'}).click();
  await expect(page.locator('.aw5-card')).toContainText('Runbook');
  await page.getByRole('tab',{name:'Activity'}).click();
  await expect(page.locator('.aw5-list')).toContainText('Created note: Runbook');
  await expect(page.locator('.aw5-list')).toContainText('Created board Q4 Delivery');
});
test('shortcut launches actual Data Intelligence module rather than a toast',async({page})=>{
  await page.locator('#navWorkspaceOS').click();
  const shortcut=page.locator('.aw5-card').filter({hasText:'Data Intelligence'});
  await shortcut.getByRole('button',{name:'Open ↗'}).click();
  await expect(page.locator('#adaptive-data-studio')).toBeVisible();
  await expect(page.locator('#tabs .gx-tab.active')).toContainText('Data Intelligence');
});
test('note markup is inert, no HTML execution in Workspace OS',async({page})=>{
  await page.locator('#navWorkspaceOS').click();
  await page.locator('#aw5-command').fill('/note <img src=x onerror=alert(1)>');
  await page.getByRole('button',{name:'Execute ↗'}).click();
  await expect(page.locator('.aw5-card')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#adaptive-workspace-os img')).toHaveCount(0);
});
test('responsive phone view uses keyboard shortcut and card grid fits width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('Control+Shift+O');
  await expect(page.locator('#adaptive-workspace-os')).toBeVisible();
  await expect(page.locator('.aw5-board-list').first()).toBeVisible();
  await expect(page.locator('.aw5-card')).toHaveCount(4);
  const geometry=await page.locator('#adaptive-workspace-os').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+2);
});
test('explicit cloud capability semantics without inventing connectivity',async({page})=>{
  await page.locator('#navWorkspaceOS').click();
  await page.getByRole('tab',{name:'Modules'}).click();
  await expect(page.locator('#adaptive-workspace-os')).toContainText('Agent Studio');
  await expect(page.locator('#adaptive-workspace-os')).toContainText('Data Intelligence');
  await expect(page.locator('#adaptive-workspace-os')).toContainText('Cloud');
  await expect(page.locator('#adaptive-workspace-os')).not.toContainText('All agents running');
});
