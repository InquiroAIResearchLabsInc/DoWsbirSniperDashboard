// --- SPACEWERX SCRAPER ---
const axios = require('axios');
const cheerio = require('cheerio');
const URL = 'https://spacewerx.us/what-we-fund/';
function daysRemaining(d){return d?Math.ceil((new Date(d)-new Date())/86400000):null;}
async function scrape(){
  console.log('  [spacewerx] Scraping SpaceWERX...');
  try{
    const res=await axios.get(URL,{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (compatible; InquiroScraper/1.0)'}});
    const $=cheerio.load(res.data); const opportunities=[];
    $('section,article,.card,[class*="fund"],[class*="program"],.wp-block-group').each((_,el)=>{
      const title=$(el).find('h2,h3,h4,.title').first().text().trim(); if(!title||title.length<5)return;
      const desc=$(el).find('p').map((_,p)=>$(p).text().trim()).get().join(' ');
      const link=$(el).find('a').first().attr('href')||URL;
      const closeDate=parseDeadline($(el).find('[class*="date"],time').text().trim());
      opportunities.push({id:`spacewerx:${slugify(title)}`,source:'spacewerx',source_url:link.startsWith('http')?link:`https://spacewerx.us${link}`,title:`SpaceWERX: ${title}`,description:desc,agency:'DOD',sub_agency:'Space Force / SpaceWERX',program:detectProgram(title+desc),phase:detectPhase(title+desc),naics_codes:[],keywords:[],posted_date:null,open_date:null,close_date:closeDate,is_rolling:!closeDate,days_remaining:closeDate?daysRemaining(closeDate):null,funding_min:null,funding_max:null,currency:'USD'});
    });
    if(opportunities.length===0)opportunities.push({id:'spacewerx:open-topic-watch',source:'spacewerx',source_url:URL,title:'SpaceWERX What We Fund (watch)',description:'Watch-mode placeholder -- no live programs parsed.',agency:'DOD',sub_agency:'Space Force / SpaceWERX',program:'SBIR',phase:'Phase I',naics_codes:[],keywords:[],posted_date:null,open_date:null,close_date:null,is_rolling:true,days_remaining:null,funding_min:150000,funding_max:1700000,currency:'USD',is_watch_only:true});
    console.log(`  [spacewerx] ${opportunities.length} programs found`); return opportunities;
  }catch(err){console.error('  [spacewerx] Error:',err.message);return[];}
}
function detectProgram(t){t=t.toLowerCase();if(t.includes('d2p2')||t.includes('direct to phase ii'))return'D2P2';if(t.includes('stratfi'))return'STRATFI';if(t.includes('tactical'))return'Tactical';if(t.includes('sttr'))return'STTR';return'SBIR';}
function detectPhase(t){t=t.toLowerCase();if(t.includes('d2p2')||t.includes('direct to phase ii'))return'D2P2';if(t.includes('phase ii')||t.includes('phase 2'))return'Phase II';if(t.includes('phase i')||t.includes('phase 1'))return'Phase I';return'Open';}
function parseDeadline(text){if(!text)return null;const m=text.match(/(\w+ \d+,? \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/);if(!m)return null;try{const d=new Date(m[1]);return isNaN(d)?null:d.toISOString().slice(0,10);}catch{return null;}}
function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,80);}
module.exports = {scrape};
