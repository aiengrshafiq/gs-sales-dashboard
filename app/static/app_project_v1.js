async function j(u){ const r = await fetch(u); return r.json(); }
function money(v){ v=+v||0; if(v>=1e9)return (v/1e9).toFixed(2)+"B"; if(v>=1e6)return (v/1e6).toFixed(2)+"M"; if(v>=1e3)return (v/1e3).toFixed(1)+"K"; return v.toFixed(0); }

(async ()=>{
  const k = await j('/api/projects/kpis');
  document.getElementById('k1').textContent = money(k.portfolio_value);
  document.getElementById('k2').textContent = k.in_progress;
  document.getElementById('k3').textContent = k.on_time_rate.toFixed(1)+'%';
  document.getElementById('k4').textContent = k.avg_progress.toFixed(1)+'%';
  document.getElementById('k5').textContent = `${k.avg_cpi.toFixed(2)} / ${k.avg_spi.toFixed(2)}`;
  document.getElementById('k6').textContent = money(k.outstanding_ar);

  function gauge(el,val){
    const c = echarts.init(el); c.setOption({series:[{type:'gauge',min:0,max:100,axisLine:{lineStyle:{width:14}},progress:{show:true,width:14},detail:{valueAnimation:true,formatter:v=>v.toFixed(1)+'%',color:'#fff'},data:[{value:val}]}]}); return c;
  }
  function pie(el,data){
    const c = echarts.init(el); c.setOption({tooltip:{trigger:'item',formatter:p=>`${p.name}: ${p.value} (${p.percent}%)`}, series:[{type:'pie',radius:['35%','70%'],roseType:'area',data}]}); return c;
  }
  function barH(el,labels,values){
    const c = echarts.init(el); c.setOption({tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>`${p[0].name}: ${money(p[0].value)}`},xAxis:{type:'value',axisLabel:{formatter: v=>money(v)}},yAxis:{type:'category',data:labels},series:[{type:'bar',data:values}]}); return c;
  }
  function bar(el,labels,values){
    const c = echarts.init(el); c.setOption({tooltip:{trigger:'axis'},xAxis:{type:'category',data:labels},yAxis:{type:'value'},series:[{type:'bar',data:values}]}); return c;
  }

  const st = await j('/api/projects/by-status');
  const he = await j('/api/projects/health');
  const lc = await j('/api/projects/by-location');
  const tc = await j('/api/projects/top-clients');
  const sv = await j('/api/projects/schedule-buckets');
  const ms = await j('/api/projects/monthly-starts');

  const charts = [];
  charts.push(gauge(document.getElementById('gauge'), k.on_time_rate));
  charts.push(pie(document.getElementById('status'), st.map(x=>({name:x.status, value:x.value}))));
  charts.push(pie(document.getElementById('health'), he.map(x=>({name:x.health, value:x.count}))));
  charts.push(barH(document.getElementById('loc'), lc.map(x=>x.location), lc.map(x=>x.value)));
  charts.push(barH(document.getElementById('clients'), tc.map(x=>x.client), tc.map(x=>x.value)));
  charts.push(bar(document.getElementById('var'), sv.map(x=>x.bucket), sv.map(x=>x.count)));
  charts.push(bar(document.getElementById('starts'), ms.labels, ms.values));

  window.addEventListener('resize', ()=>charts.forEach(c=>c.resize()));
})();
