import React, { useEffect, useRef, useState } from 'react';
import { getBatches, getRiders, getShelters } from '../api.js';

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [markerCount, setMarkerCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Dynamically load leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const loadLeaflet = () => new Promise((resolve) => {
      if (window.L) { resolve(window.L); return; }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.head.appendChild(script);
    });

    let cancelled = false;
    let interval = null;

    loadLeaflet().then(L => {
      if (cancelled || !mapRef.current) return;
      if (mapInstance.current) return;

      const map = L.map(mapRef.current).setView([18.52, 73.85], 14);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(map);

      const makeIcon = (color, size = 14) => L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.5)"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const updateMarkers = async () => {
        if (!mapInstance.current || cancelled) return;
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        const [batches, riders, shelters] = await Promise.all([getBatches(), getRiders(), getShelters()]);
        let count = 0;

        // Donor/batch markers (blue)
        batches.forEach(b => {
          const urgentColor = b.safe_minutes_left < 10 ? '#c0392b' : b.safe_minutes_left < 30 ? '#c76b00' : '#1a5276';
          const m = L.marker([b.location.lat, b.location.lng], { icon: makeIcon(urgentColor, 16) })
            .addTo(map)
            .bindPopup(`
              <b>🥗 ${b.donor_name}</b><br>
              ${b.item_type} — ${b.remaining_qty} units<br>
              <span style="color:${b.safe_minutes_left < 10 ? 'red' : 'green'}">⏱ ${b.safe_minutes_left} min left</span><br>
              <span class="badge badge-${b.status}" style="font-size:0.7rem">${b.status}</span>
            `);
          markersRef.current.push(m);
          count++;
        });

        // Shelter markers (green = open, gray = closed)
        shelters.forEach(s => {
          const color = s.is_open ? '#2d7a2d' : '#888';
          const m = L.marker([s.location.lat, s.location.lng], { icon: makeIcon(color, 18) })
            .addTo(map)
            .bindPopup(`
              <b>🏠 ${s.name}</b><br>
              ${s.is_open ? '✅ Open' : '🔒 Closed'}<br>
              ${s.has_clean_water ? '💧 Water' : ''} ${s.has_cooking_fuel ? '🔥 Fuel' : ''}
            `);
          markersRef.current.push(m);
          count++;
        });

        // Rider markers (orange)
        riders.forEach(r => {
          const rColor = r.status === 'en_route' ? '#c76b00' : r.status === 'idle' ? '#2d7a2d' : '#888';
          const m = L.marker([r.location.lat, r.location.lng], { icon: makeIcon(rColor, 14) })
            .addTo(map)
            .bindPopup(`
              <b>🏍️ ${r.name}</b><br>
              ${r.status}<br>
              Trust: ${Math.round(r.trust_score * 100)}%
            `);
          markersRef.current.push(m);
          count++;
        });

        setMarkerCount(count);
        setLastUpdate(new Date().toLocaleTimeString());
      };

      updateMarkers();
      interval = setInterval(updateMarkers, 5000);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      markersRef.current.forEach(m => m.remove());
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">🗺️ Live Operations Map</h1>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12, fontSize: '0.85rem', alignItems: 'center' }}>
        {[
          { color: '#1a5276', label: 'Donor (fresh)' },
          { color: '#c76b00', label: 'Donor (urgent < 30 min)' },
          { color: '#c0392b', label: 'Donor (critical < 10 min)' },
          { color: '#2d7a2d', label: 'Shelter (open)' },
          { color: '#888',    label: 'Shelter (closed)' },
          { color: '#c76b00', label: 'Rider (en route)' },
          { color: '#2d7a2d', label: 'Rider (idle)' },
        ].map(item => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: item.color, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            {item.label}
          </span>
        ))}
        {lastUpdate && (
          <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: '0.78rem' }}>
            Updated: {lastUpdate} · {markerCount} markers
          </span>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        style={{
          height: '520px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)'
        }}
      />
      <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#aaa', textAlign: 'center' }}>
        Click any marker for details · Map refreshes every 5 seconds
      </div>
    </div>
  );
}
