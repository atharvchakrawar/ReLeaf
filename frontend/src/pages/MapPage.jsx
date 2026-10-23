import React, { useEffect, useRef, useState } from 'react';
import { getBatches, getRiders, getShelters, getAssignments } from '../api.js';

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const linesRef = useRef([]);
  const [markerCount, setMarkerCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [riderList, setRiderList] = useState([]);

  useEffect(() => {
    // Inject pulse keyframe once
    if (!document.getElementById('map-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'map-pulse-style';
      style.textContent = `
        @keyframes mapPulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          70%  { transform: scale(2.8); opacity: 0; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const loadLeaflet = () => new Promise(resolve => {
      if (window.L) { resolve(window.L); return; }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => resolve(window.L);
      document.head.appendChild(s);
    });

    let cancelled = false;
    let interval = null;

    loadLeaflet().then(L => {
      if (cancelled || !mapRef.current || mapInstance.current) return;

      const map = L.map(mapRef.current).setView([18.524, 73.852], 14);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // -- Icon factories --
      const dotIcon = (color, size = 14) => L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.45)"></div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2]
      });

      const pulsingRiderIcon = (color) => L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:22px;height:22px">
            <div style="position:absolute;top:0;left:0;width:22px;height:22px;border-radius:50%;background:${color}44;animation:mapPulse 1.5s ease-out infinite"></div>
            <div style="position:absolute;top:4px;left:4px;width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>
          </div>`,
        iconSize: [22, 22], iconAnchor: [11, 11]
      });

      const shelterIcon = (open, isSalvage) => {
        const bg = isSalvage ? '#6c3483' : open ? '#2d7a2d' : '#888';
        const emoji = isSalvage ? '♻️' : open ? '🏠' : '🔒';
        return L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;border-radius:6px;background:${bg};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:13px">${emoji}</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13]
        });
      };

      const updateMarkers = async () => {
        if (!mapInstance.current || cancelled) return;

        // Remove old
        markersRef.current.forEach(m => m.remove());
        linesRef.current.forEach(l => l.remove());
        markersRef.current = [];
        linesRef.current = [];

        const [batches, riders, shelters, assignments] = await Promise.all([
          getBatches(), getRiders(), getShelters(), getAssignments()
        ]);

        let count = 0;

        // Build shelter lookup
        const shelterMap = {};
        shelters.forEach(s => { shelterMap[s.id] = s; });

        // Build active assignment lookup per rider
        const riderAssignment = {};
        assignments.forEach(a => {
          if (['reserved', 'in_transit'].includes(a.status)) {
            riderAssignment[a.rider_id] = a;
          }
        });

        // Donor/batch markers
        batches.forEach(b => {
          const color = b.risk === 'critical' ? '#c0392b' : b.risk === 'urgent' ? '#c76b00' : '#1a5276';
          const m = L.marker([b.lat, b.lng], { icon: dotIcon(color, 16) })
            .addTo(map)
            .bindPopup(`
              <b>🥗 ${b.donor_name}</b><br>
              ${b.item_type} · ${b.remaining_qty}/${b.quantity} units<br>
              <span style="color:${b.risk === 'critical' ? 'red' : b.risk === 'urgent' ? 'orange' : 'green'}">
                ⏱ ${b.safe_minutes_left?.toFixed(0)} min safe
              </span><br>
              Risk: <b>${b.risk}</b>
            `);
          markersRef.current.push(m);
          count++;
        });

        // Shelter markers
        shelters.forEach(s => {
          const m = L.marker([s.lat, s.lng], { icon: shelterIcon(s.is_open, s.kind === 'salvage') })
            .addTo(map)
            .bindPopup(`
              <b>${s.kind === 'salvage' ? '♻️' : '🏠'} ${s.name}</b><br>
              ${s.is_open ? '✅ Open' : '🔒 Closed'} · ${s.kind}<br>
              ${s.has_clean_water ? '💧 Water · ' : ''}${s.has_cooking_fuel ? '🔥 Fuel' : ''}
            `);
          markersRef.current.push(m);
          count++;
        });

        // Rider markers — pulsing if in_transit
        const riderStatus = [];
        riders.forEach(r => {
          const isActive = r.status === 'in_transit' || r.status === 'assigned';
          const isUnresp = r.status === 'unresponsive';
          const color = isUnresp ? '#c0392b' : isActive ? '#c76b00' : '#2d7a2d';

          const icon = isActive ? pulsingRiderIcon(color) : dotIcon(color, 14);
          const m = L.marker([r.lat, r.lng], { icon, zIndexOffset: isActive ? 500 : 0 })
            .addTo(map)
            .bindPopup(`
              <b>🏍️ ${r.name}</b><br>
              Status: <b>${r.status}</b><br>
              Reliability: ${r.reliability}%<br>
              📍 ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}
            `);
          markersRef.current.push(m);
          count++;

          // Route line to destination if in_transit
          const asgn = riderAssignment[r.id];
          if (asgn && isActive) {
            const dest = shelterMap[asgn.shelter_id];
            if (dest) {
              const line = L.polyline(
                [[r.lat, r.lng], [dest.lat, dest.lng]],
                { color: '#c76b00', weight: 2.5, opacity: 0.65, dashArray: '7 7' }
              ).addTo(map);
              linesRef.current.push(line);

              // Midpoint label with ETA
              if (asgn.eta_minutes != null) {
                const midLat = (r.lat + dest.lat) / 2;
                const midLng = (r.lng + dest.lng) / 2;
                const etaLabel = L.divIcon({
                  className: '',
                  html: `<div style="background:#c76b00;color:#fff;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">⏱ ${asgn.eta_minutes.toFixed(0)} min</div>`,
                  iconAnchor: [0, 0]
                });
                const etaM = L.marker([midLat, midLng], { icon: etaLabel });
                etaM.addTo(map);
                markersRef.current.push(etaM);
              }
            }
          }

          riderStatus.push({ ...r, assignment: asgn || null });
        });

        setRiderList(riderStatus);
        setMarkerCount(count);
        setLastUpdate(new Date().toLocaleTimeString());
      };

      updateMarkers();
      interval = setInterval(updateMarkers, 2000); // every 2s for live feel
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      markersRef.current.forEach(m => m.remove());
      linesRef.current.forEach(l => l.remove());
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const statusColor = {
    available: 'var(--green)', in_transit: 'var(--orange)',
    assigned: 'var(--blue)', unresponsive: 'var(--red)', standby: 'var(--gray)'
  };

  return (
    <div className="page">
      <h1 className="page-title">🗺️ Live Operations Map</h1>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Map */}
        <div style={{ flex: '1 1 520px' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, fontSize: '0.8rem', alignItems: 'center' }}>
            {[
              { color: '#1a5276', label: 'Donor (safe)' },
              { color: '#c76b00', label: 'Donor (urgent)' },
              { color: '#c0392b', label: 'Donor (critical)' },
              { color: '#2d7a2d', label: 'Shelter (open)' },
              { color: '#888',    label: 'Shelter (closed)' },
              { color: '#6c3483', label: 'Salvage sink' },
              { color: '#c76b00', label: 'Rider (active 🔴)' },
              { color: '#2d7a2d', label: 'Rider (idle)' },
            ].map(item => (
              <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: item.color, border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                {item.label}
              </span>
            ))}
            {lastUpdate && (
              <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                🔄 {lastUpdate} · {markerCount} markers
              </span>
            )}
          </div>

          <div
            ref={mapRef}
            style={{
              height: '520px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden'
            }}
          />
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Click any marker for details · Refreshes every 2 seconds · Pulsing dot = active rider
          </div>
        </div>

        {/* Rider status sidebar */}
        <div style={{ flex: '0 0 230px', minWidth: 200 }}>
          <div className="section-title">🏍️ Rider Tracker</div>
          {riderList.length === 0 ? (
            <div className="spinner" />
          ) : (
            riderList.map(r => (
              <div key={r.id} className="card" style={{
                padding: '12px 14px',
                borderLeft: `4px solid ${statusColor[r.status] || 'var(--gray)'}`,
                marginBottom: 10
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                  {r.name}
                </div>
                <span className={`badge badge-${r.status}`} style={{ marginBottom: 6, display: 'inline-block' }}>
                  {r.status}
                </span>

                {/* Blinking dot for active */}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  📍 {r.lat.toFixed(4)}, {r.lng.toFixed(4)}<br />
                  ⭐ {r.reliability}% reliable
                  {r.assignment && (
                    <>
                      <br />
                      🎯 → {r.assignment.shelter_id}
                      <br />
                      ⏱ ETA: <b style={{ color: 'var(--orange)' }}>{r.assignment.eta_minutes?.toFixed(1)} min</b>
                    </>
                  )}
                  {r.status === 'unresponsive' && (
                    <div style={{ color: 'var(--red)', fontWeight: 700, marginTop: 4 }}>
                      ⚠️ No heartbeat!
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
