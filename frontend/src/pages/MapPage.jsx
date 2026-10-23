import React, { useEffect, useRef } from 'react';
import { getBatches, getRiders, getShelters } from '../api.js';

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    // Dynamically load leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Dynamically load leaflet JS
    const loadLeaflet = () => new Promise((resolve) => {
      if (window.L) { resolve(window.L); return; }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.head.appendChild(script);
    });

    let cancelled = false;

    loadLeaflet().then(L => {
      if (cancelled || !mapRef.current) return;
      if (mapInstance.current) return;

      const map = L.map(mapRef.current).setView([18.52, 73.85], 14);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const makeIcon = (color) => L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7]
      });

      const updateMarkers = async () => {
        if (!mapInstance.current || cancelled) return;
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        const [batches, riders, shelters] = await Promise.all([getBatches(), getRiders(), getShelters()]);

        batches.forEach(b => {
          const m = L.marker([b.location.lat, b.location.lng], { icon: makeIcon('#1a5276') })
            .addTo(map)
            .bindPopup(`<b>${b.donor_name}</b><br>${b.item_type} — ${b.remaining_qty} units<br><span style="color:${b.safe_minutes_left < 10 ? 'red' : 'green'}">${b.safe_minutes_left} min left</span>`);
          markersRef.current.push(m);
        });

        shelters.forEach(s => {
          const color = s.is_open ? '#2d7a2d' : '#aaa';
          const m = L.marker([s.location.lat, s.location.lng], { icon: makeIcon(color) })
            .addTo(map)
            .bindPopup(`<b>${s.name}</b><br>${s.is_open ? '✅ Open' : '🔒 Closed'}`);
          markersRef.current.push(m);
        });

        riders.forEach(r => {
          const m = L.marker([r.location.lat, r.location.lng], { icon: makeIcon('#c76b00') })
            .addTo(map)
            .bindPopup(`<b>${r.name}</b><br>${r.status}<br>Trust: ${Math.round(r.trust_score * 100)}%`);
          markersRef.current.push(m);
        });
      };

      updateMarkers();
      const interval = setInterval(updateMarkers, 5000);

      return () => {
        clearInterval(interval);
        cancelled = true;
        markersRef.current.forEach(m => m.remove());
        if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
      };
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">🗺️ Live Map</h1>
      <div style={{ marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#1a5276', marginRight: 4 }}></span>Donors (blue)</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#2d7a2d', marginRight: 4 }}></span>Shelters open (green)</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#aaa', marginRight: 4 }}></span>Shelters closed (gray)</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#c76b00', marginRight: 4 }}></span>Riders (orange)</span>
      </div>
      <div ref={mapRef} style={{ height: '520px', borderRadius: 8, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }} />
    </div>
  );
}
