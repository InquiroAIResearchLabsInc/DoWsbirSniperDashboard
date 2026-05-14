// --- NATO DIANA WATCH SCRAPER ---
const axios = require('axios');
const cheerio = require('cheerio');
const { updateSourceStatus, now } = require('../db');
const CHALLENGES_URL = 'https://diana.nato.int/challenges/';
const NEW_CHALLENGE_KEYWORDS = ['open for applications','apply now','now accepting submissions','new challenge announced'];
function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,80);}
async function scrape(){
  console.log('  [diana] Checking NATO DIANA challenges (watch mode)...');
  const opportunities=[]; let activeChallenge=false,trigger=null,fetchError=null;
  try{
    const res=await axios.get(CHALLENGES_URL,{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (compatible; InquiroScraper/1.0)'}});
    const $=cheerio.load(res.data);
    $('article,.challenge,[class*="challenge"],.card').each((_,el)=>{
      const title=$(el).find('h2,h3,h4,.title').first().text().trim(); if(!title)return;
      const desc=$(el).find('p').map((_,p)=>$(p).text().trim()).get().join(' ');
      const link=$(el).find('a').first().attr('href')||CHALLENGES_URL;
      const status=$(el).find('[class*="status"],.badge').text().trim().toLowerCase();
      if(!status.includes('open')&&!status.includes('accepting'))return;
      activeChallenge=true;
      opportunities.push({id:`diana_nato:${slugify(title)}`,source:'diana_nato',source_url:link.startsWith('http')?link:`https://diana.nato.int${link}`,title:`NATO DIANA: ${title}`,description:desc,agency:'NATO',sub_agency:'DIANA',program:'DIANA Challenge',phase:'Open',naics_codes:[],keywords:[],posted_date:null,open_date:null,close_date:null,is_rolling:true,days_remaining:null,funding_min:200000,funding_max:400000,currency:'EUR'});
    });
    if(!activeChallenge){
      const pageText=($('main').text()||$('body').text()).toLowerCase();
      for(const kw of NEW_CHALLENGE_KEYWORDS){if(pageText.includes(kw)){activeChallenge=true;trigger=kw;console.warn(`  [diana] Page signal: "${kw}"`);break;}}
    }
    if(!activeChallenge)console.log('  [diana] No active challenges detected.');
  }catch(err){console.error('  [diana] Error:',err.message);fetchError=err.message;}
  updateSourceStatus('diana_nato',{last_run:now(),last_success:fetchError?null:now(),last_count:opportunities.length||1,last_error:fetchError,status:activeChallenge?'change_detected':'watch'});
  if(opportunities.length===0)opportunities.push({id:'diana_nato:challenge-watch',source:'diana_nato',source_url:CHALLENGES_URL,title:trigger?`NATO DIANA -- signal detected (${trigger})`:'NATO DIANA Challenges (watch -- next ~mid-2026)',description:'Watch-mode placeholder -- no active DIANA challenges parsed.',agency:'NATO',sub_agency:'DIANA',program:'DIANA Challenge',phase:'Open',naics_codes:[],keywords:[],posted_date:null,open_date:null,close_date:null,is_rolling:false,days_remaining:null,funding_min:200000,funding_max:400000,currency:'EUR',is_watch_only:true});
  console.log(`  [diana] ${opportunities.length} entries`); return opportunities;
}
module.exports = {scrape};
