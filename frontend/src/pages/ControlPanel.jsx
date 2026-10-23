import React, { useState, useEffect } from 'react';
import {
  resetClock, setClockSpeed, advanceClock,
  getRiders, getShelters,
  createTightBatch, killRider, fillShelter, closeShelter,
  runChaos, setWeather, controlReset
} from '../api.js';

export default function ControlPanel() {
  const [riders, setRiders] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [msgs, setMsgs] = useState({});
  const [chaosRounds, setChaosRounds] = useState(3);
  const [chaosResult, setChaosResult] = useState(null);
  const [weatherTemp, setWeatherTemp] = useState(30);
  const [weatherResult, setWeatherResult] = useState(null);
  const [selectedKillRider, setSelectedKillRider] = useState('');
  const [selectedFillShelter, setSelectedFillShelter] = useState('');
  const [selectedCloseShelter, setSelectedCloseShelter] = useState('');

  useEffect(() => {
    getRiders().then(r => { setRiders(r); if (r[0]) setSelectedKillRider(r[0].id); }).catch(() => {});
    getShelters().then(s => { setShelters(s); if (s[0]) { setSelectedFillShelter(s[0].id); setSelectedCloseShelter(s[0].id); } }).catch(() => {});
  }, []);

  const flash = (key, msg, ok) => {
    setMsgs(m => ({ ...m, [key]: { msg, ok } }));
    setTimeout(() => setMsgs(m => { const c = { ...m }; delete c[key]; return c; }), 3000);
  };

  const handle = (key, fn) => async () => {
    try { await fn(); flash(key, '✓ Done', true); }
    catch (e) { flash(key, '✗ ' + e.message, false); }
  };

  const handleChaos = async () => {
    try {
      const res = await runChaos(Number(chaosRounds));
      setChaosResult(res);
      flash('chaos', '✓ Chaos complete', true);
    } catch (e) { flash('chaos', '✗ ' + e.message, false); }
  };

  const handleWeather = async () => {
    try {
      const res = await setWeather(Number(weatherTemp));
      setWeatherResult(res);
      flash('weather', '✓ Weather updated', true);
    } catch (e) { flash('weather', '✗ ' + e.message, false); }
  };

  const Msg = ({ k }) => msgs[k] ? (
    <span className={`flash ${msgs[k].ok ? 'flash-ok' : 'flash-err'}`}>{msgs[k].msg}</span>
  ) : null;

  return (
    <div className="page">
      <h1 className="page-title">🎛️ Control Panel</h1>

      {/* Simulation Controls */}
      <div className="ctrl-section">
        <div className="section-title">🕐 Simulation Controls</div>
        <div className="ctrl-row">
          <button className="btn btn-red" onClick={handle('reset', controlReset)}>🔄 Reset Sim</button>
          <Msg k="reset" />
          <button className="btn btn-blue" onClick={handle('advance', () => advanceClock(5))}>⏩ Advance 5 min</button>
          <Msg k="advance" />
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

      {/* Scenarios */}
      <div className="ctrl-section">
        <div className="section-title">🎬 Test Scenarios</div>

        <div className="ctrl-row">
          <button className="btn btn-orange" onClick={handle('tight', createTightBatch)}>
            ⚡ Create Tight Batch
          </button>
          <Msg k="tight" />
        </div>

        <div className="ctrl-row" style={{ marginTop: 14 }}>
          <span style={{ fontSize: '0.88rem', color: '#555', fontWeight: 600 }}>Kill Rider:</span>
          <select className="form-select" value={selectedKillRider} onChange={e => setSelectedKillRider(e.target.value)}>
            {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="btn btn-red btn-sm" onClick={handle('kill_rider', () => killRider(selectedKillRider))}>
            ☠ Kill
          </button>
          <Msg k="kill_rider" />
        </div>

        <div className="ctrl-row" style={{ marginTop: 10 }}>
          <span style={{ fontSize: '0.88rem', color: '#555', fontWeight: 600 }}>Fill Shelter:</span>
          <select className="form-select" value={selectedFillShelter} onChange={e => setSelectedFillShelter(e.target.value)}>
            {shelters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-blue btn-sm" onClick={handle('fill_shelter', () => fillShelter(selectedFillShelter))}>
            📦 Fill
          </button>
          <Msg k="fill_shelter" />
        </div>

        <div className="ctrl-row" style={{ marginTop: 10 }}>
          <span style={{ fontSize: '0.88rem', color: '#555', fontWeight: 600 }}>Close Shelter:</span>
          <select className="form-select" value={selectedCloseShelter} onChange={e => setSelectedCloseShelter(e.target.value)}>
            {shelters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-red btn-sm" onClick={handle('close_shelter', () => closeShelter(selectedCloseShelter))}>
            🔒 Close
          </button>
          <Msg k="close_shelter" />
        </div>
      </div>

      {/* Chaos */}
      <div className="ctrl-section">
        <div className="section-title">💥 Chaos Testing</div>
        <div className="ctrl-row">
          <label style={{ fontSize: '0.9rem' }}>Rounds (1–10):</label>
          <input
            type="number" min="1" max="10" value={chaosRounds}
            onChange={e => setChaosRounds(e.target.value)}
            className="form-input" style={{ width: 70 }}
          />
          <button className="btn btn-red" onClick={handleChaos}>💥 Run Chaos</button>
          <Msg k="chaos" />
        </div>

        {chaosResult && (
          <div style={{ marginTop: 16 }}>
            <div className={`resilience-score${chaosResult.resilience_score < 0.5 ? ' low' : chaosResult.resilience_score < 0.75 ? ' mid' : ''}`}>
              {Math.round(chaosResult.resilience_score * 100)}%
            </div>
            <div style={{ textAlign: 'center', color: '#555', fontSize: '0.85rem', marginTop: 4 }}>Resilience Score</div>
            <div className="stat-cards" style={{ marginTop: 14 }}>
              {[
                { label: 'Injected', value: chaosResult.injected, color: 'var(--red)' },
                { label: 'Recovered', value: chaosResult.recovered, color: 'var(--green)' },
                { label: 'Salvaged', value: chaosResult.salvaged, color: 'var(--purple)' },
                { label: 'Failed', value: chaosResult.failed, color: 'var(--orange)' }
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
        <div className="section-title">🌡️ Weather Control</div>
        <div className="ctrl-row">
          <label style={{ fontSize: '0.9rem' }}>Temperature: <b>{weatherTemp}°C</b></label>
          <input
            type="range" min="20" max="45" value={weatherTemp}
            onChange={e => setWeatherTemp(Number(e.target.value))}
            style={{ width: 180 }}
          />
          <button className="btn btn-orange" onClick={handleWeather}>🌡️ Set Weather</button>
          <Msg k="weather" />
        </div>

        {weatherResult && (
          <div className="alert alert-warn" style={{ marginTop: 14 }}>
            <div>
              <div><b>Shelf-life factor: {Math.round(weatherResult.shelf_life_factor * 100)}%</b></div>
              <div style={{ marginTop: 4 }}>{weatherResult.note}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
