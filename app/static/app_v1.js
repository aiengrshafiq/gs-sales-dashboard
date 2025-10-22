async function j(url){ const r = await fetch(url); return r.json(); }
function money(x){
  const v = Number(x||0);
  if (v>=1e9) return (v/1e9).toFixed(2)+"B";
  if (v>=1e6) return (v/1e6).toFixed(2)+"M";
  if (v>=1e3) return (v/1e3).toFixed(1)+"K";
  return v.toFixed(0);
}

function gaugeWinRate(el, value){
  const c = echarts.init(el);
  c.setOption({
    series: [{
      type: 'gauge',
      min: 0, max: 100,
      axisLine: { lineStyle: { width: 14 } },
      progress: { show: true, width: 14 },
      axisTick: { show:false }, splitLine:{length:10},
      detail: { valueAnimation: true, formatter: v => v.toFixed(1) + '%', fontSize: 24, color:'#fff' },
      data: [{ value: value }]
    }]
  });
  return c;
}

function bar(el, labels, values, titleY='Value'){
  const c = echarts.init(el);
  c.setOption({
    tooltip:{ trigger:'axis', formatter: params => `${params[0].axisValue}<br>${money(params[0].value)}` },
    grid:{ left:40, right:20, bottom:40, top:20 },
    xAxis:{ type:'category', data: labels, axisLabel:{ color:'#cbd5e1', rotate: labels.length>8?45:0 } },
    yAxis:{ type:'value', axisLabel:{ color:'#cbd5e1', formatter: v=>money(v) }},
    series:[{ type:'bar', data: values, barWidth: '55%'}]
  });
  return c;
}

function barH(el, labels, values){
  const c = echarts.init(el);
  c.setOption({
    tooltip:{ trigger:'axis', axisPointer:{type:'shadow'}, formatter: params => `${params[0].name}: ${money(params[0].value)}` },
    grid:{ left:120, right:20, bottom:30, top:10 },
    xAxis:{ type:'value', axisLabel:{ color:'#cbd5e1', formatter: v=>money(v) }},
    yAxis:{ type:'category', data: labels, axisLabel:{ color:'#cbd5e1' }},
    series:[{ type:'bar', data: values }]
  });
  return c;
}

function pie(el, data){
  const c = echarts.init(el);
  c.setOption({
    tooltip:{ trigger:'item', formatter: p => `${p.name}: ${money(p.value)} (${p.percent}%)` },
    series: [{ type:'pie', radius:['35%','70%'], roseType:'area', data }]
  });
  return c;
}

function treemap(el, data){
  // expects [{name, value}]
  const c = echarts.init(el);
  c.setOption({
    tooltip: { formatter: p => `${p.name}: ${money(p.value)}` },
    series: [{ type:'treemap', data, leafDepth:1, roam:true }]
  });
  return c;
}

function calendarHeatmap(el, pairs){
  // pairs: [[YYYY-MM-DD, count], ...]
  const c = echarts.init(el);
  const years = [...new Set(pairs.map(p => p[0].slice(0,4)))].sort();
  const year = years.length ? years[years.length-1] : new Date().getFullYear().toString();
  c.setOption({
    tooltip: { formatter: p => `${p.value[0]}: ${p.value[1]} issuance` },
    visualMap: { min: 0, max: Math.max(...pairs.map(p=>p[1]||0),5), orient:'horizontal', left:'center', top:0 },
    calendar: { top: 40, cellSize: [16,16], range: year, itemStyle: { color:'#1f2937', borderColor:'#0f172a' }, dayLabel:{ color:'#94a3b8' }, monthLabel:{ color:'#94a3b8' }, yearLabel:{ show:false } },
    series: [{ type:'heatmap', coordinateSystem:'calendar', data: pairs }]
  });
  return c;
}

(async ()=>{
  // KPIs
  const kp = await j('/api/kpis');
  document.getElementById('kpi-total-value').textContent = money(kp.total_project_value);
  document.getElementById('kpi-total-policy').textContent = money(kp.total_design_policy);
  document.getElementById('kpi-win').textContent = kp.win_rate.toFixed(1) + '%';
  document.getElementById('kpi-cycle').textContent = (kp.avg_cycle_days||0).toFixed(1);
  document.getElementById('kpi-upcoming').textContent = kp.upcoming_presentations_14d;

  const charts = [];

  // Win gauge
  charts.push(gaugeWinRate(document.getElementById('gauge_win'), kp.win_rate));

  // Monthly totals
  const monthly = await j('/api/monthly-totals');
  charts.push(bar(document.getElementById('bar_monthly'), monthly.labels, monthly.values));

  // Cycle buckets
  const cycles = await j('/api/cycle-buckets');
  charts.push(bar(document.getElementById('bar_cycle'), cycles.map(x=>x.bucket), cycles.map(x=>x.count), 'Deals'));

  // Status pie
  const status = await j('/api/by-status');
  charts.push(pie(document.getElementById('pie_status'), status.map(s=>({name:s.status, value:s.value}))));

  // Partner bar (horizontal)
  const partners = await j('/api/by-partner');
  charts.push(barH(document.getElementById('bar_partner'), partners.map(p=>p.partner), partners.map(p=>p.value)));

  // Location treemap
  const loc = await j('/api/by-location');
  charts.push(treemap(document.getElementById('tree_location'), loc.map(r=>({name:r.location, value:r.value}))));

  // Calendar heat
  const cal = await j('/api/calendar-issuance');
  charts.push(calendarHeatmap(document.getElementById('cal_issuance'), cal));

  window.addEventListener('resize', ()=> charts.forEach(c => c.resize()));
})();
