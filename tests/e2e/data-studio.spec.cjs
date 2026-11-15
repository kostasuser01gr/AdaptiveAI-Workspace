'use strict';
const {test,expect}=require('@playwright/test');

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('adaptiveai_toured','1');
    localStorage.setItem('adaptiveai_tour_v5','done');
  });
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#navDataStudio').waitFor();
});
test('Data Studio preserves original command shell and opens inside existing tabs',async({page})=>{
  await page.locator('#navDataStudio').click();
  await expect(page.locator('#adaptive-data-studio')).toBeVisible();
  await expect(page.locator('#prompt')).toBeAttached();
  await expect(page.locator('#tabs .gx-tab.active')).toContainText('Data Intelligence');
  await expect(page.getByText('LOCAL ONLY')).toBeVisible();
});
test('real pasted CSV produces profile, aggregation and filtered records',async({page})=>{
  await page.locator('#navDataStudio').click();
  await page.locator('#adi-name').fill('Station demo sample');
  await page.locator('#adi-paste').fill('Station;Fleet;Revenue\nHeraklion;12;1250,50\nChania;8;850,20\nHeraklion;3;120,00');
  await page.getByRole('button',{name:'Import pasted data'}).click();
  await expect(page.locator('.adi-source-name')).toContainText('Station demo sample');
  await page.getByRole('tab',{name:'Quality Profile'}).click();
  await expect(page.getByText('Data quality profile')).toBeVisible();
  await expect(page.locator('.adi-table')).toContainText('Revenue');
  await page.getByRole('tab',{name:'Analytics Builder'}).click();
  await page.getByRole('button',{name:'Calculate'}).click();
  await expect(page.getByText('3 matching rows')).toBeVisible();
  await expect(page.locator('.adi-chart .adi-bar')).toHaveCount(2);
  await page.getByRole('tab',{name:'Data Explorer'}).click();
  await page.locator('#adi-query').fill('Heraklion');
  await expect(page.locator('.adi-table tbody tr')).toHaveCount(2);
});
test('dataset persists across reload with IndexedDB',async({page})=>{
  await page.locator('#navDataStudio').click();
  await page.locator('#adi-name').fill('Persistent profile');
  await page.locator('#adi-paste').fill('Location,Count\nHeraklion,1\nChania,2');
  await page.getByRole('button',{name:'Import pasted data'}).click();
  await expect(page.locator('.adi-source-name')).toContainText('Persistent profile');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#navDataStudio').click();
  await expect(page.locator('.adi-source-name')).toContainText('Persistent profile');
});
test('malicious CSV values stay inert and cannot run scripts',async({page})=>{
  await page.locator('#navDataStudio').click();
  await page.locator('#adi-paste').fill('city,value\n<img src=x onerror=alert(1)>,123');
  await page.getByRole('button',{name:'Import pasted data'}).click();
  await page.getByRole('tab',{name:'Data Explorer'}).click();
  await expect(page.locator('#adaptive-data-studio .adi-table')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#adaptive-data-studio .adi-table img')).toHaveCount(0);
});
test('small-screen shortcut opens Data Intelligence and still shows Agent Studio',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('Control+Shift+D');
  await expect(page.locator('#adaptive-data-studio')).toBeVisible();
  await expect(page.locator('#navStudio')).toBeAttached();
});
