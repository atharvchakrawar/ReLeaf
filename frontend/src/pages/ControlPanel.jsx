import React, { useState, useEffect } from 'react';
import {
  advanceClock, setClockSpeed, getClock,
  getRiders, getShelters,
  demoReset, demoTightBatch, demoKillRider, demoFillShelter, demoChaos, demoResilience,
  setWeather, getWeather
} from '../api.js';

export default function ControlPanel() {
  const [riders, setRiders] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [clock, setClock] = useState(null);
  const [msgs, setMsgs] = useState({});
  const [chaosRounds, setChaosRounds] = useState(3);
  const [chaosResult, setChaosResult] = useState(null);
  const [weatherTemp, setWeatherTempState] = useState(30);
  const [weatherResult, setWeatherResult] = useState(null);
  const [selectedKillRider, setSelectedKillRider] = useState('');
  const [selectedFillShelter, setSelectedFillShelter] = useState('');
  const [resilience, setResilience] = useState(null);

  useEffect(() => {
    getRiders().then(r => { setRiders(r); if (r[0]) setSelectedKillRider(r[0].id); }).catch(() => {});
    getShelters().then(s => {
      const real = s.filter(x => x.kind === 'shelter');
      setShelters(real);
      if (real[0]) setSelectedFillShelter(real[0].id);
    }).catch(() => {});
    getClock().then(setClock).catch(() => {});
    getWeather().then(w => setWeatherTempState(w.temp_c)).catch(() => {});
  }, []);

  const flash = (key, msg, ok) => {
    setMsgs(m => ({ ...m, [key]: { msg, ok } }));
    setTimeout(() => setMsgs(m => { const c = { ...m }; delete c[key]; return c; }), 3000);
  };

  const handle = (key, fn) => async () => {
    try { const r = await fn(); flash(key, '✓ Done', true); return r; }
    catch (e) { flash(key, '✗ ' + e.message, false); }
  };

  const handleChaos = async () => {
    try {
      await demoChaos(Number(chaosRounds));
      flash('chaos', `✓ Chaos: ${chaosRounds} rounds scheduled`, true);
      // Fetch resilience score after a brief delay
      setTimeout(async () => {
        try { setResilience(await demoResilience()); } catch {}
      }, 1000);
    } catch (e) { flash('chaos', '✗ ' + e.message, false); }
  };

  const handleFetchResilience = async () => {
    try { setResilience(await demoResilience()); flash('resilience', '✓ Score fetched', true); }
    catch (e) { flash('resilience', '✗ ' + e.message, false); }
  };

  const handleWeather = async () => {
    try {
      const res = await setWeather(Number(weatherTemp));
      setWeatherResult(res);
      flash('weather', '✓ Weather updated', true);
    } catch (e) { flash('weather', '✗ ' + e.message, false); }
  };

  const Msg = ({ k }) => msgs[k]
    ? <span className={`flash ${msgs[k].ok ? 'flash-ok' : 'flash-err'}`}>{msgs[k].msg}</span>
    : null;

  const resColor = r => r >= 70 ? 'var(--green)' : r >= 40 ? 'var(--orange)' : 'var(--red)';

  return (
    <div className="page">
      <h1 className="page-title">🎛️ Control Panel</h1>

      {/* Sim clock */}
      <div className="ctrl-section">
        <div className="section-title">
          🕐 Simulation Clock
          {clock && <span style={{ fontWeight: 400, fontSize: '0.85rem', marginLeft: 10, color: '#888' }}>
            {clock.sim_time ? clock.sim_time.slice(11, 19) : (clock.now != null ? `t=${clock.now.toFixed(1)}` : '—')} · {clock.speed}×
          </span>}
        </div>
        <div className="ctrl-row">
          <button className="btn btn-blue" onClick={handle('advance', () => advanceClock(5))}>⏩ +5 min</button>
          <Msg k="advance" />
          <button className="btn btn-red" onClick={handle('reset', demoReset)}>🔄 Reset Demo</button>
          <Msg k="reset" />
        </div>
        <div className="ctrl-row" style={{ marginTop: 10 }}>
          <span style={{ fontSize: '0.9rem', color: '#555', fontWeight: 600 }}>Speed:</span>
          {[1, 10, 60].map(sp => (
            <button key={sp} className="btn btn-gray"
              onClick={handle(`speed_${sp}`, () => setClockSpeed(sp))}>
              {sp}×
            </button>
          ))}
          <Msg k="speed_1" /><Msg k="speed_10" /><Msg k="speed_60" />
        </div>
      </div>

      {/* Test scenarios */}
      <div className="ctrl-section">
        <div className="section-title">🎬 Test Scenarios</div>

        <div className="ctrl-row">
          <button className="btn btn-orange" onClick={handle('tight', demoTightBatch)}>
            ⚡ Create Tight Batch (180 units, 75 min)
          </button>
          <Msg k="tight" />
        </div>

        <div className="ctrl-row" style={{ marginTop: 14 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Kill Rider:</span>
          <select className="form-select" value={selectedKillRider}
            onChange={e => setSelectedKillRider(e.target.value)}>
            {riders.map(r => <option key={r.id} value={r.id}>{r.name} (reliability {r.reliability}%)</option>)}
          </select>
          <button className="btn btn-red btn-sm" onClick={handle('kill_rider', () => demoKillRider(selectedKillRider))}>
            ☠ Kill
          </button>
          <Msg k="kill_rider" />
        </div>

        <div className="ctrl-row" style={{ marginTop: 10 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Fill Shelter (zero demand):</span>
          <select className="form-select" value={selectedFillShelter}
            onChange={e => setSelectedFillShelter(e.target.value)}>
            {shelters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-blue btn-sm" onClick={handle('fill_shelter', () => demoFillShelter(selectedFillShelter))}>
            📦 Fill
          </button>
          <Msg k="fill_shelter" />
        </div>
      </div>

      {/* Chaos */}
      <div className="ctrl-section">
        <div className="section-title">💥 Chaos Testing</div>
        <div className="ctrl-row">
          <label style={{ fontSize: '0.9rem' }}>Rounds:</label>
          <input type="number" min="1" max="20" value={chaosRounds}
            onChange={e => setChaosRounds(e.target.value)}
            className="form-input" style={{ width: 70 }} />
          <button className="btn btn-red" onClick={handleChaos}>💥 Run Chaos</button>
          <Msg k="chaos" />
          <button className="btn btn-gray btn-sm" onClick={handleFetchResilience}>📊 Fetch Resilience</button>
          <Msg k="resilience" />
        </div>

        {resilience && (
          <div style={{ marginTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="resilience-score" style={{ color: resColor(resilience.score) }}>
                {resilience.score}%
              </div>
              <div style={{ color: '#555', fontSize: '0.85rem' }}>Resilience Score</div>
            </div>
            <div className="stat-cards" style={{ marginTop: 14 }}>
              {[
                { label: 'Failures Injected', value: resilience.failures_injected, color: 'var(--red)' },
                { label: 'Recovered',         value: resilience.recovered,         color: 'var(--green)' },
                { label: 'Salvaged',          value: resilience.salvaged,          color: 'var(--purple)' },
                { label: 'Failed',            value: resilience.failed,            color: 'var(--orange)' }
              ].map(item => (
                <div className="stat-card" key={item.label}>
                  <div className="stat-value" style={{ color: item.color }}>{item.value}</div>
                  <div className="stat-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Weather */}
      <div className="ctrl-section">
        <div className="section-title">🌡️ Weather</div>
        <div className="ctrl-row">
          <label style={{ fontSize: '0.9rem' }}>
            Temperature: <b>{weatherTemp}°C</b>
            <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#888' }}>
              {weatherTemp <= 25 ? '(factor 1.0×)' : weatherTemp <= 35 ? '(factor 1.3×)' : '(factor 1.6×)'}
            </span>
          </label>
          <input type="range" min="20" max="45" value={weatherTemp}
            onChange={e => setWeatherTempState(Number(e.target.value))}
            style={{ width: 200 }} />
          <button className="btn btn-orange" onClick={handleWeather}>🌡️ Set</button>
          <Msg k="weather" />
        </div>
        {weatherResult && (
          <div className="alert alert-warn" style={{ marginTop: 12 }}>
            {weatherResult.note}
          </div>
        )}
      </div>
    </div>
  );
}
