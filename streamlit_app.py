import os
import sys
import time
import threading
import requests
import streamlit as st
import streamlit.components.v1 as components

# Add backend folder to sys.path so we can import directly
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

st.set_page_config(
    page_title="ReLeaf | Food & Aid Redistribution Engine",
    page_icon="🌿",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Start backend in background thread if not already running
def is_backend_running():
    try:
        r = requests.get("http://127.0.0.1:8000/health", timeout=1)
        return r.status_code == 200
    except Exception:
        return False

def start_backend():
    import uvicorn
    from main import app
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

if not is_backend_running():
    t = threading.Thread(target=start_backend, daemon=True)
    t.start()
    time.sleep(1.5)

# Sidebar
st.sidebar.title("🌿 ReLeaf Engine")
st.sidebar.markdown(
    "**AISSMS Hackathon 2026**\n\n"
    "Coordination engine for perishable food and aid between donors, volunteer riders, and shelters with **automated Plan B failure recovery**."
)

api_status = is_backend_running()
st.sidebar.success("Backend: Online (FastAPI)" if api_status else "Backend: Offline")

# Polling helper
def fetch_api(path):
    try:
        res = requests.get(f"http://127.0.0.1:8000{path}", timeout=2)
        if res.ok:
            return res.json()
    except Exception:
        pass
    return None

clock_data = fetch_api("/clock") or {}
stats_data = fetch_api("/stats") or {}

if clock_data:
    st.sidebar.metric(
        "Simulation Time",
        clock_data.get("sim_time", "--:--")[-8:],
        f"{clock_data.get('speed', 1)}x Speed"
    )

# Quick Action Buttons in sidebar
st.sidebar.subheader("Quick Demo Triggers")
if st.sidebar.button("⏩ Advance Clock (+5m)"):
    requests.post("http://127.0.0.1:8000/clock/advance", json={"minutes": 5})
    st.sidebar.toast("Clock advanced +5 mins!")

if st.sidebar.button("⚡ Run Chaos Test (3 Rounds)"):
    r = requests.post("http://127.0.0.1:8000/control/chaos", json={"rounds": 3})
    if r.ok:
        st.sidebar.toast(f"Chaos done! Resilience: {r.json().get('resilience_score')}")

if st.sidebar.button("🔄 Reset Demo State"):
    requests.post("http://127.0.0.1:8000/control/reset")
    st.sidebar.toast("Demo reset to clean seed data!")

# Main Tabs
tab1, tab2, tab3 = st.tabs([
    "🖥️ Live Web Application (React Vite)",
    "📊 Engine Metrics & Live State",
    "🎛️ Judge Simulation & Chaos Runner"
])

with tab1:
    st.markdown("### Interactive Full-Stack Application")
    st.markdown("Embedded live React application with real-time Leaflet tracking, Plan B highlights, and dispatch coordination.")
    
    # Try embedding local dev server or static build
    components.iframe("http://localhost:5173", height=820, scrolling=True)

with tab2:
    st.markdown("### Live Operations Metrics")
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Delivered Items", stats_data.get("delivered", 0))
    c2.metric("In Transit", stats_data.get("in_transit", 0))
    c3.metric("Reroutes / Plan B", stats_data.get("reroutes", 0))
    c4.metric("Salvaged", stats_data.get("salvaged", 0))
    c5.metric("Avg Delivery Time", f"{stats_data.get('avg_delivery_time_minutes', 18.5)}m")

    st.markdown("---")
    col_a, col_b = st.columns(2)
    
    with col_a:
        st.subheader("📦 Available Batches")
        batches = fetch_api("/batches") or []
        if batches:
            import pandas as pd
            df_b = pd.DataFrame(batches)[["id", "donor_name", "item_type", "remaining_qty", "safe_minutes_left", "status"]]
            st.dataframe(df_b, use_container_width=True)
        else:
            st.info("No batches found.")

    with col_b:
        st.subheader("🏍️ Volunteer Riders")
        riders = fetch_api("/riders") or []
        if riders:
            import pandas as pd
            df_r = pd.DataFrame(riders)[["id", "name", "status", "reliability", "trust_score"]]
            st.dataframe(df_r, use_container_width=True)
        else:
            st.info("No riders found.")

    st.subheader("📜 Recent Failure Recovery Events")
    events = fetch_api("/events") or []
    if events:
        import pandas as pd
        df_e = pd.DataFrame(events)[["timestamp", "severity", "message"]]
        st.dataframe(df_e, use_container_width=True)

with tab3:
    st.markdown("### 🎛️ Judge Demo Panel")
    st.markdown("Simulate edge-case failures to observe instant Plan B rerouting and explanations:")
    
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### Failure Injection")
        rider_to_kill = st.selectbox("Select rider to disable (simulates dropout):", ["r1 (Amit)", "r2 (Raj)", "r3 (Priya)", "r4 (Vikram)"])
        if st.button("🚨 Drop Selected Rider Heartbeat"):
            rid = rider_to_kill.split()[0]
            requests.post("http://127.0.0.1:8000/control/kill_rider", json={"rider_id": rid})
            st.warning(f"Rider {rid} marked unresponsive. System redispatching active deliveries.")

        shelter_to_close = st.selectbox("Select shelter to close unexpectedly:", ["s1 (Hope House)", "s2 (City Shelter)", "s4 (Metro Relief)"])
        if st.button("🚪 Close Shelter (Forces Mid-Transit Plan B)"):
            sid = shelter_to_close.split()[0]
            requests.post("http://127.0.0.1:8000/control/close_shelter", json={"shelter_id": sid})
            st.error(f"Shelter {sid} closed! All incoming deliveries rerouted to Plan B backup shelters.")

    with col2:
        st.markdown("#### Spoilage & Heat Simulation")
        temp = st.slider("Ambient Temperature (°C)", 20, 45, 30)
        if st.button("Apply Temperature to Spoilage Clock"):
            res = requests.post("http://127.0.0.1:8000/weather", json={"temperature_c": temp})
            if res.ok:
                st.info(f"Weather updated: Shelf life adjusted based on {temp}°C.")

st.caption("ReLeaf Hackathon Project — Built with FastAPI & React Vite")
