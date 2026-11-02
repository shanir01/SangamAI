(function(){
"use strict";
var HI={"nav_what": "क्या है", "nav_feat": "Features", "nav_keys": "Free keys", "nav_setup": "Setup", "nav_connect": "Connect", "nav_faq": "FAQ", "star": "Star", "hero_pill": "SangamAI · 100% free · open source · आपके PC और phone पर चलता है", "hero_h1": "सारी free AI APIs.<br><span class=\"grad\">एक endpoint.</span>", "hero_sub": "अपनी free Gemini, Groq, OpenRouter और Mistral keys एक आसान web page में paste करें। <code>localhost</code> पर एक OpenAI-compatible endpoint पाएँ। एक provider की limit खत्म होते ही अगला provider अपने आप जवाब देता है।", "cta_start": "2 मिनट में शुरू करें", "cta_star": "GitHub पर Star करें", "hero_note": "कोई card नहीं। कोई server नहीं। हमारे यहाँ कोई sign-up नहीं। आपकी keys आपके device पर ही रहती हैं।", "flow_app": "आपका app", "flow_router": "SangamAI", "flow_caption": "Live demo: Groq की limit खत्म (429) → वही request Gemini को → आपके app को जवाब मिल गया।", "st1": "free providers", "st2": "dependencies", "st3": "OpenAI-compatible endpoint", "st4": "चलाने का खर्च", "what_eyebrow": "यह क्या है", "what_h": "आपका अपना AI gateway, आपके अपने device पर", "what_p": "बड़ी AI companies हर developer को रोज़ का free quota देती हैं। SangamAI इन सब free quotas को जोड़कर <b>एक</b> API बना देता है, जिसे हर OpenAI app पहले से समझता है। एक key की limit खत्म? यह चुपचाप अगले पर चला जाता है।", "w1_t": "1 · Free keys paste करें", "w1_p": "Setup page खोलें, “Get free key” दबाएँ, key paste करें, Test दबाएँ।", "w2_t": "2 · एक URL इस्तेमाल करें", "w2_p": "किसी भी app में <code>http://localhost:8787/v1</code> और model <code>auto</code> डालें।", "w3_t": "3 · कभी नहीं अटकेंगे", "w3_p": "Limit खत्म, error या timeout → वही request अगले provider को।", "honest": "<b>सच्ची बात:</b> कुछ भी “unlimited” नहीं है। हर provider की daily limit होती है। यह app उन्हें <b>जोड़</b> देता है, ताकि आपको किसी एक key से कहीं ज़्यादा free requests मिलें।", "feat_eyebrow": "Features", "feat_h": "जो चाहिए, सब है। जो नहीं चाहिए, वो नहीं।", "f0_t": "Auto-fallback", "f0_p": "एक provider पर 429, quota, 5xx, timeout या credits खत्म → वही request अगले provider को।", "f1_t": "Round-robin", "f1_p": "Model <code>auto</code> हर request पर provider बदलता है, ताकि free limits बराबर इस्तेमाल हों।", "f2_t": "OpenAI-compatible", "f2_p": "<code>/v1/chat/completions</code> (normal + streaming) और <code>/v1/models</code>। OpenAI SDKs, n8n, LangChain, Continue, Cline के साथ चलता है।", "f3_t": "Setup page", "f3_p": "Browser में keys paste करें, असली provider से test करें, save करें। कोई file edit नहीं।", "f4_t": "Live dashboard", "f4_p": "हर provider के tokens और requests, कौन live है, और fallback log।", "f5_t": "Playground", "f5_p": "Browser में chat करें। हर जवाब में दिखता है किस provider ने और कितनी जल्दी जवाब दिया।", "f6_t": "Android पर चलता है", "f6_p": "आपके phone पर Termux में पूरा router चलता है। एक command: <code>sh start.sh</code>।", "f7_t": "Zero dependencies", "f7_p": "सिर्फ़ Node.js 20+। कोई <code>npm install</code>, Docker या database नहीं।", "f8_t": "शुरू से सुरक्षित", "f8_p": "सिर्फ़ localhost पर चलता है। सिर्फ़ free models call होते हैं। Keys कभी logs में नहीं आतीं।", "keys_eyebrow": "API keys कहाँ मिलेंगी", "keys_h": "अपनी free API keys लें", "keys_p": "आपको <b>कम से कम एक</b> key चाहिए। ज़्यादा keys = ज़्यादा free requests। हर key में लगभग एक मिनट लगता है। इन्हें private रखें: chat, screenshot या GitHub पर कभी न डालें।", "k_best": "सबसे अच्छी शुरुआत", "k_open": "खोलें", "k_groq_0": "<b>console.groq.com/keys</b> खोलें", "k_groq_1": "Google, GitHub या email से sign up करें", "k_groq_2": "<b>Create API Key</b> दबाएँ, कोई भी नाम दें", "k_groq_3": "Key copy करें (<code>gsk_</code> से शुरू)। यह सिर्फ़ एक बार दिखती है!", "k_gemini_0": "<b>aistudio.google.com/apikey</b> खोलें", "k_gemini_1": "अपने Google account से sign in करें", "k_gemini_2": "<b>Create API key</b> दबाएँ", "k_gemini_3": "Key copy करें (<code>AIza</code> से शुरू)", "k_openrouter_0": "<b>openrouter.ai/keys</b> खोलें", "k_openrouter_1": "Google, GitHub या email से sign in करें", "k_openrouter_2": "<b>Create Key</b> दबाएँ", "k_openrouter_3": "Key copy करें (<code>sk-or-</code> से शुरू)। Credits की ज़रूरत नहीं: सिर्फ़ <code>:free</code> models चलते हैं", "k_mistral_0": "<b>console.mistral.ai/api-keys</b> खोलें", "k_mistral_1": "Sign up करें और <b>free</b> plan चुनें (phone verify करने को कह सकता है)", "k_mistral_2": "<b>Create new key</b> दबाएँ", "k_mistral_3": "Key copy करें और Setup page पर paste करें", "paste_tip": "फिर: <code>http://localhost:8787</code> खोलें → <b>Setup</b> → key उसके card में paste करें → <b>Test</b> (✓) → <b>Save keys</b>। तुरंत काम करता है, restart की ज़रूरत नहीं।", "lim_h": "Free limits (Nov 2026 में check किया)", "lim_c1": "Provider", "lim_c2": "Free limit", "lim_c3": "ध्यान रखें", "lim_groq": "30 req/min · 1,000 req/day हर model पर", "lim_groq_n": "सबसे तेज़। हर model पर 200K tokens/day।", "lim_gem": "AI Studio में दिखती है (हर model की)", "lim_gem_n": "Pacific midnight पर reset। Free tier पर Google आपके prompts अपने products सुधारने में इस्तेमाल कर सकता है।", "lim_or": "20 req/min · 50 req/day (पूरे account पर)", "lim_or_n": "अगर कभी $10 के credits लिए हों तो 1,000/day।", "lim_mi": "Monthly free usage (Limits page पर देखें)", "lim_mi_n": "अच्छा all-rounder model: mistral-small।", "card_warn": "⚠️ इन free accounts में <b>कभी credit card न जोड़ें</b>। Card नहीं होगा तो limit खत्म होने पर बस वह provider रुकेगा: कोई पैसा नहीं कटेगा।", "pc_eyebrow": "PC setup", "pc_h": "Windows, Mac या Linux पर चलाएँ", "pc_p": "Node.js 20 या नया चाहिए। अगर नहीं है तो start script इसे खुद install करने की कोशिश करती है।", "tab_win": "Windows", "tab_mac": "Mac / Linux", "win1": "GitHub पर <b>Code → Download ZIP</b> दबाएँ, फिर ZIP पर right-click → <b>Extract All</b>।", "win2": "Folder खोलें और <b>start.bat</b> पर double-click करें। (Node.js नहीं है? यह winget से install करेगा, या nodejs.org से लें।)", "win3": "आपका browser <b>http://localhost:8787</b> पर Setup page खोलेगा। Keys paste करें → Test → Save।", "win4": "इस्तेमाल करते समय काली window खुली रखें। बंद करने पर router रुक जाएगा।", "mac1": "Terminal खोलें और चलाएँ:", "mac2": "Browser <b>http://localhost:8787</b> खोलेगा। Keys paste करें → Test → Save।", "mac3": "<b>Ctrl + C</b> से रोकें। फिर कभी भी <code>sh start.sh</code> से चालू करें।", "mob_eyebrow": "Mobile setup", "mob_h": "अपने Android phone पर चलाएँ (Termux)", "mob_p": "आपका phone आपका अपना AI server बन जाता है। पहली बार लगभग 5 मिनट लगते हैं।", "m0": "<b>f-droid.org</b> से <b>F-Droid</b> install करें, फिर F-Droid से <b>Termux</b> install करें। (Play Store वाला version पुराना है, उसे न लें।)", "m1": "Termux खोलें और packages update करें (कुछ पूछे तो Enter दबाएँ):", "m2": "git install करें और router download करें:", "m3": "इसे चालू करें। पहली बार Node.js अपने आप install होगा:", "m4": "Chrome में <b>http://localhost:8787</b> खुलेगा। अपनी free keys paste करें → Test → Save keys।", "m5": "उसी phone के किसी भी AI app में <code>http://localhost:8787/v1</code> डालें। Termux चालू रखें (script wake-lock लगा देती है)।", "m6": "अगली बार बस Termux खोलें और चलाएँ:", "mob_tip": "💡 Tip: अगर Android background में Termux बंद कर दे, तो phone Settings → Apps → Termux → Battery → <b>Unrestricted</b> करें।", "con_eyebrow": "अपना app जोड़ें", "con_h": "जो भी OpenAI समझता है, उसके साथ चलता है", "con_p": "अपने app में सिर्फ़ दो settings बदलें। बाकी router कर देगा।", "cs_base": "Base URL", "cs_key": "API key", "cs_model": "Model", "cs_key_v": "कुछ भी, जैसे <code>local</code>", "n8n1": "n8n में: <b>Credentials → New → OpenAI API</b>", "n8n2": "API Key: <code>local</code> · Base URL: <code>http://localhost:8787/v1</code>", "n8n3": "OpenAI Chat Model node में model <b>By ID</b> से <code>auto</code> रखें।", "n8n4": "n8n Docker में है? <code>http://host.docker.internal:8787/v1</code> इस्तेमाल करें और router को <code>HOST=0.0.0.0</code> + <code>MASTER_KEY</code> के साथ चलाएँ।", "models_h": "आप कौन से models माँग सकते हैं", "mo_auto": "सब providers बारी-बारी, fallback के साथ (default)", "mo_fast": "छोटे, तेज़ models पहले", "mo_smart": "बड़े models पहले", "mo_long": "Gemini पहले (1M-token context)", "q0": "क्या यह सच में unlimited है?", "a0": "नहीं। हर provider की daily free limit होती है। SangamAI उन limits को जोड़ता है और अपने आप switch करता है, इसलिए आपको एक key से कहीं ज़्यादा मिलता है, ₹0 में।", "q1": "क्या इसका कोई खर्च है?", "a1": "नहीं। Code free है (MIT), keys free हैं, और यह आपके अपने PC या phone पर चलता है। बस provider accounts में card न जोड़ें।", "q2": "मेरी keys कहाँ save होती हैं?", "a2": "सिर्फ़ आपके device पर, folder के अंदर <code>keys.local.json</code> में (यह git-ignored है)। Dashboard सिर्फ़ पहले और आखिरी 4 अक्षर दिखाता है। हमें कुछ नहीं भेजा जाता।", "q3": "पहले कौन सी key लूँ?", "a3": "Groq: सबसे बड़ी daily free limit और बहुत तेज़। फिर लंबे documents के लिए Gemini जोड़ें।", "q4": "मुझे “503 no_api_keys” आ रहा है। अब क्या?", "a4": "अभी कोई key save नहीं हुई। <code>http://localhost:8787</code> → Setup खोलें, key paste करें, Test दबाएँ, फिर Save keys।", "q5": "Test पर 401 आ रहा है। क्यों?", "a5": "Key गलत है या copy करते समय कट गई। Provider के page से फिर से copy करें।", "q6": "क्या मेरे Wi-Fi के दूसरे devices इसे इस्तेमाल कर सकते हैं?", "a6": "हाँ: इसे <code>HOST=0.0.0.0</code> के साथ चलाएँ और <code>MASTER_KEY</code> सेट करें (सुरक्षा के लिए ज़रूरी), फिर <code>http://&lt;your-local-IP&gt;:8787/v1</code> इस्तेमाल करें।", "q7": "क्या मैं इसे दोस्तों के लिए online host कर सकता हूँ?", "a7": "हाँ, Server mode से (default में बंद): daily token limit वाली user keys और Render one-click deploy। सब users <b>आपकी</b> free limits share करेंगे, इसलिए पहले हर provider की terms पढ़ें।", "faq_h": "सवाल और जवाब", "cta_h": "पसंद आया? एक ⭐ दीजिए", "cta_p": "एक star से और लोगों को free AI मिलती है। बस एक tap, और बहुत मायने रखता है।", "cta_share": "X पर share करें", "credit": "<b>Nishu</b> (Nirbhay Sharma) ने ❤️ से बनाया। Waseem Nasir के <a href=\"https://github.com/waseemnasir2k26/free-llm-router\" target=\"_blank\" rel=\"noopener\">free-llm-router</a> पर आधारित (MIT License)।", "foot_note": "Google, Groq, OpenRouter या Mistral से कोई संबंध नहीं। Free limits बदलती रहती हैं; हर provider का page देखें।", "copy": "Copy", "copied": "Copied ✓", "meaning": "<b>संगम</b> वह जगह है जहाँ नदियाँ मिलती हैं। SangamAI में हर free AI एक API में मिलती है।", "app_eyebrow": "App", "app_h": "सिर्फ़ API नहीं, एक पूरा app", "app_p": "Setup, Dashboard, Playground और Connect pages आपके browser में <code>localhost:8787</code> पर चलते हैं। (Screenshots demo data के साथ।)"};
var root=document.documentElement;root.classList.add("js");
var EN={};
document.querySelectorAll("[data-i18n]").forEach(function(el){var k=el.getAttribute("data-i18n");if(!(k in EN))EN[k]=el.innerHTML;});
var lang="en";
function setLang(l){
  lang=l;var dict=l==="hi"?HI:EN;
  document.querySelectorAll("[data-i18n]").forEach(function(el){var k=el.getAttribute("data-i18n");if(dict[k]!=null)el.innerHTML=dict[k];});
  root.setAttribute("lang",l==="hi"?"hi":"en");
  document.querySelectorAll("#lang [data-l]").forEach(function(s){s.classList.toggle("on",s.getAttribute("data-l")===l);});
  try{localStorage.setItem("sangam-lang",l);}catch(e){}
}
var btn=document.getElementById("lang");
if(btn)btn.addEventListener("click",function(){setLang(lang==="en"?"hi":"en");});
var q=(location.search.match(/[?&]lang=(en|hi)/)||[])[1];var saved=null;try{saved=localStorage.getItem("sangam-lang");}catch(e){}
if(q||saved)setLang(q||saved);

/* reveal on scroll */
var els=document.querySelectorAll(".reveal");
if("IntersectionObserver" in window){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{rootMargin:"0px 0px -8% 0px",threshold:0.08});
  els.forEach(function(el){io.observe(el);});
}else{els.forEach(function(el){el.classList.add("in");});}

/* tabs */
document.querySelectorAll("[data-tabs]").forEach(function(tl){
  var g=tl.getAttribute("data-tabs");var bs=tl.querySelectorAll("[data-tab]");
  function show(id){bs.forEach(function(b){var on=b.getAttribute("data-tab")===id;b.classList.toggle("on",on);b.setAttribute("aria-selected",on?"true":"false");});
    document.querySelectorAll('[data-panel^="'+g+':"]').forEach(function(p){var on=p.getAttribute("data-panel")===g+":"+id;p.hidden=!on;if(on)p.classList.add("in");});}
  bs.forEach(function(b){b.addEventListener("click",function(){show(b.getAttribute("data-tab"));});});
  show(bs[0].getAttribute("data-tab"));
});

/* copy */
function copyText(t,b){
  function ok(){var s=b.querySelector("[data-i18n]");b.classList.add("done");if(s)s.innerHTML=(lang==="hi"?HI:EN).copied||"Copied ✓";
    setTimeout(function(){b.classList.remove("done");if(s)s.innerHTML=(lang==="hi"?HI:EN).copy||"Copy";},1600);}
  if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(ok,fallback);}else fallback();
  function fallback(){var ta=document.createElement("textarea");ta.value=t;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(e){}document.body.removeChild(ta);ok();}
}
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-copy],[data-copytext]");if(!b)return;
  var t=b.getAttribute("data-copytext");if(t==null){var c=b.parentNode.querySelector("code");t=c?c.textContent:"";}
  copyText(t,b);
});
if(!HI.copied){HI.copied="Copied ✓";}

/* phone terminal typing */
var lines=document.querySelectorAll(".tline");var phone=document.querySelector(".phone");
function playPhone(){lines.forEach(function(l,i){setTimeout(function(){l.classList.add("show");},250+i*420);});}
if(phone&&"IntersectionObserver" in window){var pio=new IntersectionObserver(function(es){if(es[0].isIntersecting){playPhone();pio.disconnect();}},{threshold:.3});pio.observe(phone);}else playPhone();

/* hero flow animation */
var svg=document.querySelector(".flow");if(!svg)return;
var pkt=document.getElementById("pkt"),log=document.getElementById("flowlog"),okb=document.getElementById("okbubble");
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var P={app:[86,150],router:[200,150]};
var provs=["groq","gemini","openrouter","mistral"];var names={groq:"Groq",gemini:"Gemini",openrouter:"OpenRouter",mistral:"Mistral"};
provs.forEach(function(p){var y={groq:45,gemini:115,openrouter:185,mistral:255}[p];P[p]=[322,y];});
function bez(p,t){var y=P[p][1];var p0=[240,150],p1=[280,150],p2=[290,y],p3=[322,y];var u=1-t;
  return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]];}
function seg(kind,p){ if(kind==="in")return function(t){return [86+(160-86)*t,150];};
  if(kind==="out")return function(t){return t<.3?[160+(240-160)*(t/.3),150]:bez(p,(t-.3)/.7);};
  if(kind==="back")return function(t){var r=seg("out",p);return r(1-t);};
  return function(t){return [160+(86-160)*t,150];};}
function move(fn,ms){return new Promise(function(res){var s=null;function f(ts){if(!s)s=ts;var t=Math.min(1,(ts-s)/ms);var e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;var pt=fn(e);pkt.setAttribute("cx",pt[0]);pkt.setAttribute("cy",pt[1]);if(t<1)requestAnimationFrame(f);else res();}requestAnimationFrame(f);});}
function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
function node(id){return document.getElementById("n-"+id);}
function link(id){return document.getElementById("l-"+id);}
function say(html){var d=document.createElement("div");d.innerHTML=html;log.appendChild(d);while(log.children.length>3)log.removeChild(log.firstChild);}
var scen=[["groq","gemini"],["gemini","mistral"],["openrouter","groq"],["mistral","openrouter"]];var n=0;
function reset(){provs.forEach(function(p){node(p).classList.remove("bad","good");link(p).classList.remove("hot","bad","good");});node("app").classList.remove("ok");okb.classList.remove("on");pkt.setAttribute("class","");}
async function cycle(){
  var s=scen[n++%scen.length],fail=s[0],win=s[1];reset();
  say('→ POST /v1/chat/completions <span style="opacity:.6">model=auto</span>');
  pkt.setAttribute("class","on");await move(seg("in"),650);
  link(fail).classList.add("hot");await move(seg("out",fail),700);
  node(fail).classList.add("bad");link(fail).classList.replace("hot","bad");pkt.setAttribute("class","on red");
  say('<span class="e">✗ '+names[fail]+' → 429 rate limit · cooldown</span>');
  await wait(450);await move(seg("back",fail),500);
  pkt.setAttribute("class","on");link(win).classList.add("hot");await move(seg("out",win),700);
  node(win).classList.add("good");link(win).classList.replace("hot","good");pkt.setAttribute("class","on green");
  say('<span class="o">✓ fallback → '+names[win]+' · 200 OK</span>');
  await wait(350);await move(seg("back",win),550);await move(seg("ret"),600);
  node("app").classList.add("ok");okb.classList.add("on");pkt.setAttribute("class","");
  await wait(1600);
}
if(reduce){node("groq").classList.add("bad");node("gemini").classList.add("good");link("gemini").classList.add("good");okb.classList.add("on");say('<span class="e">✗ Groq → 429</span>');say('<span class="o">✓ fallback → Gemini · 200 OK</span>');return;}
var running=false,visible=true;
if("IntersectionObserver" in window){new IntersectionObserver(function(es){visible=es[0].isIntersecting;if(visible&&!running)loop();}).observe(svg);}
async function loop(){running=true;while(visible&&!document.hidden){try{await cycle();}catch(e){break;}}running=false;}
document.addEventListener("visibilitychange",function(){if(!document.hidden&&visible&&!running)loop();});
loop();
})();