// --- SBIR.GOV API SCRAPER ---
const axios = require('axios');
const config = require('../config');
const BASE_URL = 'https://api.www.sbir.gov/public/api/solicitations';
async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function parseRetryAfterMs(h={}){const ra=h['retry-after']||h['Retry-After'];if(ra==null)return null;const i=parseInt(ra,10);if(!Number.isNaN(i))return Math.max(i*1000,1000);const d=Date.parse(ra);if(!Number.isNaN(d))return Math.max(d-Date.now(),1000);return null;}
async function fetchPage(agency,offset=0){
  let attempt=0,backoffMs=3000;
  while(attempt<=config.SBIR_429_MAX_RETRIES){
    try{
      const res=await axios.get(BASE_URL,{params:{agency,open:1,rows:config.SBIR_PAGE_SIZE,start:offset},timeout:20000,headers:{Accept:'application/json','User-Agent':'InquiroSniper/1.0 (government opportunity discovery; courteous pacing)'},validateStatus:s=>s<500});
      if(res.status===429){attempt++;const retryMs=parseRetryAfterMs(res.headers)||backoffMs;console.warn(`  [sbir] HTTP 429 (${agency}), backing off ${Math.round(retryMs/1000)}s (${attempt}/${config.SBIR_429_MAX_RETRIES})`);await sleep(retryMs);backoffMs=Math.min(Math.round(backoffMs*1.8),120000);continue;}
      if(res.status!==200)throw new Error(`HTTP ${res.status}`);
      return res.data;
    }catch(err){if(axios.isAxiosError(err)&&err.response?.status===429){attempt++;const retryMs=parseRetryAfterMs(err.response.headers)||backoffMs;console.warn(`  [sbir] HTTP 429 (${agency}), backing off ${Math.round(retryMs/1000)}s`);await sleep(retryMs);backoffMs=Math.min(Math.round(backoffMs*1.8),120000);continue;}throw err;}
  }
  throw new Error('Exceeded SBIR retry budget');
}
function daysRemaining(d){if(!d)return null;return Math.ceil((new Date(d)-new Date())/86400000);}
function normalizeTopic(topic,sol,agency){
  const id=`sbir_gov:${topic.topic_number||topic.sbir_topic_link||sol.solicitation_number+'_'+topic.topic_title}`.replace(/\s+/g,'_').slice(0,200);
  const closeDate=sol.application_due_date?.[0]||sol.close_date||null;
  return{id,source:'sbir_gov',source_url:topic.sbir_topic_link||`https://www.sbir.gov/node/${sol.solicitation_number}`,title:topic.topic_title||sol.solicitation_title,description:[topic.topic_description||'',topic.subtopics?.map(s=>s.subtopic_description||'').join(' ')||''].join(' '),agency:sol.agency||agency,sub_agency:sol.branch||topic.branch||'',program:sol.program||'SBIR',phase:sol.phase||'',naics_codes:[],keywords:[],posted_date:sol.release_date||null,open_date:sol.open_date||null,close_date:closeDate,is_rolling:!closeDate,days_remaining:daysRemaining(closeDate),funding_min:null,funding_max:null,currency:'USD'};
}
function normalizeSolicitation(sol,agency){
  const closeDate=sol.application_due_date?.[0]||sol.close_date||null;
  return{id:`sbir_gov:sol:${sol.solicitation_number}`,source:'sbir_gov',source_url:`https://www.sbir.gov/solicitations/${sol.solicitation_number}`,title:sol.solicitation_title,description:`${sol.solicitation_title} -- ${sol.program||''} ${sol.phase||''} solicitation for ${sol.agency||agency}`,agency:sol.agency||agency,sub_agency:sol.branch||'',program:sol.program||'SBIR',phase:sol.phase||'',naics_codes:[],keywords:[],posted_date:sol.release_date||null,open_date:sol.open_date||null,close_date:closeDate,is_rolling:!closeDate,days_remaining:daysRemaining(closeDate),funding_min:null,funding_max:null,currency:'USD'};
}
async function scrapeAgency(agency){
  const opportunities=[];let offset=0,hasMore=true;
  console.log(`  [sbir] Fetching ${agency}...`);
  await sleep(config.SBIR_INITIAL_DELAY_MS);
  while(hasMore){try{const data=await fetchPage(agency,offset);const items=Array.isArray(data)?data:(data.solicitations||data.results||[]);if(!items.length)break;for(const sol of items){const topics=sol.solicitation_topics||sol.topics||[];if(topics.length>0){for(const topic of topics)opportunities.push(normalizeTopic(topic,sol,agency));}else{opportunities.push(normalizeSolicitation(sol,agency));}}if(items.length<config.SBIR_PAGE_SIZE){hasMore=false;}else{offset+=config.SBIR_PAGE_SIZE;await sleep(config.SBIR_RATE_LIMIT_MS);}}catch(err){console.error(`  [sbir] Error fetching ${agency} at offset ${offset}:`,err.message);break;}}
  console.log(`  [sbir] ${agency}: ${opportunities.length} opportunities`);
  return opportunities;
}
async function scrape(){
  const all=[];
  for(const agency of config.SBIR_AGENCIES){const opps=await scrapeAgency(agency);all.push(...opps);await sleep(config.SBIR_AGENCY_GAP_MS);}
  const seen=new Set();
  return all.filter(o=>seen.has(o.id)?false:seen.add(o.id));
}
module.exports = {scrape};
