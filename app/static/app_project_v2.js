async function j(u){ const r = await fetch(u); return r.json(); }
function money(v){ v=+v||0; if(v>=1e9)return (v/1e9).toFixed(2)+"B"; if(v>=1e6)return (v/1e6).toFixed(2)+"M"; if(v>=1e3)return (v/1e3).toFixed(1)+"K"; return v.toFixed(0); }
const qs = s=>document.querySelector(s);
let RAW=[];

function inRangeStart(d,from,to){
  if(!d) return true;
  const x = new Date(d);
  if(from && x < new Date(from)) return false;
  if(to && x > new Date(to)) return false;
  return true;
}
function filt(rows){
  const from=qs('#fromDate').value||null, to=qs('#toDate').value||null;
  const loc=qs('#locSel').value, cli=qs('#clientSel').value, st=qs('#statusSel').value, h=qs('#healthSel').value;
  return rows.filter(r =>
    inRangeStart(r.start,from,to) &&
    (!loc || r.location===loc) &&
    (!cli || r.client===cli) &&
    (!st || r.status===st) &&
    (!h || r.health===h)
  );
}
function populateFilters(rows){
  const locs=[...new Set(rows.map(r=>r.location).filter(Boolean))].sort();
  const clis=[...new Set(rows.map(r=>r.client).filter(Boolean))].sort();
  const l=qs('#locSel'), c=qs('#clientSel');
  locs.forEach(x=>{ const o=document.createElement('option'); o.value=o.textContent=x; l.appendChild(o);});
  clis.forEach(x=>{ const o=document.createElement('option'); o.value=o.textContent=x; c.appendChild(o);});
}
function setKpis(rows){
  const pv = rows.reduce((a,r)=>a+(+r.value||0),0);
  const inprog = rows.filter(r=>["Planning","Executing"].includes(r.status)).length;

  const valid = rows.filter(r=>r.planned_finish && r.forecast_finish);
  const ontime = valid.filter(r=> new Date(r.forecast_finish) <= new Date(r.planned_finish)).length;
  const rate = valid.length? (ontime/valid.length*100):0;

  const avgProg = rows.reduce((a,r)=>a+(+r.progress||0),0)/(rows.length||1);
  const avgCPI = rows.reduce((a,r)=>a+(+r.cpi||0),0)/(rows.length||1);
  const avgSPI = rows.reduce((a,r)=>a+(+r.spi||0),0)/(rows.length||1);

  const ar = rows.reduce((a,r)=>a+(+r.ar_outstanding||0),0);

  qs('#k1').textContent = money(pv);
  qs('#k2').textContent = inprog;
  qs('#k3').textContent = rate.toFixed(1)+'%';
  qs('#k4').textContent = (avgProg||0).toFixed(1)+'%';
  qs('#k5').textContent = `${(avgCPI||0).toFixed(2)} / ${(avgSPI||0).toFixed(2)}`;
  qs('#k6').textContent = money(ar);

  return {rate};
}

function gauge(el, val){ const c=echarts.init(el); c.setOption({series:[{type:'gauge',min:0,max:100,axisLine:{lineStyle:{width:14}},progress:{show:true,width:14},detail:{valueAnimation:true,formatter:v=>v.toFixed(1)+'%',color:'#fff'},data:[{value:val}]}]}); return c; }
function stackedStarts(el){
  // build from /api/projects/monthly-starts + status composition from raw
  const map = new Map(); // key: month|status -> count
  RAW.forEach(r=>{
    if(!r.start) return;
    const ym = r.start.slice(0,7);
    const key = ym+'|'+(r.status||'Unknown');
    map.set(key, (map.get(key)||0)+1);
  });
  const months = [...new Set([...map.keys()].map(k=>k.split('|')[0]))].sort();
  const statuses = [...new Set([...map.keys()].map(k=>k.split('|')[1]))];
  const series = statuses.map(st=>({name:st,type:'bar',stack:'s',data:months.map(m=>map.get(m+'|'+st)||0)}));
  const c=echarts.init(el); c.setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},legend:{data:statuses},xAxis:{type:'category',data:months},yAxis:{type:'value'},series}); return c;
}
function scatterCPISPI(el, rows){
  const data = rows.map(r=>({name:r.name, value:[+r.cpi||0, +r.spi||0, +r.value||0]}));
  const c=echarts.init(el); c.setOption({
    tooltip:{formatter:p=>`${p.data.name}<br>CPI: ${p.value[0].toFixed(2)}<br>SPI: ${p.value[1].toFixed(2)}<br>Value: ${money(p.value[2])}`},
    xAxis:{name:'CPI'}, yAxis:{name:'SPI'},
    series:[{type:'scatter', symbolSize: p=>Math.sqrt(p[2]) / 50, data}]
  }); return c;
}
function treemapValue(el, rows){
  const map = new Map(); rows.forEach(r=>{ const k=r.location||'Unknown'; map.set(k,(map.get(k)||0)+(+r.value||0)); });
  const c=echarts.init(el); c.setOption({tooltip:{formatter:p=>`${p.name}: ${money(p.value)}`},series:[{type:'treemap',data:[...map.entries()].map(([k,v])=>({name:k,value:v})), leafDepth:1, roam:true}]}); return c;
}
function pieHealth(el, rows){
  const counts = {Green:0,Amber:0,Red:0};
  rows.forEach(r=>{ counts[r.health]= (counts[r.health]||0)+1; });
  const c=echarts.init(el); c.setOption({series:[{type:'pie',radius:['35%','70%'],data:Object.entries(counts).map(([k,v])=>({name:k,value:v}))}]}); return c;
}
function topClients(el, rows){
  const map = new Map(); rows.forEach(r=>{ const k=r.client||'Unknown'; map.set(k,(map.get(k)||0)+(+r.value||0)); });
  const arr = [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  const c=echarts.init(el); c.setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>`${p[0].name}: ${money(p[0].value)}`},xAxis:{type:'value',axisLabel:{formatter:v=>money(v)}},yAxis:{type:'category',data:arr.map(x=>x[0])},series:[{type:'bar',data:arr.map(x=>x[1])}]}); return c;
}
function varianceBuckets(el, rows){
  const buckets=["≤-16","-15..-1","0","+1..15","+16..30","+31..60",">60"];
  const f=(d)=>{ if(d<=-16)return"≤-16"; if(d<=-1)return"-15..-1"; if(d===0)return"0"; if(d<=15)return"+1..15"; if(d<=30)return"+16..30"; if(d<=60)return"+31..60"; return">60"; };
  const counts=Object.fromEntries(buckets.map(b=>[b,0])); rows.forEach(r=>{ counts[f(+r.variance_days||0)]++; });
  const c=echarts.init(el); c.setOption({xAxis:{type:'category',data:buckets},yAxis:{type:'value'},series:[{type:'bar',data:buckets.map(b=>counts[b])}]}); return c;
}
function table(el, rows){
  const top=[...rows].sort((a,b)=>(+b.value||0)-(+a.value||0)).slice(0,15);
  el.innerHTML = `<table><thead><tr><th>Code</th><th>Name</th><th>Client</th><th>Location</th><th>Status</th><th>Health</th><th>Progress</th><th>Value</th><th>Planned</th><th>Forecast</th></tr></thead>
  <tbody>${top.map(r=>`<tr><td>${r.code}</td><td>${r.name}</td><td>${r.client}</td><td>${r.location}</td><td>${r.status}</td><td>${r.health}</td><td>${(r.progress||0).toFixed(0)}%</td><td>${money(r.value)}</td><td>${r.planned_finish||''}</td><td>${r.forecast_finish||''}</td></tr>`).join('')}</tbody></table>`;
}
function toCSV(rows){
  const cols=["code","name","client","location","type","pm","value","start","planned_finish","forecast_finish","status","progress","cpi","spi","risk","health","variance_days","co_value","inv_issued","inv_collected","ar_outstanding"];
  const head=cols.join(","); const lines=rows.map(r=>cols.map(c=>`"${(r[c]??"").toString().replace(/"/g,'""')}"`).join(",")); return [head,...lines].join("\n");
}

(async function init(){
  RAW=(await j('/api/projects/raw')).rows||[];
  populateFilters(RAW);

  let rows=filt(RAW);
  const k=setKpis(rows);

  const charts=[];
  charts.push(gauge(document.getElementById('gauge'), k.rate));
  charts.push(stackedStarts(document.getElementById('stacked')));
  charts.push(scatterCPISPI(document.getElementById('scatter'), rows));
  charts.push(topClients(document.getElementById('clients'), rows));
  charts.push(pieHealth(document.getElementById('health'), rows));
  charts.push(treemapValue(document.getElementById('tree'), rows));
  charts.push(varianceBuckets(document.getElementById('var'), rows));
  table(document.getElementById('tableWrap'), rows);

  function rerender(){
    rows=filt(RAW);
    const k2=setKpis(rows);
    charts.forEach(c=>c.dispose()); charts.length=0;
    charts.push(gauge(document.getElementById('gauge'), k2.rate));
    charts.push(stackedStarts(document.getElementById('stacked')));
    charts.push(scatterCPISPI(document.getElementById('scatter'), rows));
    charts.push(topClients(document.getElementById('clients'), rows));
    charts.push(pieHealth(document.getElementById('health'), rows));
    charts.push(treemapValue(document.getElementById('tree'), rows));
    charts.push(varianceBuckets(document.getElementById('var'), rows));
    table(document.getElementById('tableWrap'), rows);
  }

  qs('#applyBtn').onclick = rerender;
  qs('#refreshBtn').onclick = async ()=>{ RAW=(await j('/api/projects/raw')).rows||[]; rerender(); };
  qs('#exportBtn').onclick = ()=>{ const csv=toCSV(rows); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='projects_export.csv'; a.click(); URL.revokeObjectURL(url); };
  qs('#toggleTheme').onclick = ()=>{ const b=document.body; b.dataset.theme=(b.dataset.theme==='dark')?'light':'dark'; window.dispatchEvent(new Event('resize')); };
  window.addEventListener('resize', ()=>charts.forEach(c=>c.resize()));
})();
