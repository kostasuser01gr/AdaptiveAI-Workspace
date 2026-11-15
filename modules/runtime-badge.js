/* Runtime truth layer: display actual configuration state; never claim fake sync. */
(function(){
  'use strict';
  function start(){
    var el=document.getElementById('connText');
    if(!el)return;
    el.textContent='Checking mode…';
    fetch('/api/capabilities',{credentials:'same-origin',cache:'no-store'})
      .then(function(response){if(!response.ok)throw Error('Unavailable');return response.json();})
      .then(function(capabilities){
        setTimeout(function(){
          var label=document.getElementById('connText');
          if(label)label.textContent=capabilities.authConfigured?'Cloud available · sign in':'Demo · local';
          document.documentElement.dataset.adaptiveMode=capabilities.mode==='cloud-configured'?'cloud':'demo';
        },1750);
      })
      .catch(function(){
        setTimeout(function(){
          var label=document.getElementById('connText');
          if(label)label.textContent='Demo · offline';
          document.documentElement.dataset.adaptiveMode='demo';
        },1750);
      });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
