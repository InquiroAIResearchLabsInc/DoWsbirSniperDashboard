// --- SAM.GOV API SCRAPER ---
const axios = require('axios');
const config = require('../config');
const SAM_API_ROOTS = ['https://api.sam.gov/opportunities','https://api.sam.gov/prod/opportunities'];
async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function parseRetryAfterMs(h={}){const ra=h['retry-after']||h['Retry-After'];if(ra==null)return null;const i=parseInt(ra,10);if(!Number.isNaN(i))return Math.max(i*1000,1000);const d=Date.parse(ra);if(!Number.isNaN(d))return Math.max(d-Date.now(),1000);return null;}
function diagnoseSamKey(k){if(!k)return'SAM_API_KEY is empty.';if(/\s/.test(k))return'SAM_API_KEY contains whitespace.';if(/[\"\']/.test(k))return'SAM_API_KEY contains quotes.';if(k.length<30)return`SAM_API_KEY too short (${k.length}).`;return null;}
function formatSamDate(d){return`${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;}
function postedDateRange(){const to=new Date(),from=new Date(to);from.setDate(from.getDate()-config.SAM_POSTED_LOOKBACK_DAYS);return{postedFrom:formatSamDate(from),postedTo:formatSamDate(to)};}
function daysRemaining(d){if(!d)return null;return Math.ceil((new Date(d)-new Date())/86400000);}
function parseFunding(desc=''){const m=desc.match(/\$([0-9,]+(?:\.[0-9]+)?)\s*(M|K|million|thousand)?/i);if(!m)return{min:null,max:null};let val=parseFloat(m[1].replace(/,/g,''));const u=(m[2]||'').toLowerCase();if(u==='m'||u==='million')val*=1e6;if(u==='k'||u==='thousand')val*=1e3;return{min:val*0.5,max:val};}
async function probeOnce(root,range,useHeader){const params={postedFrom:range.postedFrom,postedTo:range.postedTo,limit:1,offset:0};const headers={};if(useHeader)headers['X-API-KEY']=config.SAM_API_KEY;else params.api_key=config.SAM_API_KEY;return axios.get(`${root}/v2/search`,{params,headers,timeout:25000,validateStatus:()=>true});}
async function resolveSamApiRoot(range){
  const k=config.SAM_API_KEY||'';
  console.log(`  [sam] Using key: ${k.slice(0,3)}...${k.slice(-3)} (length ${k.length})`);
  for(const root of SAM_API_ROOTS){for(const useHeader of[false,true]){try{await sleep(config.RATE_LIMIT_SAM_MS);const res=await probeOnce(root,range,useHeader);if(res.status===200&&res.data&&typeof res.data==='object'){console.log(`  [sam] probe OK: ${root}`);return root;}let bodyHint='';if(res.data){if(typeof res.data==='string')bodyHint=res.data.slice(0,200);else if(res.data.error||res.data.message)bodyHint=JSON.stringify(res.data.error||res.data.message).slice(0,200);else bodyHint=JSON.stringify(res.data).slice(0,300);}const auth=useHeader?'header':'query';console.warn(`  [sam] ${root} (${auth}) -> HTTP ${res.status} ${bodyHint}`);}catch(err){console.warn(`  [sam] probe ${root}:`,err.message);}}}
  return null;
}
async function searchAndFetch(apiRoot,range,filterParams){
  const notices=[];let offset=0,hasMore=true,backoffMs=4000,retries=0;
  while(hasMore){try{await sleep(config.RATE_LIMIT_SAM_MS);const res=await axios.get(`${apiRoot}/v2/search`,{params:{api_key:config.SAM_API_KEY,postedFrom:range.postedFrom,postedTo:range.postedTo,...filterParams,limit:config.SAM_PAGE_SIZE,offset},timeout:20000,validateStatus:()=>true});if(res.status===429){if(retries>=6){console.error('  [sam] HTTP 429 -- giving up');break;}retries++;const wait=parseRetryAfterMs(res.headers)||backoffMs;console.warn(`  [sam] HTTP 429 -- backing off ${Math.round(wait/1000)}s`);await sleep(wait);backoffMs=Math.min(Math.round(backoffMs*1.7),60000);continue;}if(res.status===401||res.status===403){console.error(`  [sam] HTTP ${res.status} -- key rejected`);break;}if(res.status!==200){console.error(`  [sam] HTTP ${res.status}`);break;}const items=res.data?.opportunitiesData||[];notices.push(...items);retries=0;backoffMs=4000;if(items.length<config.SAM_PAGE_SIZE)hasMore=false;else offset+=config.SAM_PAGE_SIZE;}catch(err){console.error('  [sam] Search error:',err.message);break;}}
  return notices;
}
async function fetchDetail(apiRoot,noticeId,range){
  let backoffMs=3000,retries=0;
  while(true){try{await sleep(config.RATE_LIMIT_SAM_MS);const res=await axios.get(`${apiRoot}/v2/search`,{params:{api_key:config.SAM_API_KEY,noticeid:noticeId,postedFrom:range.postedFrom,postedTo:range.postedTo,limit:1,offset:0},timeout:15000,validateStatus:()=>true});if(res.status===429){if(retries>=4)return'';retries++;const wait=parseRetryAfterMs(res.headers)||backoffMs;await sleep(wait);backoffMs=Math.min(Math.round(backoffMs*1.6),30000);continue;}if(res.status!==200)return'';const row=res.data?.opportunitiesData?.[0];if(!row)return'';if(row.description&&String(row.description).startsWith('http')){try{await sleep(config.RATE_LIMIT_SAM_MS);const r2=await axios.get(row.description,{params:{api_key:config.SAM_API_KEY},timeout:15000,responseType:'text',validateStatus:()=>true});if(r2.status===200&&typeof r2.data==='string')return r2.data;}catch{}}return row.description||row.synopsis||'';}catch{return'';}}
}
function normalizeNotice(notice,fullDescription=''){
  const desc=fullDescription||notice.description||notice.synopsis||'';
  const funding=parseFunding(desc);
  const closeDate=notice.responseDeadLine||notice.reponseDeadLine||null;
  return{id:`sam_gov:${notice.noticeId}`,source:'sam_gov',source_url:`https://sam.gov/opp/${notice.noticeId}/view`,title:notice.title||'Untitled',description:desc,agency:notice.department||notice.departmentName||'',sub_agency:notice.subtierName||notice.officeName||'',program:mapType(notice.type||notice.baseType||''),phase:'',naics_codes:notice.naicsCode?[notice.naicsCode]:[],keywords:[],posted_date:notice.postedDate||null,open_date:notice.postedDate||null,close_date:closeDate?new Date(closeDate).toISOString().slice(0,10):null,is_rolling:!closeDate,days_remaining:daysRemaining(closeDate),funding_min:funding.min,funding_max:funding.max,currency:'USD'};
}
function mapType(type){const t=type.toLowerCase();if(t.includes('solicitation'))return'BAA';if(t.includes('presolicitation'))return'BAA';if(t.includes('sources sought'))return'Sources Sought';if(t.includes('special notice'))return'Special Notice';return type||'BAA';}
async function scrape(){
  if(!config.SAM_API_KEY){console.warn('  [sam] SAM_API_KEY not set -- skipping');return[];}
  const keyProblem=diagnoseSamKey(config.SAM_API_KEY);
  if(keyProblem){console.error(`  [sam] ${keyProblem}`);return[];}
  const range=postedDateRange();
  console.log(`  [sam] Looking back ${config.SAM_POSTED_LOOKBACK_DAYS} days`);
  const apiRoot=await resolveSamApiRoot(range);
  if(!apiRoot){console.error('  [sam] Could not reach SAM API');return[];}
  const allNotices=new Map();
  for(const naics of config.SAM_NAICS_CODES){console.log(`  [sam] Searching NAICS ${naics}...`);const notices=await searchAndFetch(apiRoot,range,{ncode:naics});for(const n of notices)allNotices.set(n.noticeId,n);await sleep(config.RATE_LIMIT_SAM_MS*5);}
  for(const kw of config.SAM_KEYWORDS){console.log(`  [sam] Searching title "${kw}"...`);const notices=await searchAndFetch(apiRoot,range,{title:kw});for(const n of notices)allNotices.set(n.noticeId,n);await sleep(config.RATE_LIMIT_SAM_MS*5);}
  console.log(`  [sam] ${allNotices.size} unique notices -- fetching descriptions...`);
  const opportunities=[];
  for(const[,notice]of allNotices){const fullDesc=await fetchDetail(apiRoot,notice.noticeId,range);opportunities.push(normalizeNotice(notice,fullDesc));}
  console.log(`  [sam] Done: ${opportunities.length} opportunities`);
  return opportunities;
}
module.exports = {scrape};
