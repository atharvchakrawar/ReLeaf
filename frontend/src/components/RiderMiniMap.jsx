import React, { useEffect, useRef } from 'react';

/**
 * RiderMiniMap — small Leaflet map embedded in the Rider page.
 * Shows the selected rider's live position (updates when rider prop changes).
 * Also shows all other riders as faded dots and the active job destination.
 */
export default function RiderMiniMap({ rider, allRiders, shelters, job }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const lineRef = useRef(null);
  const leafletRef = useRef(null);

  // Load Leaflet once
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    let cancelled = false;

    const loadL = () => new Promise(resolve => {
      if (window.L) { resolve(window.L); return; }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => resolve(window.L);
      document.head.appendChild(s);
    });

    loadL().then(L => {
      if (cancelled || !mapRef.current || mapInstance.current) return;
      leafletRef.current = L;
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false })
        .setView([18.524, 73.852], 15);
      mapInstance.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
      }).addTo(map);
    });

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update markers whenever rider/job data changes
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstance.current;
    if (!L || !map || !rider) return;

    // Clear old markers and lines
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }

    // Pulsing selected rider icon
    const pulseIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:22px;height:22px">
          <div style="
            position:absolute;top:0;left:0;
            width:22px;height:22px;border-radius:50%;
            background:rgba(199,107,0,0.25);
            animation:riderPulse 1.4s ease-out infinite;
          "></div>
          <div style="
            position:absolute;top:4px;left:4px;
            width:14px;height:14px;border-radius:50%;
            background:#c76b00;border:2.5px solid #fff;
            box-shadow:0 2px 6px rgba(0,0,0,0.45);
          "></div>
        </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const statusColor = {
      available: '#2d7a2d',
      in_transit: '#c76b00',
      assigned: '#1a5276',
      unresponsive: '#c0392b',
      standby: '#888'
    };

    // Selected rider marker
    const rm = L.marker([rider.lat, rider.lng], { icon: pulseIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(`<b>🏍️ ${rider.name}</b><br>Status: ${rider.status}<br>Reliability: ${rider.reliability}%`);
    markersRef.current.push(rm);

    // Other riders as faded dots
    (allRiders || []).filter(r => r.id !== rider.id).forEach(r => {
      const col = statusColor[r.status] || '#888';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:10px;height:10px;border-radius:50%;background:${col};opacity:0.45;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
        iconSize: [10, 10], iconAnchor: [5, 5]
      });
      const m = L.marker([r.lat, r.lng], { icon })
        .addTo(map)
        .bindPopup(`<b>${r.name}</b><br>${r.status}`);
      markersRef.current.push(m);
    });

    // If there's an active job, show destination + dashed line
    if (job) {
      const shelter = (shelters || []).find(s => s.id === job.shelter_id);
      if (shelter) {
        const destIcon = L.divIcon({
          className: '',
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#1e6b1e;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:10px">🏠</div>`,
          iconSize: [18, 18], iconAnchor: [9, 9]
        });
        const dm = L.marker([shelter.lat, shelter.lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>🏠 ${shelter.name}</b><br>ETA: ${job.eta_minutes?.toFixed(1)} min`);
        markersRef.current.push(dm);

        // Dashed route line
        lineRef.current = L.polyline(
          [[rider.lat, rider.lng], [shelter.lat, shelter.lng]],
          { color: '#c76b00', weight: 2.5, opacity: 0.7, dashArray: '6 6' }
        ).addTo(map);
      }
    }

    // Pan map to rider
    map.setView([rider.lat, rider.lng], map.getZoom());
  }, [rider, allRiders, shelters, job]);

  return (
    <>
      <style>{`
        @keyframes riderPulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
      <div
        ref={mapRef}
        style={{
          height: '220px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow)',
          marginTop: '12px',
          overflow: 'hidden'
        }}
      />
    </>
  );
}
