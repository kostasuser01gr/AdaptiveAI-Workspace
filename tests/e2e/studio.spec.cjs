'use strict';
const {test,expect}=require('@playwright/test');

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('adaptiveai_toured','1');
    localStorage.setItem('adaptiveai_tour_v5','done');
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
});

test('preserves original command shell while Agent Studio opens inside existing tabs',async({page})=>{
  await expect(page.locator('#prompt')).toBeVisible();
  await expect(page.locator('#tabs')).toBeVisible();
  const originalTitle=await page.title();
  expect(originalTitle).toContain('AdaptiveAI');
  await page.locator('#navStudio').click();
  await expect(page.locator('#adaptive-agent-studio')).toBeVisible();
  await expect(page.locator('#adaptive-agent-studio h1')).toHaveText('Agent Studio');
  await expect(page.locator('#tabs .gx-tab.active .tt')).toContainText('Agent Studio');
  await expect(page.locator('#navAutomations')).toBeAttached();
});
test('workflow graph validates and approval gate blocks progress',async({page})=>{
  await page.locator('#navStudio').click();
  await page.getByRole('tab',{name:'Workflow Graph'}).click();
  await expect(page.locator('.as-flow-node')).toHaveCount(3);
  await page.getByRole('button',{name:'▶ Run local preview'}).click();
  await expect(page.getByRole('button',{name:'Approve gate'})).toBeVisible();
  await page.getByRole('button',{name:'Approve gate'}).click();
  await expect(page.getByText('COMPLETED',{exact:true})).toBeVisible();
});
test('adding a workflow step modifies the actual DAG, not a toast-only action',async({page})=>{
  await page.locator('#navStudio').click();
  await page.getByRole('tab',{name:'Workflow Graph'}).click();
  await page.getByPlaceholder('e.g. Review maintenance exceptions').fill('Inspect tyre evidence');
  await page.getByRole('button',{name:'Add step'}).click();
  await expect(page.locator('.as-flow-node')).toHaveCount(4);
  await expect(page.getByText('Inspect tyre evidence').first()).toBeVisible();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#navStudio').click();
  await page.getByRole('tab',{name:'Workflow Graph'}).click();
  await expect(page.locator('.as-flow-node')).toHaveCount(4);
});
test('malicious server text is rendered as inert text nodes, never markup',async({page})=>{
  await page.locator('#navStudio').click();
  const report=await page.evaluate(()=>{
    const holder=document.createElement('div');holder.id='security-probe';
    document.body.appendChild(holder);
    const input='<img src=x onerror=alert(1)>';
    window.AdaptiveSafeUI.render(holder,{
      title:input,tag:'AI DRAFT',widgets:[{type:'insight',title:'Report',body:input}]
    },'');
    return {injected:holder.querySelectorAll('img,script').length,text:holder.textContent.includes(input)};
  });
  expect(report.injected).toBe(0);
  expect(report.text).toBe(true);
});
test('cloud console states its current configuration rather than inventing a connection',async({page})=>{
  await page.locator('#navStudio').click();
  await page.getByRole('tab',{name:'Cloud Sync'}).click();
  await expect(page.getByRole('heading',{name:'Cloud Workspace'})).toBeVisible();
  await expect(page.getByText('Cloud authentication unavailable')).toBeVisible();
});
test('mobile keyboard shortcut opens the responsive Studio',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('Control+Shift+G');
  await expect(page.locator('#adaptive-agent-studio')).toBeVisible();
  await expect(page.locator('.as-subtabs')).toBeVisible();
});
