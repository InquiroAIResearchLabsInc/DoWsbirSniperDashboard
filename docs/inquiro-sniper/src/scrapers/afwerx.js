// --- AFWERX SCRAPER ---
const axios = require('axios');
const cheerio = require('cheerio');
const URLS = ['https://afwerx.com/divisions/sbir-sttr/','https://afwerx.com/get-funded/'];
function daysRemaining(d){return d?Math.ceil((new Date(d)-new Date())/86400000):null;}
async function scrapePage(url){
  const res=await axios.get(url,{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (compatible; InquiroScraper/1.0)'}});
  const $=cheerio.load(res.data); const items=[];
  $('section,article,.card,[class*="fund"],[class*="program"],.wp-block-group').each((_,el)=>{
    const title=$(el).find('h2,h3,h4').first().text().trim();
    if(!title||title.length<5)return;
    const desc=$(el).find('p').map((_,p)=>$(p).text().trim()).get().filter(t=>t.length>20).join(' ');
    const link=$(el).find('a').first().attr('href')||url;
    const closeDate=parseDeadline($(el).find('[class*="date"],time').text().trim());
    items.push({id:`afwerx:${slugify(title)}`,source:'afwerx',source_url:link.startsWith('http')?link:`https://afwerx.com${link}`,title:`AFWERX: ${title}`,description:desc,agency:'DOD',sub_agency:'Air Force / AFWERX',program:detectProgram(title+desc),phase:detectPhase(title+desc),naics_codes:[],keywords:[],posted_date:null,open_date:null,close_date:closeDate,is_rolling:!closeDate,days_remaining:closeDate?daysRemaining(closeDate):null,funding_min:null,funding_max:null,currency:'USD'});
  });
  return items;
}
async function scrape(){
  console.log('  [afwerx] Scraping AFWERX...'); const all=new Map();
  for(const url of URLS){try{const items=await scrapePage(url);for(const i of items)all.set(i.id,i);}catch(err){console.error(`  [afwerx] Error scraping ${url}:`,err.message);}}
  const opportunities=[...all.values()];
  if(opportunities.length===0)opportunities.push({id:'afwerx:open-topic-watch',source:'afwerx',source_url:URLS[0],title:'AFWERX Get Funded (watch)',description:'Watch-mode placeholder -- no live programs parsed.',agency:'DOD',sub_agency:'Air Force / AFWERX',program:'SBIR',phase:'Open',naics_codes:[],keywords:[],posted_date:null,open_date:null,close_date:null,is_rolling:true,days_remaining:null,funding_min:50000,funding_max:1700000,currency:'USD',is_watch_only:true});
  console.log(`  [afwerx] ${opportunities.length} programs found`); return opportunities;
}
function detectProgram(t){t=t.toLowerCase();if(t.includes('d2p2'))return'D2P2';if(t.includes('stratfi'))return'STRATFI';if(t.includes('sttr'))return'STTR';return'SBIR';}
function detectPhase(t){t=t.toLowerCase();if(t.includes('d2p2')||t.includes('direct to phase ii'))return'D2P2';if(t.includes('phase ii')||t.includes('phase 2'))return'Phase II';if(t.includes('phase i')||t.includes('phase 1'))return'Phase I';return'Open';}
function parseDeadline(text){if(!text)return null;const m=text.match(/(\w+ \d+,? \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/);if(!m)return null;try{const d=new Date(m[1]);return isNaN(d)?null:d.toISOString().slice(0,10);}catch{return null;}}
function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,80);}
module.exports = {scrape};
