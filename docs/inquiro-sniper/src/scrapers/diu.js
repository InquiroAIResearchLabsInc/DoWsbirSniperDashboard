// --- DIU CSO SCRAPER ---
const axios = require('axios');
const cheerio = require('cheerio');
const URL = 'https://www.diu.mil/solutions';
function daysRemaining(d){return d?Math.ceil((new Date(d)-new Date())/86400000):null;}
async function scrape(){
  console.log('  [diu] Scraping DIU solutions...');
  try{
    const res=await axios.get(URL,{timeout:15000,headers:{'User-Agent':'Mozilla/5.0 (compatible; InquiroScraper/1.0)'}});
    const $=cheerio.load(res.data); const opportunities=[];
    $('article,.solution,.cso,[class*="solution"],[class*="opportunity"],.views-row').each((_,el)=>{
      const title=$(el).find('h2,h3,h4,.title,[class*="title"]').first().text().trim();
      if(!title)return;
      const desc=$(el).find('p,.body,[class*="desc"],[class*="summary"]').map((_,d)=>$(d).text().trim()).get().join(' ');
      const link=$(el).find('a').first().attr('href')||'';
      const closeDate=parseDeadline($(el).find('[class*="deadline"],[class*="date"],time').text().trim());
      opportunities.push({id:`diu:${slugify(title)}`,source:'diu',source_url:link.startsWith('http')?link:`https://www.diu.mil${link}`,title,description:desc,agency:'DOD',sub_agency:'DIU',program:'CSO',phase:'Open',naics_codes:[],keywords:[],posted_date:null,open_date:null,close_date:closeDate,is_rolling:!closeDate,days_remaining:closeDate?daysRemaining(closeDate):null,funding_min:null,funding_max:null,currency:'USD'});
    });
    if(opportunities.length===0)opportunities.push({id:'diu:solutions-page-watch',source:'diu',source_url:URL,title:'DIU Commercial Solutions Openings (watch)',description:'Watch-mode placeholder -- no live solicitations parsed.',agency:'DOD',sub_agency:'DIU',program:'CSO',phase:'Open',naics_codes:[],keywords:[],posted_date:null,open_date:null,close_date:null,is_rolling:true,days_remaining:null,funding_min:null,funding_max:null,currency:'USD',is_watch_only:true});
    console.log(`  [diu] ${opportunities.length} CSOs found`); return opportunities;
  }catch(err){console.error('  [diu] Error:',err.message);return[];}
}
function parseDeadline(text){if(!text)return null;const m=text.match(/(\w+ \d+,? \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/);if(!m)return null;try{const d=new Date(m[1]);return isNaN(d)?null:d.toISOString().slice(0,10);}catch{return null;}}
function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,80);}
module.exports = {scrape};
