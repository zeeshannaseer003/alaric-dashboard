const SUPABASE_URL='https://kucenxfhkiqfxqrytbye.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_alyK2HPCzMysVlSaHgKmrg_KBBnp_6K';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const ADMIN_EMAILS=['zeeshannaseer003@gmail.com'];
function isAdminEmail(email){return ADMIN_EMAILS.indexOf(String(email||'').toLowerCase().trim())>=0;}
var cache={profiles:[],posts:[],comments:[],likes:[],chat:[]};
var useCloud=false;
function uid(){return 'id_'+Math.random().toString(36).slice(2)+Date.now().toString(36)}
function isStrongPassword(pw){return pw.length>=8&&/[0-9]/.test(pw)&&/[^A-Za-z0-9]/.test(pw)}
function updatePwStrength(pw){var bar=document.getElementById('pwBar'),hint=document.getElementById('pwHint');if(!bar)return;var s=0;if(pw.length>=8)s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;if(/[A-Z]/.test(pw)&&/[a-z]/.test(pw))s++;bar.style.width=(s/4*100)+'%';bar.style.background=s<2?'#ef4444':s<3?'#f59e0b':'#22c55e';if(hint)hint.textContent=s<2?'Weak':s<3?'Medium':'Strong'}
function showAuthError(msg){var e=document.getElementById('authError');e.textContent=msg;e.classList.add('show');document.getElementById('authSuccess').classList.remove('show')}
function showAuthSuccess(msg){var e=document.getElementById('authSuccess');e.textContent=msg;e.classList.add('show');document.getElementById('authError').classList.remove('show')}
function hideAuthMsg(){document.getElementById('authError').classList.remove('show');document.getElementById('authSuccess').classList.remove('show')}
function toast(msg){var e=document.querySelector('.toast');if(e)e.remove();var el=document.createElement('div');el.className='toast';el.textContent='✓ '+msg;document.body.appendChild(el);setTimeout(function(){el.remove()},2800)}
function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function friendlyAuthError(msg){msg=String(msg||'');var m=msg.toLowerCase();if(m.indexOf('rate limit')>-1)return 'Too many emails. Wait 30–60 min. Turn Confirm email OFF in Supabase.';if(m.indexOf('not confirmed')>-1)return 'Email not confirmed. Turn Confirm email OFF in Supabase, then login.';if(m.indexOf('invalid login')>-1||m.indexOf('invalid credentials')>-1)return 'Wrong email or password.';if(m.indexOf('already registered')>-1||m.indexOf('already been registered')>-1)return 'Email already registered. Login or Forgot password.';return msg||'Something went wrong.'}
function showAuthPanel(mode){document.getElementById('loginForm').style.display=mode==='login'?'':'none';document.getElementById('signupForm').style.display=mode==='signup'?'':'none';document.getElementById('forgotForm').style.display=mode==='forgot'?'':'none';document.getElementById('authTabs').style.display=mode==='forgot'?'none':'';document.querySelectorAll('[data-tab]').forEach(function(b){b.classList.toggle('on',b.dataset.tab===mode)});hideAuthMsg()}
document.querySelectorAll('[data-tab]').forEach(function(btn){btn.addEventListener('click',function(){showAuthPanel(btn.dataset.tab)})});
document.getElementById('suPw').addEventListener('input',function(){updatePwStrength(this.value)});
document.querySelectorAll('.pw-toggle').forEach(function(btn){btn.addEventListener('click',function(){var inp=document.getElementById(btn.getAttribute('data-target'));if(!inp)return;if(inp.type==='password'){inp.type='text';btn.textContent='Hide'}else{inp.type='password';btn.textContent='Show'}})});
document.getElementById('forgotLink').addEventListener('click',function(){showAuthPanel('forgot')});
document.getElementById('backToLogin').addEventListener('click',function(){showAuthPanel('login')});
document.getElementById('loginBtn').addEventListener('click',doLogin);
document.getElementById('loginPw').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
document.getElementById('signupBtn').addEventListener('click',doSignup);
document.getElementById('resetBtn').addEventListener('click',doForgot);
async function doLogin(){hideAuthMsg();var email=document.getElementById('loginId').value.trim(),pw=document.getElementById('loginPw').value;if(!email||!pw){showAuthError('Enter email and password.');return}var btn=document.getElementById('loginBtn');btn.disabled=true;btn.textContent='Signing in...';try{var res=await sb.auth.signInWithPassword({email:email,password:pw});if(res.error){showAuthError(friendlyAuthError(res.error.message));return}await enterApp(res.data.user)}catch(err){showAuthError(friendlyAuthError(err.message))}finally{btn.disabled=false;btn.textContent='Login'}}
async function doSignup(){hideAuthMsg();var first=document.getElementById('suFirst').value.trim(),last=document.getElementById('suLast').value.trim();var email=document.getElementById('suId').value.trim(),pw=document.getElementById('suPw').value,spec=document.getElementById('suSpec').value;if(!first||!last){showAuthError('First and last name required.');return}if(!email){showAuthError('Email required.');return}if(!isStrongPassword(pw)){showAuthError('Password: 8+ chars, number & symbol.');return}if(!spec){showAuthError('Select a specialty.');return}var btn=document.getElementById('signupBtn');btn.disabled=true;btn.textContent='Creating...';try{var res=await sb.auth.signUp({email:email,password:pw,options:{data:{first_name:first,last_name:last,specialty:spec,role:'member'}}});if(res.error){showAuthError(friendlyAuthError(res.error.message));return}if(res.data.user){await upsertProfileCloud({id:res.data.user.id,email:email,first:first,last:last,specialty:spec,role:'member',status:'pending'})}if(res.data.user&&res.data.session){showAuthSuccess('Account created!');setTimeout(function(){enterApp(res.data.user)},500)}else{showAuthSuccess('Account created. If login fails, turn Confirm email OFF in Supabase.');setTimeout(function(){showAuthPanel('login');document.getElementById('loginId').value=email},1800)}}catch(err){showAuthError(friendlyAuthError(err.message))}finally{btn.disabled=false;btn.textContent='Create Account'}}
async function doForgot(){hideAuthMsg();var email=document.getElementById('fpId').value.trim();if(!email){showAuthError('Enter email.');return}var btn=document.getElementById('resetBtn');btn.disabled=true;btn.textContent='Sending...';try{var res=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+(window.location.pathname||'/')});if(res.error){showAuthError(friendlyAuthError(res.error.message));return}showAuthSuccess('If this email exists, a reset link was sent.')}catch(err){showAuthError(friendlyAuthError(err.message))}finally{btn.disabled=false;btn.textContent='Send Reset Link'}}
async function detectCloud(){try{var r=await sb.from('profiles').select('id').limit(1);useCloud=!r.error}catch(e){useCloud=false}return useCloud}
async function loadAllData(){
  if(!useCloud){
    try{cache.profiles=JSON.parse(localStorage.getItem('alaric_v2_profiles')||'[]')}catch(e){cache.profiles=[]}
    try{cache.posts=JSON.parse(localStorage.getItem('alaric_v2_posts')||'[]')}catch(e){cache.posts=[]}
    try{cache.comments=JSON.parse(localStorage.getItem('alaric_v2_comments')||'[]')}catch(e){cache.comments=[]}
    try{cache.likes=JSON.parse(localStorage.getItem('alaric_v2_likes')||'[]')}catch(e){cache.likes=[]}
    try{cache.chat=JSON.parse(localStorage.getItem('alaric_v2_chat')||'[]')}catch(e){cache.chat=[]}
    return;
  }
  var pr=await sb.from('profiles').select('*');
  var po=await sb.from('posts').select('*').order('created_at',{ascending:false});
  var co=await sb.from('comments').select('*').order('created_at',{ascending:true});
  var li=await sb.from('likes').select('*');
  var ch=await sb.from('chat_messages').select('*').order('created_at',{ascending:true});
  cache.profiles=(pr.data||[]).map(function(p){return{id:p.id,email:p.email,first:p.first_name,last:p.last_name,specialty:p.specialty,role:p.role||'member',status:p.status||'pending',photo:p.photo||'',created:p.created_at}});
  cache.posts=(po.data||[]).map(function(p){return{id:p.id,user_id:p.user_id,title:p.title,body:p.body,visibility:p.visibility||'members',created:p.created_at}});
  cache.comments=(co.data||[]).map(function(c){return{id:c.id,post_id:c.post_id,user_id:c.user_id,body:c.body,created:c.created_at}});
  cache.likes=(li.data||[]).map(function(l){return{post_id:l.post_id,user_id:l.user_id}});
  cache.chat=(ch.data||[]).map(function(m){return{id:m.id,user_id:m.user_id,body:m.body,created:m.created_at}});
}
function getProfiles(){return cache.profiles}
function getProfile(id){return cache.profiles.find(function(x){return x.id===id})}
function getPosts(){return cache.posts}
function getComments(){return cache.comments}
function getLikes(){return cache.likes}
function getChat(){return cache.chat}
async function upsertProfileCloud(p){
  if(!p||!p.id)return;
  var existing=getProfile(p.id)||{};
  var merged=Object.assign({},existing,p);
  var i=cache.profiles.findIndex(function(x){return x.id===p.id});
  if(i>=0)cache.profiles[i]=merged;else cache.profiles.push(merged);
  if(!useCloud){localStorage.setItem('alaric_v2_profiles',JSON.stringify(cache.profiles));return}
  await sb.from('profiles').upsert({id:merged.id,email:merged.email||null,first_name:merged.first||null,last_name:merged.last||null,specialty:merged.specialty||null,role:merged.role||'member',status:merged.status||'pending',photo:merged.photo||null});
}
async function addPostCloud(post){
  if(useCloud){
    var r=await sb.from('posts').insert({user_id:post.user_id,title:post.title,body:post.body,visibility:post.visibility||'members'}).select().single();
    if(r.error){toast(r.error.message);return null}
    post={id:r.data.id,user_id:r.data.user_id,title:r.data.title,body:r.data.body,visibility:r.data.visibility,created:r.data.created_at};
  }else{post.id=post.id||uid();post.created=post.created||new Date().toISOString();localStorage.setItem('alaric_v2_posts',JSON.stringify([post].concat(cache.posts)))}
  cache.posts.unshift(post);return post;
}
async function deletePostCloud(pid){
  cache.posts=cache.posts.filter(function(p){return p.id!==pid});
  cache.comments=cache.comments.filter(function(c){return c.post_id!==pid});
  cache.likes=cache.likes.filter(function(l){return l.post_id!==pid});
  if(useCloud){await sb.from('likes').delete().eq('post_id',pid);await sb.from('comments').delete().eq('post_id',pid);await sb.from('posts').delete().eq('id',pid)}
  else{localStorage.setItem('alaric_v2_posts',JSON.stringify(cache.posts));localStorage.setItem('alaric_v2_comments',JSON.stringify(cache.comments));localStorage.setItem('alaric_v2_likes',JSON.stringify(cache.likes))}
}
async function addCommentCloud(c){
  if(useCloud){var r=await sb.from('comments').insert({post_id:c.post_id,user_id:c.user_id,body:c.body}).select().single();if(r.error){toast(r.error.message);return}c={id:r.data.id,post_id:r.data.post_id,user_id:r.data.user_id,body:r.data.body,created:r.data.created_at}}
  else{c.id=uid();c.created=new Date().toISOString();localStorage.setItem('alaric_v2_comments',JSON.stringify(cache.comments.concat([c])))}
  cache.comments.push(c);
}
async function toggleLikeCloud(postId,userId){
  var i=cache.likes.findIndex(function(l){return l.post_id===postId&&l.user_id===userId});
  if(i>=0){cache.likes.splice(i,1);if(useCloud)await sb.from('likes').delete().eq('post_id',postId).eq('user_id',userId);else localStorage.setItem('alaric_v2_likes',JSON.stringify(cache.likes))}
  else{cache.likes.push({post_id:postId,user_id:userId});if(useCloud)await sb.from('likes').insert({post_id:postId,user_id:userId});else localStorage.setItem('alaric_v2_likes',JSON.stringify(cache.likes))}
}
async function addChatCloud(m){
  if(useCloud){var r=await sb.from('chat_messages').insert({user_id:m.user_id,body:m.body}).select().single();if(r.error){toast(r.error.message);return}m={id:r.data.id,user_id:r.data.user_id,body:r.data.body,created:r.data.created_at}}
  else{m.id=uid();m.created=new Date().toISOString();localStorage.setItem('alaric_v2_chat',JSON.stringify(cache.chat.concat([m])))}
  cache.chat.push(m);
}
var currentUser=null,role='member',status='approved',idx=0;
function userFromSession(user){
  var m=user.user_metadata||{},local=getProfile(user.id)||{},em=user.email||'',r;
  if(isAdminEmail(em)) r='admin';
  else if(local.role==='admin'||local.role==='official'||local.role==='staff') r=local.role;
  else r='member';
  var st=local.status;if(r==='admin'||r==='official') st=st||'approved';if(!st) st='pending';
  return{id:user.id,email:em,first:m.first_name||local.first||(em?em.split('@')[0]:'User'),last:m.last_name||local.last||'',specialty:m.specialty||local.specialty||'',role:r,status:st};
}
async function enterApp(user){
  await detectCloud();await loadAllData();
  currentUser=userFromSession(user);role=currentUser.role||'member';status=currentUser.status||'pending';
  if(isAdminEmail(currentUser.email)){role='admin';status='approved';currentUser.role='admin';currentUser.status='approved'}
  await upsertProfileCloud({id:currentUser.id,email:currentUser.email,first:currentUser.first,last:currentUser.last,specialty:currentUser.specialty,role:role,status:status});
  idx=0;document.getElementById('authScreen').style.display='none';document.getElementById('app').classList.add('show');render();
  toast('Welcome, '+currentUser.first+(useCloud?' · shared live':' · local (run SQL)')+'!');
}
function roleBadge(p){if(!p)return '<span class="badge-role member">Member</span>';if(p.role==='admin')return '<span class="badge-role admin">Admin</span>';if(p.role==='official'||p.role==='staff')return '<span class="badge-role official">Official</span>';if(p.status==='approved')return '<span class="badge-role verified">Verified</span>';if(p.status==='pending')return '<span class="badge-role pending">Pending</span>';if(p.status==='rejected')return '<span class="badge-role pending">Rejected</span>';return '<span class="badge-role member">Member</span>'}
function isAdmin(){return role==='admin'}
function isOfficial(){return role==='admin'||role==='staff'||role==='official'}
function isApproved(){return status==='approved'||isAdmin()}
function publicName(userId){var p=getProfile(userId);if(!p)return 'Member';return (p.first||'Member')+(p.last?' '+p.last.charAt(0)+'.':'')}
function publicSpec(userId){var p=getProfile(userId);return p&&p.specialty?p.specialty:''}
function authorRole(userId){var p=getProfile(userId);return (p&&p.role)||'member'}
function isMemberAuthor(post){return authorRole(post.user_id)==='member'}
function canSeePost(post){
  if(isAdmin())return true;
  if(post.user_id===currentUser.id)return true;
  if(post.visibility==='private')return false;
  if(!isApproved())return false;
  if(post.visibility==='official')return isOfficial();
  return isMemberAuthor(post);
}
function render(){
  var displayName=(currentUser.first+' '+currentUser.last).trim(),letter=(currentUser.first||'?')[0].toUpperCase(),secs=[];
  var groups;
  if(isAdmin()) groups=[['Control',[['See all',pageSeeAll],['Approvals',pageAdminOverview],['Members',pageAdminMembers]]],['Community',[['All Questions',pageFeed],['Member Chat',pageChat]]],['Services',[['Premium Services',pagePremiumServices]]],['Account',[['My Profile',pageProfile]]]];
  else groups=[['Community',[['Home',pageMemberHome],['Questions',pageFeed],['Ask Question',pageNewPost],['Admin Chat',pageChat]]],['Services',[['Premium Services',pagePremiumServices]]],['Account',[['My Profile',pageProfile]]]];
  var h='<div class="logo"><div class="logo-icon">A</div><div><div>Alaric</div>'+(isAdmin()?'<div class="logo-kicker">Admin panel</div>':'<div class="logo-kicker">Member</div>')+'</div></div>',ph=(getProfile(currentUser.id)||{}).photo,meP=getProfile(currentUser.id)||{role:role,status:status};
  h+='<div class="user-info"><div class="av">'+(ph?'<img src="'+ph+'" alt="">':letter)+'</div><div><div class="name">'+esc(displayName)+'</div><div style="margin-top:4px">'+roleBadge(meP)+(currentUser.specialty?' <span style="color:var(--muted);font-size:.75rem">'+esc(currentUser.specialty)+'</span>':'')+'</div></div></div>';
  groups.forEach(function(g){h+='<div class="nav-sec">'+g[0]+'</div>';g[1].forEach(function(x){var i=secs.length;secs.push(x);h+='<button class="nav'+(i===idx?' on':'')+'" data-i="'+i+'">'+x[0];if((x[0]==='Members'||x[0]==='Approvals')&&isAdmin()){var pend=getProfiles().filter(function(p){return p.status==='pending'}).length;if(pend)h+='<span class="badge">'+pend+'</span>'}h+='</button>'});});
  h+='<button class="logout-btn" id="logoutBtn">Logout</button>';
  var side=document.getElementById('side');side.classList.toggle('is-admin',!!isAdmin());side.innerHTML=h;
  var top=isAdmin()?'<div class="admin-top"><div><b>Admin panel</b><span>Full access · members, questions, private chats</span></div><span class="pill warn">Admin</span></div>':'';
  document.getElementById('c').innerHTML=top+secs[Math.min(idx,secs.length-1)][1]();
  document.getElementById('logoutBtn').onclick=async function(){await sb.auth.signOut();currentUser=null;document.getElementById('app').classList.remove('show');document.getElementById('authScreen').style.display='';hideAuthMsg()};
  document.querySelectorAll('.nav[data-i]').forEach(function(btn){btn.onclick=function(){idx=+btn.dataset.i;render()}});bindPageEvents();
}
function pagePremiumServices(){
  var html='<h1>⭐ Premium Services</h1><p class="sub">Alaric Health Services — Hire our professional team. Transparent pricing.</p>';
  html+='<div class="pending-banner" style="border-color:rgba(45,212,191,.35);background:rgba(45,212,191,.08)"><b>Alaric Health Services</b> — Medical Billing, Credentialing, Virtual Assistant & more.</div>';
  html+='<div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:28px">';
  html+='<div class="card" style="border-color:rgba(45,212,191,.4)"><div style="font-size:1.4rem;margin-bottom:8px">💰</div><div style="font-weight:750;font-size:1.15rem;margin-bottom:6px">Medical Billing Package</div><div style="color:var(--muted);font-size:.85rem;margin-bottom:12px">Full billing suite under one rate</div><div style="font-size:1.75rem;font-weight:800;margin-bottom:4px">5% <span style="font-size:.9rem;font-weight:500;color:var(--muted)">of collections</span></div><div style="color:var(--muted);font-size:.8rem;margin-bottom:14px">or $15 / hour — all included</div><ul style="list-style:none;padding:0;margin:0 0 16px;font-size:.88rem;line-height:1.8"><li>✓ Medical Billing & Coding</li><li>✓ Rejection Handling</li><li>✓ Accounts Receivable</li><li>✓ Denial Management</li><li>✓ Eligibility Verification</li><li>✓ Prior Authorization</li><li>✓ Payment Posting & Reporting</li></ul><button class="btn" style="width:100%" onclick="toast(\'Request received — we will contact you\')">Get Started</button></div>';
  html+='<div class="card"><div style="font-size:1.4rem;margin-bottom:8px">📋</div><div style="font-weight:750;font-size:1.15rem;margin-bottom:6px">Credentialing</div><div style="color:var(--muted);font-size:.85rem;margin-bottom:12px">Initial, re-credentialing & enrollment</div><div style="font-size:1.75rem;font-weight:800;margin-bottom:4px">$150 <span style="font-size:.9rem;font-weight:500;color:var(--muted)">/ application</span></div><div style="color:var(--muted);font-size:.8rem;margin-bottom:14px">One-time per application</div><ul style="list-style:none;padding:0;margin:0 0 16px;font-size:.88rem;line-height:1.8"><li>✓ Initial Credentialing</li><li>✓ Re-Credentialing</li><li>✓ Credentialing Verification</li><li>✓ Provider Enrollment</li></ul><button class="btn s" style="width:100%" onclick="toast(\'Request received — we will contact you\')">Get Started</button></div>';
  html+='<div class="card"><div style="font-size:1.4rem;margin-bottom:8px">🖥️</div><div style="font-weight:750;font-size:1.15rem;margin-bottom:6px">Virtual Assistant</div><div style="color:var(--muted);font-size:.85rem;margin-bottom:12px">Full-time dedicated VA</div><div style="font-size:1.75rem;font-weight:800;margin-bottom:4px">$1,500 <span style="font-size:.9rem;font-weight:500;color:var(--muted)">/ month</span></div><div style="color:var(--muted);font-size:.8rem;margin-bottom:14px">5 days/week × 9 hrs/day — or $10 / hour</div><ul style="list-style:none;padding:0;margin:0 0 16px;font-size:.88rem;line-height:1.8"><li>✓ Appointment Scheduling</li><li>✓ Patient Follow-ups</li><li>✓ Data Entry & Documentation</li><li>✓ Admin Support</li></ul><button class="btn s" style="width:100%" onclick="toast(\'Request received — we will contact you\')">Get Started</button></div>';
  html+='</div>';
  html+='<h2 style="font-size:1.2rem;font-weight:700;margin:8px 0 14px">All Services & Pricing</h2>';
  html+='<div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">';
  var services=[['📄','Medical Billing Package','5% or $15/hr','Coding, Rejection Handling, AR, Denial Mgmt, Eligibility, Prior Auth, Payment Posting & Reporting'],['🔐','Credentialing Services','$150','per application'],['🖥️','Virtual Assistant','$1,500/mo or $10/hr','5 days/week, 9 hrs/day — or hourly'],['📈','Digital Marketing','$500/mo','without website'],['🌐','Digital Marketing + Website','$700','first month, then $500/mo'],['⌨️','Virtual Medical Scribe','$12/hr','per hour']];
  services.forEach(function(s){html+='<div class="card" style="padding:16px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span style="font-size:1.2rem">'+s[0]+'</span><b style="font-size:.95rem">'+s[1]+'</b></div><div style="font-size:1.2rem;font-weight:800;color:#5eead4">'+s[2]+'</div><div style="font-size:.78rem;color:var(--muted);margin-top:4px">'+s[3]+'</div></div>'});
  html+='</div>';
  html+='<div class="card" style="margin-top:20px;text-align:center;padding:28px"><div style="font-weight:750;font-size:1.15rem;margin-bottom:8px">Ready to Hire Our Team?</div><p class="sub" style="margin-bottom:16px">Tell us what you need — we will get back within 24 hours.</p><button class="btn" onclick="toast(\'Quote request sent!\')">Request a Quote</button></div>';
  return html;
}
function pageMemberHome(){var html='<h1>Member Home</h1><p class="sub">Members see and answer member questions only. Admin tools stay hidden.</p>';if(!isApproved())html+='<div class="pending-banner"><b>Approval pending.</b> Admin approve karega. Uske baad aap question post kar sakte ho — woh aapko, doosre members ko, aur admin ko dikhegi.</div>';var mine=getPosts().filter(function(p){return p.user_id===currentUser.id});html+='<div class="stats"><div class="card stat"><div class="l">My questions</div><div class="v">'+mine.length+'</div></div><div class="card stat"><div class="l">Status</div><div class="v" style="font-size:1.1rem">'+(isApproved()?'Approved':'Pending')+'</div></div></div>';if(!useCloud)html+='<div class="pending-banner"><b>Shared mode off.</b> Owner: run supabase-setup.sql in Supabase SQL Editor.</div>';return html}
function pageAdminOverview(){
  var profiles=getProfiles(),posts=getPosts();
  var waiting=profiles.filter(function(p){return p.status==='pending'&&!isAdminEmail(p.email)});
  var approved=profiles.filter(function(p){return p.status==='approved'}).length;
  var html='<h1>Approve members</h1><p class="sub">Yahan se approval do. Approve ke baad unki questions aapko, unko, aur baaki members ko dikhengi.</p>';
  html+='<div class="stats"><div class="card stat"><div class="l">Waiting</div><div class="v">'+waiting.length+'</div></div><div class="card stat"><div class="l">Approved</div><div class="v">'+approved+'</div></div><div class="card stat"><div class="l">Questions</div><div class="v">'+posts.length+'</div></div></div>';
  html+='<div class="card"><h2 style="font-size:1.05rem;margin-bottom:12px">Pending approval</h2>';
  if(!waiting.length) html+='<p class="empty">Koi naya member wait nahi kar raha.</p>';
  else waiting.forEach(function(p){
    html+='<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--border)">';
    html+='<div><b>'+esc((p.first||'')+' '+(p.last||''))+'</b><div style="color:var(--muted);font-size:.85rem">'+esc(p.email||'')+' · '+esc(p.specialty||'No specialty')+'</div></div>';
    html+='<div><button class="btn s ok" data-approve="'+esc(p.id)+'">Approve</button> <button class="btn s d" data-reject="'+esc(p.id)+'">Reject</button></div></div>';
  });
  html+='</div>';
  html+='<p class="sub">Approved members ki baat <b>All Questions</b> mein aapko dikhegi. Woh khud bhi apni post dekhenge, aur doosre members bhi.</p>';
  return html;
}
function pageAdminMembers(){var profiles=getProfiles().slice().sort(function(a,b){return String(b.created||'').localeCompare(String(a.created||''))});var html='<h1>Members</h1><p class="sub">Grant Official or Admin. New users = members only.</p>';if(!profiles.length)return html+'<div class="card empty">No members yet</div>';html+='<div class="card"><div class="table-wrap"><table><tr><th>Name</th><th>Email</th><th>Specialty</th><th>Role</th><th>Status</th><th>Actions</th></tr>';profiles.forEach(function(p){var isSuper=isAdminEmail(p.email);html+='<tr><td>'+esc((p.first||'')+' '+(p.last||''))+'</td><td>'+esc(p.email||'—')+'</td><td>'+esc(p.specialty||'—')+'</td><td>'+roleBadge(p)+(isSuper?' <span class="pill ok">Owner</span>':'')+'</td><td><span class="pill '+(p.status==='approved'?'ok':p.status==='rejected'?'bad':'warn')+'">'+esc(p.status||'pending')+'</span></td><td style="white-space:nowrap">';if(isSuper)html+='<span style="color:var(--muted);font-size:.8rem">Main admin</span>';else{if(p.status!=='approved')html+='<button class="btn s ok" data-approve="'+esc(p.id)+'">Approve</button> ';if(p.status!=='rejected')html+='<button class="btn s d" data-reject="'+esc(p.id)+'">Reject</button> ';if(p.role!=='official')html+='<button class="btn s o" data-make-official="'+esc(p.id)+'">Make Official</button> ';if(p.role!=='admin')html+='<button class="btn s" data-make-admin="'+esc(p.id)+'">Make Admin</button> ';if(p.role==='admin'||p.role==='official')html+='<button class="btn s o" data-make-member="'+esc(p.id)+'">Make Member</button>'}html+='</td></tr>'});html+='</table></div></div>';return html}
function pageFeed(){var q=(window._feedQ||'').toLowerCase();var posts=getPosts().filter(canSeePost).filter(function(p){if(!q)return true;return (p.title||'').toLowerCase().indexOf(q)>-1||(p.body||'').toLowerCase().indexOf(q)>-1});var html='<h1>'+(isAdmin()?'All Questions (admin)':'Member Questions')+'</h1><p class="sub">'+(isAdmin()?'You see every question, including private and official.':'Only questions from members. You can answer them here.')+'</p><div class="bar"><input class="search-bar" id="feedSearch" placeholder="Search..." value="'+esc(window._feedQ||'')+'"><button class="btn s o" id="refreshFeed">Refresh</button></div>';if(!isApproved()&&!isAdmin())html+='<div class="pending-banner">Pending approval.</div>';if(!posts.length)return html+'<div class="card empty">No questions yet.</div>';var likes=getLikes(),comments=getComments();posts.forEach(function(p){var likeCount=likes.filter(function(l){return l.post_id===p.id}).length;var liked=likes.some(function(l){return l.post_id===p.id&&l.user_id===currentUser.id});var pcs=comments.filter(function(c){return c.post_id===p.id});html+='<div class="card"><div class="post-title">'+esc(p.title)+'</div>';var authorP=getProfile(p.user_id)||{};html+='<div class="post-meta"><span>'+esc(publicName(p.user_id))+'</span> '+roleBadge(authorP);var spec=publicSpec(p.user_id);if(spec)html+='<span>'+esc(spec)+'</span>';html+='<span>'+esc(String(p.created||'').slice(0,10))+'</span><span class="pill">'+esc(p.visibility||'members')+'</span></div><div class="post-body">'+esc(p.body)+'</div><div class="post-actions"><button class="btn s o" data-like="'+esc(p.id)+'">'+(liked?'♥':'♡')+' '+likeCount+'</button><span style="color:var(--muted);font-size:.85rem">'+pcs.length+' comments</span>';if(p.user_id===currentUser.id||isAdmin())html+='<button class="btn s d" data-del-post="'+esc(p.id)+'">Delete</button>';html+='</div>';pcs.forEach(function(c){var cp=getProfile(c.user_id)||{};html+='<div class="comment"><div class="who">'+esc(publicName(c.user_id))+' '+roleBadge(cp)+'</div><div>'+esc(c.body)+'</div></div>'});if(isApproved()||isAdmin())html+='<div class="bar" style="margin-top:12px;margin-bottom:0"><input placeholder="Comment..." data-cmt-input="'+esc(p.id)+'"><button class="btn s" data-cmt-send="'+esc(p.id)+'">Comment</button></div>';html+='</div>'});return html}
function pageNewPost(){if(!isApproved()&&!isAdmin())return '<h1>Ask a Question</h1><div class="pending-banner">Pending approval.</div>';var vis='<div class="vis-row"><label><input type="radio" name="vis" value="members" checked> All members</label>';if(isOfficial()||isAdmin())vis+='<label><input type="radio" name="vis" value="official"> Official only</label>';vis+='<label><input type="radio" name="vis" value="private"> Only me</label></div>';return '<h1>Ask a Question</h1><p class="sub">'+(isAdmin()?'Admin post — members only see questions from members.':'Your question is visible to other members.')+'</p><div class="card"><div class="auth-field"><label>Title</label><input id="npTitle" placeholder="Title"></div><div class="auth-field"><label>Details</label><textarea id="npBody" rows="5"></textarea></div>'+vis+'<button class="btn" id="npSubmit">Post question</button></div>'}
function pageSeeAll(){
  var posts=getPosts().slice().sort(function(a,b){return String(b.created||'').localeCompare(String(a.created||''))});
  var html='<h1>See all</h1><p class="sub">Admin only. Har question, answer, reaction, aur har member ki personal chat.</p>';
  html+='<div class="stats"><div class="card stat"><div class="l">Questions</div><div class="v">'+posts.length+'</div></div><div class="card stat"><div class="l">Answers</div><div class="v">'+getComments().length+'</div></div><div class="card stat"><div class="l">Reactions</div><div class="v">'+getLikes().length+'</div></div><div class="card stat"><div class="l">Messages</div><div class="v">'+getChat().filter(function(m){return dmParse(m.body)}).length+'</div></div></div>';
  html+='<h2 style="font-size:1.05rem;margin:8px 0 10px">All questions</h2>';
  if(!posts.length) html+='<div class="card empty">Koi question nahi.</div>';
  posts.forEach(function(post){
    var author=getProfile(post.user_id)||{};
    var pcs=getComments().filter(function(x){return x.post_id===post.id});
    var likes=getLikes().filter(function(x){return x.post_id===post.id}).length;
    html+='<div class="card"><div class="post-title">'+esc(post.title)+'</div><div class="post-meta"><span>'+esc(publicName(post.user_id))+'</span> '+roleBadge(author)+'<span class="pill">'+esc(post.visibility||'members')+'</span><span>'+likes+' reactions</span><span>'+pcs.length+' answers</span></div><div class="post-body">'+esc(post.body)+'</div>';
    pcs.forEach(function(cm){html+='<div class="comment"><div class="who">'+esc(publicName(cm.user_id))+'</div><div>'+esc(cm.body)+'</div></div>'});
    html+='</div>';
  });
  html+='<h2 style="font-size:1.05rem;margin:8px 0 10px">Personal chats</h2>';
  var members=getProfiles().filter(function(pr){return pr.role!=='admin'&&!isAdminEmail(pr.email)});
  var any=false;
  members.forEach(function(pr){
    var msgs=threadMsgs(pr.id);
    if(!msgs.length) return;
    any=true;
    html+='<div class="card"><b>'+esc((pr.first||'')+' '+(pr.last||''))+'</b> <span style="color:var(--muted);font-size:.85rem">'+esc(pr.email||'')+'</span>';
    msgs.forEach(function(m){var d=dmParse(m.body);html+='<div class="chat-msg"><div class="who">'+(m.user_id===currentUser.id?'Admin':esc(publicName(m.user_id)))+'</div><div>'+esc(d?d.text:'')+'</div></div>'});
    html+='</div>';
  });
  if(!any) html+='<div class="card empty">Koi personal message nahi.</div>';
  return html;
}
function dmParse(body){var m=/^@@to:([0-9a-fA-F-]{36})@@([\s\S]*)$/.exec(body||'');if(!m)return null;return{to:m[1],text:m[2]}}
function adminProfile(){return getProfiles().find(function(p){return p.role==='admin'||isAdminEmail(p.email)})||null}
function threadMsgs(memberId){var admin=adminProfile();var aid=admin&&admin.id;return getChat().filter(function(m){var d=dmParse(m.body);if(!d||!aid)return false;var peer=m.user_id===aid?d.to:m.user_id;return peer===memberId&&(m.user_id===aid||d.to===aid)}).sort(function(a,b){return String(a.created||'').localeCompare(String(b.created||''))})}
function pageChat(){
  if(!isApproved()&&!isAdmin())return '<h1>Admin Chat</h1><div class="pending-banner">Approval ke baad admin aap se chat kar sakta hai.</div>';
  var admin=adminProfile();
  if(!isAdmin()){
    var html='<h1>Chat with Admin</h1><p class="sub">Sirf admin se. Doosre members se chat nahi.</p><div class="card"><div class="chat-box">';
    if(!admin)return html+'<div class="empty">Admin abhi available nahi.</div></div></div>';
    var msgs=threadMsgs(currentUser.id);
    if(!msgs.length)html+='<div class="empty">Abhi koi message nahi.</div>';
    msgs.forEach(function(m){var d=dmParse(m.body);var mine=m.user_id===currentUser.id;html+='<div class="chat-msg" style="'+(mine?'margin-left:18%':'margin-right:18%')+'"><div class="who">'+(mine?'You':'Admin')+'</div><div>'+esc(d?d.text:'')+'</div></div>'});
    html+='</div><div class="bar" style="margin:0"><input id="chatInput" placeholder="Message admin..."><button class="btn" id="chatSend" data-to="'+esc(admin.id)+'">Send</button></div></div>';
    return html;
  }
  var members=getProfiles().filter(function(p){return p.id!==currentUser.id&&p.role!=='admin'&&!isAdminEmail(p.email)&&p.status==='approved'});
  if(!window._chatWith||!members.some(function(p){return p.id===window._chatWith}))window._chatWith=members[0]&&members[0].id;
  var html='<h1>Member Chat</h1><p class="sub">Aap kisi bhi approved member se alag chat kar sakte ho. Members ek doosre se nahi.</p>';
  html+='<div style="display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:12px" class="chat-grid">';
  html+='<div class="card" style="margin:0;max-height:520px;overflow:auto">';
  if(!members.length)html+='<p class="empty">Koi approved member nahi.</p>';
  members.forEach(function(p){html+='<button class="nav'+(p.id===window._chatWith?' on':'')+'" data-chat="'+esc(p.id)+'" style="margin-bottom:4px">'+esc((p.first||'')+' '+(p.last||''))+'</button>'});
  html+='</div><div class="card" style="margin:0"><div class="chat-box">';
  if(!window._chatWith)html+='<div class="empty">Member select karo.</div>';
  else{
    var msgs=threadMsgs(window._chatWith);
    if(!msgs.length)html+='<div class="empty">Is member se abhi koi message nahi.</div>';
    msgs.forEach(function(m){var d=dmParse(m.body);var mine=m.user_id===currentUser.id;html+='<div class="chat-msg" style="'+(mine?'margin-left:18%':'margin-right:18%')+'"><div class="who">'+(mine?'You':esc(publicName(m.user_id)))+'</div><div>'+esc(d?d.text:'')+'</div></div>'});
  }
  html+='</div>';
  if(window._chatWith)html+='<div class="bar" style="margin:0"><input id="chatInput" placeholder="Message member..."><button class="btn" id="chatSend" data-to="'+esc(window._chatWith)+'">Send</button></div>';
  html+='</div></div>';
  return html;
}
function pageProfile(){var p=getProfile(currentUser.id)||{},photo=p.photo||'',letter=(currentUser.first||'?')[0].toUpperCase();var html='<h1>My Profile</h1><div class="card" style="max-width:480px">';if(photo)html+='<img class="profile-photo" src="'+photo+'" alt="">';else html+='<div class="profile-photo-ph">'+letter+'</div>';html+='<label class="photo-btn">Change photo<input type="file" id="photoInput" accept="image/*"></label><div style="margin-bottom:12px">'+roleBadge(p.role?p:{role:role,status:status})+'</div>';html+='<div class="auth-field"><label>Name</label><input value="'+esc(currentUser.first+' '+currentUser.last)+'" disabled style="opacity:.7"></div>';html+='<div class="auth-field"><label>Email</label><input value="'+esc(currentUser.email)+'" disabled style="opacity:.7"></div>';html+='<div class="auth-field"><label>Specialty</label><input value="'+esc(currentUser.specialty)+'" disabled style="opacity:.7"></div>';html+='<div class="auth-field"><label>Role</label><input value="'+esc(role)+'" disabled style="opacity:.7"></div></div>';return html}
function bindPageEvents(){
  var pi=document.getElementById('photoInput');if(pi)pi.onchange=function(e){var f=e.target.files&&e.target.files[0];if(!f)return;if(f.size>900000){toast('Image too large');return}var r=new FileReader();r.onload=async function(){await upsertProfileCloud({id:currentUser.id,photo:r.result});toast('Photo updated');render()};r.readAsDataURL(f)};
  var rf=document.getElementById('refreshFeed');if(rf)rf.onclick=async function(){await loadAllData();toast('Refreshed');render()};
  document.querySelectorAll('[data-approve]').forEach(function(btn){btn.onclick=async function(){if(!isAdmin())return;await upsertProfileCloud({id:btn.getAttribute('data-approve'),status:'approved'});toast('Approved');render()}});
  document.querySelectorAll('[data-reject]').forEach(function(btn){btn.onclick=async function(){if(!isAdmin())return;await upsertProfileCloud({id:btn.getAttribute('data-reject'),status:'rejected',role:'member'});toast('Rejected');render()}});
  document.querySelectorAll('[data-make-official]').forEach(function(btn){btn.onclick=async function(){if(!isAdmin())return;var id=btn.getAttribute('data-make-official');var p=getProfile(id);if(p&&isAdminEmail(p.email))return;await upsertProfileCloud({id:id,role:'official',status:'approved'});toast('Official granted');render()}});
  document.querySelectorAll('[data-make-admin]').forEach(function(btn){btn.onclick=async function(){if(!isAdmin())return;var id=btn.getAttribute('data-make-admin');var p=getProfile(id);if(p&&isAdminEmail(p.email))return;await upsertProfileCloud({id:id,role:'admin',status:'approved'});toast('Admin granted');render()}});
  document.querySelectorAll('[data-make-member]').forEach(function(btn){btn.onclick=async function(){if(!isAdmin())return;var id=btn.getAttribute('data-make-member');var p=getProfile(id);if(p&&isAdminEmail(p.email)){toast('Cannot demote owner');return}await upsertProfileCloud({id:id,role:'member',status:'approved'});toast('Set Member');render()}});
  var fs=document.getElementById('feedSearch');if(fs){fs.oninput=function(){window._feedQ=fs.value};fs.onkeydown=function(e){if(e.key==='Enter'){window._feedQ=fs.value;render()}}}
  var np=document.getElementById('npSubmit');if(np)np.onclick=async function(){var title=(document.getElementById('npTitle').value||'').trim(),body=(document.getElementById('npBody').value||'').trim(),vis=(document.querySelector('input[name=vis]:checked')||{}).value||'members';if(!title||!body){toast('Title and details required');return}await addPostCloud({user_id:currentUser.id,title:title,body:body,visibility:vis});toast('Posted');idx=isAdmin()?2:1;render()};
  document.querySelectorAll('[data-like]').forEach(function(btn){btn.onclick=async function(){await toggleLikeCloud(btn.getAttribute('data-like'),currentUser.id);render()}});
  document.querySelectorAll('[data-del-post]').forEach(function(btn){btn.onclick=async function(){await deletePostCloud(btn.getAttribute('data-del-post'));toast('Deleted');render()}});
  document.querySelectorAll('[data-cmt-send]').forEach(function(btn){btn.onclick=async function(){var pid=btn.getAttribute('data-cmt-send');var inp=document.querySelector('[data-cmt-input="'+pid+'"]');var body=(inp&&inp.value||'').trim();if(!body)return;await addCommentCloud({post_id:pid,user_id:currentUser.id,body:body});render()}});
  document.querySelectorAll('[data-chat]').forEach(function(btn){btn.onclick=function(){window._chatWith=btn.getAttribute('data-chat');render()}});
var cs=document.getElementById('chatSend');if(cs)cs.onclick=async function(){var inp=document.getElementById('chatInput');var body=(inp&&inp.value||'').trim();var to=cs.getAttribute('data-to');if(!body||!to)return;await addChatCloud({user_id:currentUser.id,body:'@@to:'+to+'@@'+body});render()};
}
(async function init(){var sess=await sb.auth.getSession();if(sess.data&&sess.data.session&&sess.data.session.user)await enterApp(sess.data.session.user);sb.auth.onAuthStateChange(function(event){if(event==='SIGNED_OUT'){currentUser=null;document.getElementById('app').classList.remove('show');document.getElementById('authScreen').style.display=''}})})();
