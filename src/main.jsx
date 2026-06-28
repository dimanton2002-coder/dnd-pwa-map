import React, {useEffect, useMemo, useState} from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, ImageOverlay, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

const STORAGE_KEY = 'dnd-world-map-v1';
const DEFAULT_DATA = {
  mapUrl: '/sample-map.svg',
  bounds: [[0,0],[1000,1400]],
  role: 'master',
  locations: [
    {id:'1', name:'Арканвель', type:'city', x:620, y:460, publicText:'Старый торговый город у реки.', dmText:'Под городом спрятан голем.', visible:true},
    {id:'2', name:'Руины Эймара', type:'dungeon', x:890, y:670, publicText:'Заброшенные башни на холмах.', dmText:'Вход открывается в полнолуние.', visible:true}
  ]
};

const iconByType = (type) => L.divIcon({
  className: 'pin',
  html: `<div class="pin-dot ${type}"></div>`,
  iconSize: [24,24], iconAnchor: [12,12]
});

function loadData(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_DATA; } catch { return DEFAULT_DATA; }
}
function saveData(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function ClickToAdd({onAdd, role}){
  useMapEvents({ click(e){ if(role==='master') onAdd(e.latlng); } });
  return null;
}

function App(){
  const [data,setData] = useState(loadData);
  const [selected,setSelected] = useState(null);
  const [query,setQuery] = useState('');
  const isMaster = data.role === 'master';
  useEffect(()=>saveData(data),[data]);
  useEffect(()=>{ if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js'); },[]);

  const shown = useMemo(()=>data.locations.filter(l => (isMaster || l.visible) && l.name.toLowerCase().includes(query.toLowerCase())),[data.locations,query,isMaster]);

  function addLocation(latlng){
    const loc = {id: crypto.randomUUID(), name:'Новая локация', type:'city', x: Math.round(latlng.lng), y: Math.round(latlng.lat), publicText:'', dmText:'', visible:false};
    setData(d=>({...d, locations:[...d.locations,loc]})); setSelected(loc.id);
  }
  function updateLocation(id, patch){ setData(d=>({...d, locations:d.locations.map(l=>l.id===id?{...l,...patch}:l)})); }
  function deleteLocation(id){ setData(d=>({...d, locations:d.locations.filter(l=>l.id!==id)})); setSelected(null); }
  function exportJson(){
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='dnd-world.json'; a.click(); URL.revokeObjectURL(a.href);
  }
  function normalizeImportedData(raw){
    const next = {...DEFAULT_DATA, ...raw};
    if(!Array.isArray(next.bounds)) next.bounds = DEFAULT_DATA.bounds;
    if(typeof next.mapUrl !== 'string' || !next.mapUrl) next.mapUrl = DEFAULT_DATA.mapUrl;
    if(next.role !== 'master' && next.role !== 'player') next.role = 'master';
    if(!Array.isArray(next.locations)) next.locations = [];
    next.locations = next.locations.map((l, index) => ({
      id: String(l.id || crypto.randomUUID?.() || `${Date.now()}-${index}`),
      name: String(l.name || 'Без названия'),
      type: ['city','village','dungeon','region'].includes(l.type) ? l.type : 'city',
      x: Number.isFinite(Number(l.x)) ? Number(l.x) : 100,
      y: Number.isFinite(Number(l.y)) ? Number(l.y) : 100,
      publicText: String(l.publicText || ''),
      dmText: String(l.dmText || ''),
      visible: Boolean(l.visible)
    }));
    return next;
  }
  function importJson(file){
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = normalizeImportedData(parsed);
        setData(imported);
        setSelected(null);
        alert('Импорт завершён');
      } catch (err) {
        console.error(err);
        alert('Не удалось прочитать JSON. Проверь, что это файл экспорта dnd-world.json');
      }
    };
    reader.readAsText(file);
  }
  const current = data.locations.find(l=>l.id===selected);

  return <div className="app">
    <aside className="sidebar">
      <h1>🗺️ DND World Map</h1>
      <label>Роль</label>
      <select value={data.role} onChange={e=>setData({...data,role:e.target.value})}><option value="master">Мастер</option><option value="player">Игрок</option></select>
      <label>Поиск</label><input placeholder="Город, руины..." value={query} onChange={e=>setQuery(e.target.value)} />
      <div className="buttons"><button onClick={exportJson}>Экспорт</button><label className="file">Импорт<input type="file" accept="application/json" onChange={e=>{ if(e.target.files[0]) importJson(e.target.files[0]); e.target.value=''; }}/></label></div>
      <p className="hint">Мастер: клик по карте добавляет пин. Данные пока хранятся в браузере.</p>
      <h2>Локации</h2>
      <div className="list">{shown.map(l=><button key={l.id} onClick={()=>setSelected(l.id)} className={selected===l.id?'active':''}>{l.visible?'👁️':'🔒'} {l.name}</button>)}</div>
    </aside>
    <main>
      <MapContainer crs={L.CRS.Simple} bounds={data.bounds} maxBounds={data.bounds} minZoom={-2} className="map">
        <ImageOverlay url={data.mapUrl} bounds={data.bounds}/>
        <ClickToAdd onAdd={addLocation} role={data.role}/>
        {shown.map(l=><Marker key={l.id} position={[l.y,l.x]} icon={iconByType(l.type)} eventHandlers={{click:()=>setSelected(l.id)}}><Popup>{l.name}</Popup></Marker>)}
      </MapContainer>
    </main>
    {current && <section className="editor">
      <button className="close" onClick={()=>setSelected(null)}>×</button>
      <input className="title" value={current.name} disabled={!isMaster} onChange={e=>updateLocation(current.id,{name:e.target.value})}/>
      {isMaster && <><label>Тип</label><select value={current.type} onChange={e=>updateLocation(current.id,{type:e.target.value})}><option value="city">Город</option><option value="village">Деревня</option><option value="dungeon">Подземелье</option><option value="region">Регион</option></select><label><input type="checkbox" checked={current.visible} onChange={e=>updateLocation(current.id,{visible:e.target.checked})}/> Видно игрокам</label></>}
      <label>Описание для игроков</label><textarea value={current.publicText} disabled={!isMaster} onChange={e=>updateLocation(current.id,{publicText:e.target.value})}/>
      {isMaster && <><label>Секреты мастера</label><textarea value={current.dmText} onChange={e=>updateLocation(current.id,{dmText:e.target.value})}/><button className="danger" onClick={()=>deleteLocation(current.id)}>Удалить</button></>}
    </section>}
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
