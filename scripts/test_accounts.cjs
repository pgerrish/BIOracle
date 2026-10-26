const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../dist/accounts.js'), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

function fixture(configured = true) {
  class Element {
    constructor() { this.listeners={};this.value='';this.hidden=false;this.disabled=false;this.dataset={};this.attributes={};this.textContent=''; }
    addEventListener(name, fn) { this.listeners[name]=fn; }
    setAttribute(name, value) { this.attributes[name]=value; }
    focus() { this.focused=true; }
    showModal() { this.open=true; }
    close() { this.open=false;this.listeners.close?.(); }
    reportValidity() { return true; }
  }
  const ids=['account-dialog','account-form','account-email','account-password','account-confirm','account-submit','account-status','account-mode-buttons','account-signed-in','account-signout-anyway','account-title','account-description','account-identity','account-email-field','account-password-field','account-confirm-field','account-password-hint','account-forgot','account-close','account-signout'];
  const nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));
  const nav=new Element(),page=new Element(),signin=new Element(),signup=new Element();
  signin.dataset.authMode='signin';signup.dataset.authMode='signup';
  let callback;const calls=[];
  const user={id:'alice',email:'alice@example.org'};
  const auth={
    onAuthStateChange(fn) { callback=fn; }, getSession:async()=>({data:{session:null},error:null}),
    signInWithPassword:async values=>{calls.push(['signin',values]);callback('SIGNED_IN',{user});return{error:null};},
    signUp:async values=>{calls.push(['signup',values]);return{data:{session:null},error:null};},
    resetPasswordForEmail:async(...args)=>{calls.push(['forgot',args]);return{error:null};},
    updateUser:async values=>{calls.push(['reset',values]);return{error:null};},
    signOut:async()=>{calls.push(['signout']);callback('SIGNED_OUT',null);return{error:null};}
  };
  const context={
    window:{BIOracleAccountConfig:configured?{supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_example',basePath:'/BIOracle'}:{},supabase:{createClient:()=>({auth})}},
    document:{getElementById:id=>nodes[id],activeElement:nav,querySelectorAll:selector=>selector==='[data-account-button]'?[nav,page]:[signin,signup]},
    location:{origin:'http://localhost:8000'},setTimeout,URL,AbortSignal,fetch:async()=>{throw Error('Unexpected fetch');}
  };
  vm.runInNewContext(source,context);
  return {nodes,nav,page,signin,signup,calls,auth,account:context.window.BIOracleAccount,emit:(event,session)=>callback(event,session),submit:()=>nodes['account-form'].listeners.submit({preventDefault(){}}),user};
}

test('unconfigured backend keeps real login disabled and explains the state', () => {
  const f=fixture(false);f.nav.listeners.click();
  assert.equal(f.nodes['account-dialog'].open,true);
  assert.equal(f.nodes['account-submit'].disabled,true);
  assert.match(f.nodes['account-status'].textContent,/not available yet/);
  assert.equal(f.account.state.configured,false);
});

test('both buttons open the dialog; signup confirms passwords and waits for email confirmation', async () => {
  const f=fixture();f.emit('INITIAL_SESSION',null);await tick();
  f.page.listeners.click();assert.equal(f.nodes['account-dialog'].open,true);
  f.signup.listeners.click();assert.equal(f.nodes['account-title'].textContent,'Create account');
  f.nodes['account-email'].value='alice@example.org';f.nodes['account-password'].value='long-test-password';f.nodes['account-confirm'].value='different';
  await f.submit();assert.equal(f.calls.length,0);assert.match(f.nodes['account-status'].textContent,/do not match/);
  f.nodes['account-confirm'].value='long-test-password';await f.submit();
  assert.equal(f.calls[0][0],'signup');assert.equal(f.calls[0][1].options.emailRedirectTo,'http://localhost:8000/BIOracle/business-model/');
  assert.equal(f.nodes['account-password'].value,'');assert.match(f.nodes['account-status'].textContent,/confirm your account/);
  assert.equal(f.account.state.user,null);
});

test('login updates both account buttons and logout waits for unsaved changes', async () => {
  const f=fixture();f.emit('INITIAL_SESSION',null);await tick();f.nav.listeners.click();
  f.nodes['account-email'].value='alice@example.org';f.nodes['account-password'].value='long-test-password';
  await f.submit();await tick();
  assert.equal(f.nav.textContent,'Account');assert.equal(f.page.textContent,'Account');assert.equal(f.account.state.user.id,'alice');assert.equal(f.nodes['account-password'].value,'');
  f.account.beforeSignOut(async()=>false);f.nav.listeners.click();
  await f.nodes['account-signout'].listeners.click();await tick();
  assert.equal(f.calls.filter(c=>c[0]==='signout').length,0);assert.equal(f.nodes['account-signout-anyway'].hidden,false);
  await f.nodes['account-signout-anyway'].listeners.click();await tick();
  assert.equal(f.account.state.user,null);assert.equal(f.nav.textContent,'Log in');
});

test('password recovery enters reset mode and updates the password', async () => {
  const f=fixture();f.emit('INITIAL_SESSION',null);await tick();f.nav.listeners.click();
  f.nodes['account-forgot'].listeners.click();f.nodes['account-email'].value='alice@example.org';await f.submit();
  assert.equal(f.calls[0][0],'forgot');assert.equal(f.calls[0][1][1].redirectTo,'http://localhost:8000/BIOracle/business-model/');
  f.emit('PASSWORD_RECOVERY',{user:f.user});await tick();
  assert.equal(f.nodes['account-title'].textContent,'Choose a new password');assert.equal(f.nodes['account-email'].disabled,true);
  f.nodes['account-password'].value='a-new-test-password';f.nodes['account-confirm'].value='a-new-test-password';await f.submit();
  assert.equal(f.calls.at(-1)[0],'reset');assert.equal(f.nodes['account-password'].value,'');
});
