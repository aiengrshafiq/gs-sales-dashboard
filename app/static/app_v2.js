async function j(u){ const r = await fetch(u); return r.json(); }
function money(v){ v=+v||0; if(v>=1e9)return (v/1e9).toFixed(2)+"B"; if(v>=1e6)return (v/1e6).toFixed(2)+"M"; if(v>=1e3)return (v/1e3).toFixed(1)+"K"; return v.toFixed(0); }
const fmt = (d)=>d?d:"";

let RAW = [];
const qs = (s)=>document.querySelector(s);

function inRange(d,from,to){
  if(!d) return true;
  const x = new Date(d);
  if(from && x < new Date(from)) return false;
  if(to && x > new Date(to)) return false;
  return true;
}
function filt(rows){
  const from = qs('#fromDate').value || null;
  const to   = qs('#toDate').value   || null;
  const p    = qs('#partnerSel').value;
  const loc  = qs('#locationSel').value;
  const st   = qs('#statusSel').value;
  return rows.filter(r =>
    inRange(r.issuance_date || r.signing_date || r.final_presentation_date, from, to) &&
    (!p || r.partner===p) &&
    (!loc || r.location===loc) &&
    (!st || (r.meta_status||"").toLowerCase()===st.toLowerCase())
  );
}

function setKpis(rows){
  const totalPV = rows.reduce((a,r)=>a+(+r.project_value||0),0);
  const totalDP = rows.reduce((a,r)=>a+(+r.design_policy_amount||0),0);
  const signed  = rows.filter(r=>["won","lost","in progress"].includes((r.meta_status||"").toLowerCase()));
  const won     = rows.filter(r=>(r.meta_status||"").toLowerCase()==="won");
  const winRate = signed.length? (won.length/signed.length*100):0;

  const cycles  = rows.map(r=>r.cycle_days).filter(x=>x!=null);
  const avgCycle = cycles.length? (cycles.reduce((a,b)=>a+b,0)/cycles.length):0;

  const today = new Date(); const soon = new Date(); soon.setDate(today.getDate()+14);
  const up = rows.filter(r => {
    if(!r.final_presentation_date) return false;
    const x = new Date(r.final_presentation_date);
    const td = new Date(today.toISOString().slice(0,10));
    const sd = new Date(soon.toISOString().slice(0,10));
    return x>=td && x<=sd;
  }).length;

  qs('#k1').textContent = money(totalPV);
  qs('#k2').textContent = money(totalDP);
  qs('#k3').textContent = winRate.toFixed(1)+'%';
  qs('#k4').textContent = (avgCycle||0).toFixed(1);
  qs('#k5').textContent = up;
  return {winRate};
}

function gauge(el, val){
  const c = echarts.init(el); c.setOption({
    series:[{type:'gauge',min:0,max:100,axisLine:{lineStyle:{width:14}},progress:{show:true,width:14},
      detail:{valueAnimation:true,formatter:v=>v.toFixed(1)+'%',color:'#fff'}, data:[{value:val}]}]
  }); return c;
}
function stackedMonthly(el, rows){
  // group by Year-Month and meta_status
  const map = new Map();
  rows.forEach(r=>{
    const d = r.issuance_date || r.signing_date || r.final_presentation_date;
    if(!d) return;
    const ym = d.slice(0,7);
    const st = (r.meta_status||'Unknown');
    const key = ym+'|'+st;
    map.set(key, (map.get(key)||0) + (+r.project_value||0));
  });
  const months = [...new Set([...map.keys()].map(k=>k.split('|')[0]))].sort();
  const statuses = [...new Set([...map.keys()].map(k=>k.split('|')[1]))];
  const series = statuses.map(st=>({
    name:st, type:'bar', stack:'v', emphasis:{focus:'series'},
    data: months.map(m=> map.get(m+'|'+st) || 0 )
  }));
  const c = echarts.init(el); c.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>p.map(x=>`${x.seriesName}: ${money(x.value)}`).join('<br>')},
    legend:{data:statuses},
    xAxis:{type:'category', data:months}, yAxis:{type:'value', axisLabel:{formatter:v=>money(v)}},
    series
  }); return c;
}
function cycleBuckets(el, rows){
  const bins = ["≤7","8-14","15-21","22-30","31-45","46-60","61-90",">90"];
  const f = (d)=>{
    if(d<=7) return "≤7"; if(d<=14) return "8-14"; if(d<=21) return "15-21"; if(d<=30) return "22-30";
    if(d<=45) return "31-45"; if(d<=60) return "46-60"; if(d<=90) return "61-90"; return ">90";
  };
  const counts = Object.fromEntries(bins.map(b=>[b,0]));
  rows.forEach(r=>{ if(r.cycle_days!=null) counts[f(+r.cycle_days)]++; });
  const c = echarts.init(el); c.setOption({
    tooltip:{trigger:'axis'}, xAxis:{type:'category', data:bins}, yAxis:{type:'value'},
    series:[{type:'bar', data:bins.map(b=>counts[b])}]
  }); return c;
}
function funnel(el, rows){
  // simple counts: policy -> presentation -> contract (won)
  const policy = rows.filter(r=>r.design_policy_amount>0).length;
  const pres   = rows.filter(r=>r.final_presentation_date).length;
  const won    = rows.filter(r=>(r.meta_status||'').toLowerCase()==='won').length;
  const c = echarts.init(el); c.setOption({
    tooltip:{trigger:'item',formatter:p=>`${p.name}: ${p.value}`},
    series:[{type:'funnel', left:'10%', width:'80%', data:[
      {name:'Policy', value:policy},
      {name:'Final Presentation', value:pres},
      {name:'Contract Won', value:won},
    ]}]
  }); return c;
}
function topPartners(el, rows){
  const map = new Map();
  rows.forEach(r=>{ const k=r.partner||'Unknown'; map.set(k,(map.get(k)||0)+(+r.project_value||0)); });
  const arr = [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  const c = echarts.init(el); c.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>`${p[0].name}: ${money(p[0].value)}`},
    xAxis:{type:'value', axisLabel:{formatter:v=>money(v)}}, yAxis:{type:'category', data:arr.map(x=>x[0])},
    series:[{type:'bar', data:arr.map(x=>x[1])}]
  }); return c;
}
function treemap(el, rows){
  const map = new Map();
  rows.forEach(r=>{ const k=r.location||'Unknown'; map.set(k,(map.get(k)||0)+(+r.project_value||0)); });
  const c = echarts.init(el); c.setOption({
    tooltip:{formatter:p=>`${p.name}: ${money(p.value)}`},
    series:[{type:'treemap', data:[...map.entries()].map(([k,v])=>({name:k,value:v})), roam:true, leafDepth:1}]
  }); return c;
}
function calendar(el, rows){
  const pairs = [];
  rows.forEach(r=>{
    const d = r.issuance_date; if(!d) return;
    const key = d;
    const i = pairs.findIndex(x=>x[0]===key);
    if(i<0) pairs.push([key,1]); else pairs[i][1]+=1;
  });
  const c = echarts.init(el); 
  const year = pairs.length? pairs[pairs.length-1][0].slice(0,4): new Date().getFullYear().toString();
  c.setOption({
    visualMap:{min:0,max:Math.max(5,...pairs.map(p=>p[1])) , orient:'horizontal', left:'center', top:0},
    calendar:{ top:40, cellSize:[16,16], range:year, itemStyle:{ borderColor:'#0f172a' }, yearLabel:{show:false}},
    series:[{type:'heatmap', coordinateSystem:'calendar', data:pairs}]
  }); return c;
}
function table(el, rows){
  const top = [...rows].sort((a,b)=>(+b.project_value||0)-(+a.project_value||0)).slice(0,10);
  const html = `
    <table>
      <thead><tr>
        <th>Client</th><th>Partner</th><th>Location</th><th>META Status</th><th>Project Value</th><th>Final Presentation</th>
      </tr></thead>
      <tbody>
        ${top.map(r=>`
          <tr>
            <td>${fmt(r.client)}</td>
            <td>${fmt(r.partner)}</td>
            <td>${fmt(r.location)}</td>
            <td>${fmt(r.meta_status)}</td>
            <td>${money(r.project_value)}</td>
            <td>${fmt(r.final_presentation_date)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  el.innerHTML = html;
}

function populateFilters(rows){
  const partners = [...new Set(rows.map(r=>r.partner).filter(Boolean))].sort();
  const locations= [...new Set(rows.map(r=>r.location).filter(Boolean))].sort();
  const pSel = qs('#partnerSel'), lSel = qs('#locationSel');
  partners.forEach(p=>{ const o=document.createElement('option'); o.value=o.textContent=p; pSel.appendChild(o); });
  locations.forEach(l=>{ const o=document.createElement('option'); o.value=o.textContent=l; lSel.appendChild(o); });
}

function toCSV(rows){
  const cols = ["issuance_date","signing_date","client","location","design_policy_amount","final_presentation_date","project_value","first_presentation_date","cycle_days","status","comments","partner","main_contract_date","meta_status"];
  const head = cols.join(",");
  const lines = rows.map(r=>cols.map(c=>{
    const v = r[c]==null?"":String(r[c]).replace(/"/g,'""');
    return `"${v}"`;
  }).join(","));
  return [head, ...lines].join("\n");
}

(async function init(){
  const raw = await j('/api/raw'); RAW = raw.rows||[];
  populateFilters(RAW);

  let filtered = filt(RAW);
  const k = setKpis(filtered);

  const charts = [];
  charts.push(gauge(document.getElementById('gauge'), k.winRate));
  charts.push(stackedMonthly(document.getElementById('stacked'), filtered));
  charts.push(cycleBuckets(document.getElementById('cycle'), filtered));
  charts.push(funnel(document.getElementById('funnel'), filtered));
  charts.push(topPartners(document.getElementById('partners'), filtered));
  charts.push(treemap(document.getElementById('tree'), filtered));
  charts.push(calendar(document.getElementById('cal'), filtered));
  table(document.getElementById('tableWrap'), filtered);

  function rerender(){
    filtered = filt(RAW);
    const k2 = setKpis(filtered);
    charts.forEach(c=>c.dispose());
    charts.length=0;
    charts.push(gauge(document.getElementById('gauge'), k2.winRate));
    charts.push(stackedMonthly(document.getElementById('stacked'), filtered));
    charts.push(cycleBuckets(document.getElementById('cycle'), filtered));
    charts.push(funnel(document.getElementById('funnel'), filtered));
    charts.push(topPartners(document.getElementById('partners'), filtered));
    charts.push(treemap(document.getElementById('tree'), filtered));
    charts.push(calendar(document.getElementById('cal'), filtered));
    table(document.getElementById('tableWrap'), filtered);
  }

  qs('#applyBtn').onclick = rerender;
  qs('#refreshBtn').onclick = async ()=>{
    const raw2 = await j('/api/raw'); RAW = raw2.rows||[]; rerender();
  };
  qs('#exportBtn').onclick = ()=>{
    const csv = toCSV(filtered);
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='design_dashboard_export.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  qs('#toggleTheme').onclick = ()=>{
    const b = document.body; b.dataset.theme = (b.dataset.theme==='dark')?'light':'dark';
    window.dispatchEvent(new Event('resize'));
  };
  window.addEventListener('resize', ()=>charts.forEach(c=>c.resize()));
})();
