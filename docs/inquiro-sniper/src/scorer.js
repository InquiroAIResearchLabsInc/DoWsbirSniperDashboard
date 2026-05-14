// --- SCORING ENGINE ---
const config = require('./config');
const TIER_A_KEYWORDS = ['data fusion verification','decision provenance','cryptographic verification','zero trust enforcement','audit trail','ai governance','autonomous decision accountability','data integrity verification','chain of custody','tamper detection','evidence-grade','verifiable ai','reproducible','attestation','trustworthy ai infrastructure'];
const TIER_B_KEYWORDS = ['multi-source fusion','heterogeneous data','sensor fusion','data fusion','anomaly detection','threat detection','data sovereignty','access control','sandbox evaluation','ai/ml evaluation','edge computing','denied environment','ddil','intermittent connectivity','offline operation','multi-level security','coalition operations','trustworthy ai'];
const TIER_C_KEYWORDS = ['cybersecurity','data analytics','machine learning','artificial intelligence','autonomous systems','compliance','monitoring','logging','telemetry','provenance','adaptive system','intelligent system'];
const DISQUALIFIERS = ['battery','propulsion','antenna design','rf hardware','chemical detection','biological agent','pharmaceutical','manufacturing process','materials science','optics fabrication','kinetic','munitions','radar hardware','power generation','respirator','vaccine','deorbit','infrared sensor hardware'];
const DOMAIN_TIER1 = ['pleo','leo constellation','sda','pwsa','bmc3','space domain awareness','uas','bvlos','unmanned aerial','autonomous aviation','drone','dod 3000','dodd 3000','autonomous weapons','lethal autonomous','kill chain','command and control','c2 system','battle management','forensic','after-action','fre 901','chain of evidence','ai agent governance','ai safety infrastructure','ai assurance','ai governance'];
const DOMAIN_TIER2 = ['logistics','supply chain','in-transit visibility','asset tracking','isr','multi-int','sigint','geoint','osint','cyber operations','network defense','cyber defense','threat hunting','cybersecurity','maritime autonomous','unmanned maritime','usv','uuv','space system','space operations','space'];
const DOMAIN_TIER3 = ['enterprise it','cloud security','zero trust architecture','identity management','test and evaluation','verification and validation','developmental testing','training simulation','virtual training','synthetic training'];
const DOMAIN_DISQUALIFIERS = ['hardware only','chemical','biological','nuclear','radiological','pharmaceutical','medical device','manufacturing','materials science','propulsion system'];
const SUBMISSION_TYPE_SCORES = {'d2p2':1.0,'direct to phase ii':1.0,'direct phase ii':1.0,'open topic':0.95,'open topics':0.95,'baa':0.90,'broad agency announcement':0.90,'white paper':0.90,'cso':0.85,'commercial solutions opening':0.85,'ota':0.85,'phase i':0.80,'phase 1':0.80,'sbir phase i':0.80,'sttr phase i':0.80,'dasa':0.75,'open call':0.75,'diana':0.70,'challenge':0.70,'sttr':0.30,'phase ii':0.0,'phase 2':0.0,'match':0.20};
const DEFAULT_WEIGHTS = {tech_alignment:0.40,domain_alignment:0.25,submission_type:0.15,timeline:0.10,funding_efficiency:0.10};
let _runtimeWeights = null;
function getCurrentWeights() {
  if (_runtimeWeights) return _runtimeWeights;
  try {
    const { getDb } = require('./db');
    const row = getDb().prepare("SELECT weights_snapshot FROM weight_history WHERE weights_snapshot IS NOT NULL ORDER BY changed_at DESC LIMIT 1").get();
    if (row && row.weights_snapshot) { _runtimeWeights = { ...DEFAULT_WEIGHTS, ...JSON.parse(row.weights_snapshot) }; return _runtimeWeights; }
  } catch (_) {}
  _runtimeWeights = { ...DEFAULT_WEIGHTS };
  return _runtimeWeights;
}
function applyWeights(newWeights, opts = {}) {
  const required = Object.keys(DEFAULT_WEIGHTS);
  const merged = { ...getCurrentWeights() };
  for (const k of required) {
    if (newWeights[k] != null) { const v = Number(newWeights[k]); if (isNaN(v) || v < 0 || v > 1) throw new Error(`Invalid weight for ${k}: ${newWeights[k]}`); merged[k] = v; }
  }
  const sum = required.reduce((s, k) => s + merged[k], 0);
  if (Math.abs(sum - 1) > 0.01) throw new Error(`Weights must sum to 1.0 (got ${sum.toFixed(3)})`);
  const { getDb, uid, now } = require('./db');
  getDb().prepare("INSERT INTO weight_history (id, changed_at, trigger, dimension, old_weight, new_weight, reason, outcomes_count, weights_snapshot) VALUES (?, ?, ?, 'all', NULL, NULL, ?, ?, ?)").run(uid(), now(), opts.trigger || 'manual', opts.reason || 'Manual weight update', opts.outcomes_count || 0, JSON.stringify(merged));
  _runtimeWeights = merged;
  return merged;
}
const WEIGHTS = new Proxy({}, { get: (_, prop) => getCurrentWeights()[prop], ownKeys: () => Object.keys(getCurrentWeights()), getOwnPropertyDescriptor: (_, prop) => ({ enumerable: true, configurable: true, value: getCurrentWeights()[prop] }) });
function scoreOpportunity(opp) {
  const text = [opp.title||'',opp.description||'',opp.program||'',opp.phase||''].join(' ').toLowerCase();
  if (opp.is_watch_only) return buildResult(opp,50,50,50,50,50,50,[],'STRETCH');
  for (const dq of DISQUALIFIERS) { if (text.includes(dq)) return buildResult(opp,0,0,0,0,0,0,[],'SKIP'); }
  let techPts = 0; const matchedKeywords = [];
  for (const kw of TIER_A_KEYWORDS) { if (text.includes(kw)) { techPts += 10; matchedKeywords.push(kw); } }
  for (const kw of TIER_B_KEYWORDS) { if (text.includes(kw)) { techPts += 5; matchedKeywords.push(kw); } }
  for (const kw of TIER_C_KEYWORDS) { if (text.includes(kw)) { techPts += 2; matchedKeywords.push(kw); } }
  const techScore = Math.min(100, (techPts / 40) * 100);
  let domainScore = 0, domainDisqualified = false;
  for (const kw of DOMAIN_DISQUALIFIERS) { if (text.includes(kw)) { domainDisqualified = true; break; } }
  if (!domainDisqualified) {
    let bestDomain = 0;
    for (const kw of DOMAIN_TIER1) { if (text.includes(kw)) bestDomain = Math.max(bestDomain, 100); }
    for (const kw of DOMAIN_TIER2) { if (text.includes(kw)) bestDomain = Math.max(bestDomain, 75); }
    for (const kw of DOMAIN_TIER3) { if (text.includes(kw)) bestDomain = Math.max(bestDomain, 50); }
    domainScore = bestDomain;
  }
  let typeScore = 0.80;
  const programText = [opp.program||'',opp.phase||''].join(' ').toLowerCase();
  for (const [key, val] of Object.entries(SUBMISSION_TYPE_SCORES)) { if (text.includes(key) || programText.includes(key)) typeScore = Math.max(typeScore, val); }
  if ((text.includes('sttr') || programText.includes('sttr')) && typeScore === 0.80) typeScore = 0.30;
  const typeScoreNorm = typeScore * 100;
  let timelineScore = 100;
  if (!opp.is_rolling && opp.days_remaining != null) {
    const d = opp.days_remaining;
    if (d < 0) timelineScore = 0; else if (d < 7) timelineScore = 10; else if (d < 14) timelineScore = 30; else if (d < 21) timelineScore = 60; else if (d < 30) timelineScore = 80;
  }
  let fundingScore = 50;
  const rawAmount = opp.funding_max || opp.funding_min;
  const rate = (config.CURRENCY_RATES && config.CURRENCY_RATES[opp.currency || 'USD']) || 1;
  const amount = rawAmount ? rawAmount * rate : null;
  if (amount) {
    if (amount >= 750000 && amount <= 2000000) fundingScore = 100;
    else if (amount >= 250000 && amount < 750000) fundingScore = 90;
    else if (amount >= 50000 && amount < 250000) fundingScore = 70;
    else if (amount > 2000000) fundingScore = 60;
    else if (amount < 50000) fundingScore = 20;
  }
  const w = getCurrentWeights();
  const finalScore = Math.round(techScore * w.tech_alignment + domainScore * w.domain_alignment + typeScoreNorm * w.submission_type + timelineScore * w.timeline + fundingScore * w.funding_efficiency);
  return buildResult(opp, finalScore, techScore, domainScore, typeScoreNorm, timelineScore, fundingScore, matchedKeywords, scoreTier(finalScore));
}
function buildResult(opp, finalScore, tech, domain, type, timeline, funding, matched, tier) {
  const aiScore = opp && opp.ai_score;
  const divergence = aiScore != null && Math.abs(aiScore - finalScore) >= 20;
  return { fit_score: finalScore, score_tier: tier, score_tech: Math.round(tech), score_domain: Math.round(domain), score_type: Math.round(type), score_timeline: Math.round(timeline), score_funding: Math.round(funding), keywords_matched: matched, divergence_flag: divergence };
}
function scoreTier(score) { if (score >= 80) return 'SNIPER'; if (score >= 60) return 'EVALUATE'; if (score >= 40) return 'STRETCH'; return 'SKIP'; }
const CALIBRATION_CASES = [
  {title:'SF254-D1204: Secure Multi-Source Data Fusion for pLEO',expectedTier:'SNIPER',expectedScore:95,description:'multi-source data fusion verification zero trust enforcement AI/ML evaluation sandboxed pLEO SDA constellation'},
  {title:'AFWERX Open Topic (CHORD equiv)',expectedTier:'SNIPER',expectedScore:85,description:'open topic autonomous systems governance ai governance attestation decision provenance'},
  {title:'SF25D-T1201: Adaptive and Intelligent Space',expectedTier:'EVALUATE',expectedScore:65,description:'STTR intelligent adaptive systems data fusion anomaly detection edge computing space'},
  {title:'AFRL Extreme Computing BAA',expectedTier:'EVALUATE',expectedScore:70,description:'broad agency announcement edge computing artificial intelligence machine learning cybersecurity BAA'},
  {title:'NSF AI7: Trustworthy AI',expectedTier:'EVALUATE',expectedScore:72,description:'NSF SBIR phase I trustworthy artificial intelligence verifiable AI attestation responsible machine learning transparency accountability'},
  {title:'DIU Autonomy CSO (if active)',expectedTier:'SNIPER',expectedScore:82,description:'commercial solutions opening CSO OTA autonomous systems ai governance zero trust enforcement'},
  {title:'A254-049: Ka-Band Radar',expectedTier:'SKIP',expectedScore:5,description:'Ka-band radar hardware antenna design RF hardware waveform generation'},
  {title:'CBD254-005: Respirators',expectedTier:'SKIP',expectedScore:0,description:'chemical biological detection respirator NBC protection pharmaceutical chemical detection'},
];
function runCalibration(verbose=false) {
  let pass=0; const results=[];
  for (const c of CALIBRATION_CASES) {
    const opp={title:c.title,description:c.description,program:c.description,phase:c.description,is_rolling:false,days_remaining:45,funding_min:500000,funding_max:1500000};
    const scored=scoreOpportunity(opp);
    const tierMatch=scored.score_tier===c.expectedTier, scoreDelta=Math.abs(scored.fit_score-c.expectedScore), ok=tierMatch&&scoreDelta<=15;
    if(ok)pass++;
    results.push({title:c.title,expectedTier:c.expectedTier,gotTier:scored.score_tier,expectedScore:c.expectedScore,gotScore:scored.fit_score,tierMatch,scoreDelta,ok});
    if(verbose)console.log((ok?'[PASS]':'[FAIL]')+' '+c.title+' Tier:'+c.expectedTier+'/'+scored.score_tier+' Score:~'+c.expectedScore+'/'+scored.fit_score);
  }
  const rate=Math.round((pass/CALIBRATION_CASES.length)*100);
  if(verbose)console.log('\nCalibration: '+pass+'/'+CALIBRATION_CASES.length+' passed ('+rate+'%)');
  return {pass,total:CALIBRATION_CASES.length,rate,results};
}
module.exports = { scoreOpportunity, scoreTier, runCalibration, WEIGHTS, getCurrentWeights, applyWeights, DEFAULT_WEIGHTS };
