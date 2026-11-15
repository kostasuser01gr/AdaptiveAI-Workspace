/* AdaptiveAI Data Intelligence Core — CSV parsing, profiling, local transformations. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AdaptiveDataCore=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var LIMITS=Object.freeze({bytes:2097152,rows:5000,columns:32,cell:800,datasets:12,chartGroups:12});
  function fail(msg){throw Error(msg);}
  function csvDelimiter(text){
    var values=[',',';','\t','|'],count={',':0,';':0,'\t':0,'|':0},quoted=false,lines=0;
    for(var i=0;i<text.length&&i<25000&&lines<8;i++){
      var c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}
      else if(!quoted){
        if(c==='\n')lines++;
        else if(values.includes(c))count[c]++;
      }
    }
    return values.sort(function(a,b){return count[b]-count[a];})[0];
  }
  function parseCSV(input,options){
    options=options||{};
    if(typeof input!=='string')fail('CSV content must be text');
    if(input.length>LIMITS.bytes)fail('File exceeds 2 MB character limit');
    var text=input.replace(/^\uFEFF/,'');
    var delimiter=options.delimiter||csvDelimiter(text);
    if(![',',';','\t','|'].includes(delimiter))fail('Unsupported CSV delimiter');
    var all=[],errors=[],row=[],field='',quoted=false,afterQuote=false,line=1,recordLine=1,i=0;
    function pushCell(){
      if(field.length>LIMITS.cell)fail('A cell exceeds 800 characters (line '+recordLine+')');
      if(row.length>=LIMITS.columns)fail('File exceeds 32 columns');
      row.push(field);field='';afterQuote=false;
    }
    function pushRow(){
      pushCell();
      if(row.length===1&&row[0].trim()===''){row=[];recordLine=line;return;}
      if(all.length>LIMITS.rows)fail('File exceeds 5,000 data rows');
      all.push(row);row=[];recordLine=line;
    }
    for(;i<text.length;i++){
      var ch=text[i];
      if(quoted){
        if(ch==='"'){
          if(text[i+1]==='"'){field+='"';i++;}
          else {quoted=false;afterQuote=true;}
        }else {field+=ch;if(ch==='\n')line++;}
      }else if(afterQuote){
        if(ch===delimiter)pushCell();
        else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;line++;pushRow();}
        else if(ch===' '||ch==='\t'){} 
        else fail('Unexpected character after closing quote near line '+line);
      }else if(ch==='"'){
        if(field.trim()!=='')fail('Unexpected quote near line '+line);
        field='';
        quoted=true;
      }else if(ch===delimiter)pushCell();
      else if(ch==='\r'||ch==='\n'){
        if(ch==='\r'&&text[i+1]==='\n')i++;
        line++;pushRow();
      }else field+=ch;
      if(field.length>LIMITS.cell)fail('A cell exceeds 800 characters (line '+recordLine+')');
    }
    if(quoted)fail('Unterminated quoted field near line '+recordLine);
    if(field!==''||row.length||afterQuote)pushRow();
    if(!all.length)fail('CSV contains no headers');
    var original=all.shift().map(function(h){return h.trim();});
    if(original.length<1||original.some(function(h){return !h||h.length>75;}))fail('Headers must be nonempty and at most 75 characters');
    var lowered=new Set();
    var headers=original.map(function(h){
      var k=h.toLocaleLowerCase();
      if(lowered.has(k))fail('Duplicate header: '+h);
      lowered.add(k);return h;
    });
    var data=[];
    all.forEach(function(cells,index){
      if(cells.length!==headers.length){
        errors.push('Line '+(index+2)+': expected '+headers.length+' fields, received '+cells.length);
        return;
      }
      data.push(cells);
    });
    if(!data.length)fail('CSV has no valid data rows');
    return {headers:headers,rows:data,delimiter:delimiter,skipped:errors.length,issues:errors.slice(0,25),totalRows:all.length};
  }
  function numberOf(value,locale){
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    var text=String(value==null?'':value).trim();
    if(!text)return null;
    if(/^[=+@]/.test(text))return null;
    text=text.replace(/[€$£]/g,'').replace(/\u00a0/g,'').trim();
    var normalized;
    if(locale==='eu'){
      if(!/^-?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d+)?$/.test(text))return null;
      normalized=text.replace(/[.\s]/g,'').replace(',','.');
    }else{
      if(!/^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(text))return null;
      normalized=text.replace(/,/g,'');
    }
    var result=Number(normalized);
    return Number.isFinite(result)?result:null;
  }
  function sensitiveColumns(headers){
    return headers.filter(function(h){return /(?:email|e-mail|telephone|phone|mobile|pass(?:word)?|token|secret|iban|passport|identity|customer.?name|full.?name|διεύθυνση|τηλέφων|κινητό|κωδικό|ονοματεπώνυμο)/i.test(h);});
  }
  function profile(dataset,locale){
    if(!dataset||!Array.isArray(dataset.headers)||!Array.isArray(dataset.rows))fail('Invalid dataset');
    var count=dataset.rows.length,columns=dataset.headers.map(function(h,index){
      var vals=dataset.rows.map(function(r){return String(r[index]||'').trim();});
      var filled=vals.filter(Boolean),numeric=filled.map(function(v){return numberOf(v,locale);}).filter(function(v){return v!==null;});
      var distinct=new Set(filled.map(function(v){return v.toLocaleLowerCase();}));
      var valsSorted=numeric.slice().sort(function(a,b){return a-b;});
      return {name:h,filled:filled.length,missing:count-filled.length,distinct:distinct.size,
        numeric:filled.length>0&&numeric.length/filled.length>=.9&& !/^(?:id|code|zip|postal|αριθμ)/i.test(h),
        minimum:valsSorted.length?valsSorted[0]:null,
        maximum:valsSorted.length?valsSorted[valsSorted.length-1]:null,
        sum:valsSorted.length?numeric.reduce(function(a,b){return a+b;},0):null};
    });
    var complete=dataset.rows.filter(function(row){return row.every(function(v){return String(v).trim()!=='';});}).length;
    var missing=columns.reduce(function(a,c){return a+c.missing;},0);
    return {rows:count,columnCount:columns.length,columns:columns,completeRows:complete,
      missingCells:missing,completeness:count&&columns.length?Math.round(100*(1-missing/(count*columns.length))):0,
      sensitive:sensitiveColumns(dataset.headers),skipped:Number(dataset.skipped||0)};
  }
  function rowsFor(dataset,opts){
    opts=opts||{};var index=dataset.headers.indexOf(opts.filterColumn||'');
    var text=String(opts.search||'').trim().toLocaleLowerCase();
    return dataset.rows.filter(function(row){
      if(!text)return true;
      var values=index>=0?[row[index]]:row;
      return values.some(function(v){return String(v||'').toLocaleLowerCase().includes(text);});
    });
  }
  function aggregate(dataset,opts){
    opts=opts||{};var groupIndex=dataset.headers.indexOf(opts.groupBy),measureIndex=dataset.headers.indexOf(opts.measure);
    if(groupIndex<0)fail('Choose a group column');
    if(measureIndex<0&&opts.operation!=='count')fail('Choose a numeric measure');
    var groups=new Map(),filtered=rowsFor(dataset,opts),invalid=0;
    filtered.forEach(function(row){
      var name=String(row[groupIndex]||'').trim()||'(empty)';
      if(!groups.has(name))groups.set(name,{label:name,count:0,sum:0,min:Infinity,max:-Infinity,values:[]});
      var record=groups.get(name);record.count++;
      if(opts.operation==='count')return;
      var val=numberOf(row[measureIndex],opts.locale||'eu');
      if(val===null){invalid++;return;}
      record.sum+=val;record.min=Math.min(record.min,val);record.max=Math.max(record.max,val);
      record.values.push(val);
    });
    var operation=opts.operation||'count';
    var result=Array.from(groups.values()).map(function(item){
      var values=item.values.slice().sort(function(a,b){return a-b;});
      var result;
      if(operation==='count')result=item.count;
      else if(!values.length)result=null;
      else if(operation==='sum')result=item.sum;
      else if(operation==='avg')result=item.sum/values.length;
      else if(operation==='min')result=item.min;
      else if(operation==='max')result=item.max;
      else if(operation==='median'){
        var mid=Math.floor(values.length/2);
        result=values.length%2?values[mid]:(values[mid-1]+values[mid])/2;
      }else fail('Unsupported aggregation');
      return {label:item.label,value:result,count:item.count,validValues:values.length};
    });
    result.sort(function(a,b){return (b.value===null?-Infinity:b.value)-(a.value===null?-Infinity:a.value);});
    return {groups:result.slice(0,LIMITS.chartGroups),totalGroups:result.length,invalidValues:invalid,matchedRows:filtered.length,operation:operation};
  }
  function escapeCSVCell(value,spreadsheetSafe){
    var str=String(value==null?'':value);
    if(spreadsheetSafe&&/^[\s\u0000-\u001f]*[=+\-@]/.test(str))str='\t'+str;
    return '"'+str.replace(/"/g,'""')+'"';
  }
  function toCSV(headers,rows,opts){
    opts=opts||{};
    if(!Array.isArray(headers)||!Array.isArray(rows))fail('Invalid table for export');
    var all=[headers].concat(rows);
    return '\uFEFF'+all.map(function(row){return row.map(function(v){return escapeCSVCell(v,opts.spreadsheetSafe!==false);}).join(',');}).join('\r\n');
  }
  function makeDataset(name,text,opts){
    var parsed=parseCSV(text,opts),cleanName=String(name||'Untitled').trim().slice(0,100)||'Untitled';
    return {id:'ds-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),
      name:cleanName,createdAt:new Date().toISOString(),headers:parsed.headers,rows:parsed.rows,
      skipped:parsed.skipped,issues:parsed.issues,delimiter:parsed.delimiter,source:'user_upload',verified:false};
  }
  return {LIMITS:LIMITS,parseCSV:parseCSV,makeDataset:makeDataset,numberOf:numberOf,
    profile:profile,aggregate:aggregate,rowsFor:rowsFor,toCSV:toCSV,sensitiveColumns:sensitiveColumns};
});
