/* AdaptiveAI Cloud Console — authenticated workspace persistence, no credentials stored client-side. */
(function(root){
  'use strict';
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
  function add(parent){for(var i=1;i<arguments.length;i++)parent.appendChild(arguments[i]);return parent;}
  function button(title,handler,primary){
    var b=el('button','as-btn'+(primary?' primary':''),title);b.type='button';b.addEventListener('click',handler);return b;
  }
  function labeled(name,input){return add(el('label',''),el('span','',name),input);}
  function input(type,placeholder){
    var n=el('input','as-input');n.type=type;n.placeholder=placeholder;
    if(type==='email')n.autocomplete='email';
    if(type==='password'){n.autocomplete='current-password';n.minLength=10;n.maxLength=128;}
    return n;
  }
  async function request(path,body){
    var options={method:body?'POST':'GET',credentials:'same-origin',headers:{Accept:'application/json'}};
    if(body){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
    var response=await fetch(path,options),data=await response.json().catch(function(){return {error:'Invalid server response'};});
    if(!response.ok)throw Error(data.error||'Request failed ('+response.status+')');
    return data;
  }
  async function authRetry(path,body){
    try{return await request(path,body);}
    catch(error){
      if(!/Authentication required|401/.test(String(error.message)))throw error;
      try{await request('/api/auth',{action:'refresh'});}catch(e){throw error;}
      return request(path,body);
    }
  }
  function render(container){
    if(!container)return;
    container.replaceChildren();
    var title=el('div','as-toolbar'),info=el('div',''),out=el('div','as-two'),left=el('article','as-card'),right=el('article','as-card featured');
    add(info,el('h2','','Cloud Workspace'),el('p','','Isolated authenticated sync for this browser’s Agent Studio configuration.'));
    add(title,info,el('span','as-chip amber','SERVER-VERIFIED ONLY'));container.appendChild(title);
    container.appendChild(el('div','as-banner','Cloud features require a dedicated Supabase project and server-side environment configuration. Credentials are not saved in this page. Local workflows remain available offline.'));
    container.appendChild(out);
    add(out,left,right);
    var status=el('p','','Checking server configuration…'),response=el('div','as-mini');
    response.setAttribute('role','status');response.style.marginTop='13px';
    add(left,status,response);
    add(right,el('h3','','Identity & data boundaries'),el('p','','Cloud sync uses an HttpOnly authenticated session and row-level access rules. AI generation remains disabled until a server-side provider key and quota service are configured.'));
    right.appendChild(el('div','as-section-title','Cloud capabilities'));
    add(right,el('div','as-chip','Per-user RLS'),el('div','as-chip','Authenticated only'),el('div','as-chip','No browser API keys'));
    function feedback(msg){response.textContent=msg;}
    async function refresh(){
      left.replaceChildren();add(left,status,response);status.textContent='Checking session…';
      try{
        var session=await request('/api/auth');
        if(!session.configured){
          status.textContent='Cloud backend is not configured';
          feedback('Run the reviewed SQL schema in a dedicated Supabase project and set SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY on Vercel. No existing data is altered.');
          return;
        }
        if(!session.authenticated){
          status.textContent='Sign in to synchronize';
          feedback('Cloud synchronization is disabled until you authenticate.');
          var form=el('div','as-form'),email=input('email','name@example.com'),password=input('password','At least 10 characters');
          add(form,labeled('Email',email),labeled('Password',password));
          function submit(action){
            if(!email.validity.valid||!email.value.trim()||password.value.length<10){feedback('Enter a valid email and a password of at least 10 characters.');return;}
            feedback('Validating with the identity provider…');
            request('/api/auth',{action:action,email:email.value.trim(),password:password.value}).then(function(r){
              password.value='';
              if(r.pendingConfirmation){feedback('Verify your email, then sign in.');return;}
              refresh();
            }).catch(function(err){password.value='';feedback(err.message);});
          }
          add(form,button('Sign in',function(){submit('sign_in');},true),button('Create account',function(){submit('sign_up');}));
          left.appendChild(form);return;
        }
        status.textContent='Authenticated workspace';
        feedback(session.user?.email||'Signed in');
        var actions=el('div','as-form');actions.style.marginTop='17px';
        add(actions,button('↑ Save local state to cloud',async function(){
          try{
            var studio=root.AdaptiveAgentStudio;
            if(!studio||typeof studio.exportState!=='function')throw Error('Studio state unavailable');
            feedback('Saving to authenticated workspace…');
            var result=await authRetry('/api/workspace',{action:'save',state:studio.exportState()});
            feedback('Saved to cloud: '+(result.updatedAt||'confirmed'));
          }catch(err){feedback(err.message);}
        },true),button('↓ Restore cloud state to this browser',async function(){
          try{
            var studio=root.AdaptiveAgentStudio;
            if(!studio||typeof studio.replaceState!=='function')throw Error('Studio state unavailable');
            if(!root.confirm('Replace this browser’s Agent Studio configuration with the cloud copy?'))return;
            feedback('Reading authenticated workspace…');
            var result=await authRetry('/api/workspace',{action:'load'});
            if(!result.found){feedback('No cloud state saved yet.');return;}
            studio.replaceState(result.state);
            feedback('Cloud configuration restored locally. Reload the Studio tabs to see updates.');
          }catch(err){feedback(err.message);}
        }),button('Sign out',async function(){
          try{await request('/api/auth',{action:'sign_out'});refresh();}
          catch(err){feedback(err.message);}
        }));
        left.appendChild(actions);
      }catch(err){status.textContent='Cloud authentication unavailable';feedback(err.message);}
    }
    refresh();
  }
  root.AdaptiveCloudConsole={render:render};
})(typeof window!=='undefined'?window:{});
