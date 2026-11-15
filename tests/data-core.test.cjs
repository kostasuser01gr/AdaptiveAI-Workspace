'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../modules/data-core.js');

test('CSV quoted delimiters, embedded newlines and escaped quotes',()=>{
  const csv='\uFEFFLocation;Revenue;Notes\r\nHeraklion;100,50;"hello;""world"""\r\nChania;25,25;"two\r\nlines"\r\n';
  const data=C.parseCSV(csv);
  assert.equal(data.delimiter,';');
  assert.equal(data.rows.length,2);
  assert.equal(data.rows[0][2],'hello;"world"');
  assert.equal(data.rows[1][2],'two\r\nlines');
  assert.deepEqual(data.headers,['Location','Revenue','Notes']);
});
test('comma, tab, pipe and quoted cell parsing',()=>{
  assert.deepEqual(C.parseCSV('a,b\n"x,y",z').rows[0],['x,y','z']);
  assert.equal(C.parseCSV('a\tb\n1\t2').delimiter,'\t');
  assert.equal(C.parseCSV('a|b\n1|2').delimiter,'|');
});
test('malformed CSV fails closed and row-width mismatches are disclosed',()=>{
  assert.throws(()=>C.parseCSV('a,b\n"bad,broken'),/Unterminated/);
  assert.throws(()=>C.parseCSV('a,a\n1,2'),/Duplicate header/);
  assert.throws(()=>C.parseCSV('a,b\n1,2,3'),/no valid data/);
  const parsed=C.parseCSV('a,b\n1,2\n3\n4,5');
  assert.equal(parsed.skipped,1);
  assert.equal(parsed.rows.length,2);
  assert.equal(parsed.totalRows,3);
  assert.equal(parsed.issues.length,1);
});
test('file-size and cell limits prevent unbounded memory',()=>{
  assert.throws(()=>C.parseCSV('a,b\n'+ 'x'.repeat(850)+',ok'),/800/);
  assert.throws(()=>C.parseCSV('a,b\n'+'1,'.repeat(1100000)),/(2 MB|32 columns)/);
  assert.throws(()=>C.parseCSV('a,b\n'),/no valid data/i);
});
test('numeric interpretation is locale-explicit',()=>{
  assert.equal(C.numberOf('1.234,56','eu'),1234.56);
  assert.equal(C.numberOf('1,234.56','us'),1234.56);
  assert.equal(C.numberOf('-23,50','eu'),-23.5);
  assert.equal(C.numberOf('00123','eu'),123);
  assert.equal(C.numberOf('1.234,56','us'),null);
  assert.equal(C.numberOf('=1+1','eu'),null);
  assert.equal(C.numberOf('n/a','eu'),null);
});
test('profile computes actual completeness, numeric fields and sensitive headers',()=>{
  const d=C.makeDataset('ops.csv','Station;Revenue;Email\nHeraklion;12,5;test@example.com\nChania;;\n');
  const p=C.profile(d,'eu');
  assert.equal(p.rows,2);
  assert.equal(p.missingCells,2);
  assert.equal(p.completeness,67);
  assert.equal(p.columns[1].numeric,true);
  assert.deepEqual(p.sensitive,['Email']);
});
test('aggregations count, sum, mean, median with missing numeric cells',()=>{
  const d=C.makeDataset('ops','Station;Amount\nH;1,5\nH;3,5\nH;\nC;10,0\n');
  const base={groupBy:'Station',measure:'Amount',locale:'eu'};
  assert.equal(C.aggregate(d,{...base,operation:'count'}).groups[0].value,3);
  const sum=C.aggregate(d,{...base,operation:'sum'});
  assert.equal(sum.groups.find(x=>x.label==='H').value,5);
  assert.equal(sum.invalidValues,1);
  assert.equal(C.aggregate(d,{...base,operation:'avg'}).groups.find(x=>x.label==='H').value,2.5);
  assert.equal(C.aggregate(d,{...base,operation:'median'}).groups.find(x=>x.label==='H').value,2.5);
  assert.equal(C.aggregate(d,{...base,operation:'min'}).groups.find(x=>x.label==='H').value,1.5);
});
test('case-insensitive row filters and column scopes',()=>{
  const d=C.makeDataset('records','Vehicle,Location\nToyota,Heraklion\nBMW,Chania\nSeat,HERAKLION');
  assert.equal(C.rowsFor(d,{search:'heraklion'}).length,2);
  assert.equal(C.rowsFor(d,{search:'Toyota',filterColumn:'Location'}).length,0);
  assert.equal(C.rowsFor(d,{search:'toyota',filterColumn:'Vehicle'}).length,1);
});
test('CSV formula injection is escaped by default',()=>{
  const original=['=SUM(1,1)','+1+2','-2+3','@SUM(1,1)','  =X','hello', 'a"\nnext'];
  const output=C.toCSV(['Field'],original.map(x=>[x]));
  assert.match(output,/"\t=SUM/);
  assert.match(output,/"\t\+1\+2/);
  assert.match(output,/"\t-2\+3/);
  assert.match(output,/"\t@SUM/);
  assert.match(output,/"\t  =X/);
  assert.match(output,/"a""\nnext"/);
  assert.match(output,/^\\uFEFF|^\uFEFF/);
});
test('data engine is DOM-independent and does not make external requests',()=>{
  const d=C.makeDataset('<img onerror=alert(1)>','city,value\n<script>,10');
  assert.equal(d.name,'<img onerror=alert(1)>');
  assert.equal(C.aggregate(d,{groupBy:'city',operation:'count'}).groups[0].label,'<script>');
});
