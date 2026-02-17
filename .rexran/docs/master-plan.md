# ArabicCaller Master Plan v4.0 - Commercial Reality Edition

## 1. Vision & Mission
To build the most secure, compliant, and reliable AI-powered live call translation infrastructure in the UK. ArabicCaller prioritizes data sovereignty, distribution-led growth, and institutional transparency to solve the language barrier for the UK's immigrant population.

## 2. Core Strategic Pillars
- **Privacy-First (GDPR/ICO):** Zero-persistence processing + Automated Data Retention + DPAs with all sub-processors.
- **Distribution-Led Growth:** Focus on partnerships with NGOs, solicitors, and community centers over pure advertising.
- **Fiscal Fortress:** Real-time API usage tracking + Cost Kill-Switches + Minimum Commit for high-tier users.
- **Web-First Stability:** Perfecting the browser and API experience before considering native mobile development.

---

## 3. 8-Week Execution Roadmap

### Week 1: Legal & Compliance Fortress
- **Entity:** Register UK LTD; open Wise/Stripe Business.
- **Compliance:** Register with ICO; implement **Data Processing Agreements (DPAs)** with AI providers.
- **Protection:** Professional Indemnity Insurance + AI Accuracy Disclaimer.
- **Telephony:** Authenticate Twilio Business Profile (A2P 10DLC / UK Local equivalents).

### Weeks 2–3: Elite Engine & Financial Kill-Switch
- **Modular Backend:** FastAPI architecture for (Soniox STT / GPT-4o mini / ElevenLabs Turbo 2.5).
- **Security:** TLS 1.2+ encrypted WebSockets; In-Memory Buffer policy (No persistent audio).
- **Hard-Stop Logic:** Implement server-side logic to terminate calls immediately when `Estimated_Cost > User_Balance`.

### Weeks 4–5: Institutional Schema & Observability
- **Supabase Schema v4:**
    - `users`: Balance, Premium_Status, Unique Phone.
    - `calls`: `compliance_audit_id` [indexed], `retention_expiry_at`, `ai_engine_version`.
    - `api_usage_logs`: Token/Char level tracking + `hard_stop_triggered` flag.
    - `transactions`: Full ledger for auditing and HMRC compliance.
- **Monitoring:** Prometheus + Grafana for latency and burn-rate tracking.

### Week 6: Strategic Testing (PMF Search)
- **Qualitative Pilot:** Trial with 5 **Community Ambassadors** and 2 **Refugee NGOs**.
- **Stress Test:** Simulate 50 concurrent calls (Locust); verify Kill-Switch and Retention Wipe.

### Weeks 7–8: Distribution & Commercial Launch
- **Monetization (PAYG + Commit):**
    - Starter (£10 top-up): 50p/min.
    - Pro (£25 top-up): 35p/min.
    - Enterprise (£50 min commit): 25p/min + Basic SLA.
- **Partnership Launch:** MOUs with immigration solicitors and community support centers.
- **Strategic Content:** TikTok/WhatsApp demos focusing on GP/Bank/Council scenarios.

---

## 4. Financial Profile (Post-Tax Projection)
- **Target:** 10,000 Min/Mo through distribution partners.
- **Unit Margin:** ~30p profit per min (avg).
- **Est. Monthly Net Profit:** ~£2,400 after UK Corporation Tax (19%).

---

## 5. Roadmap Phase 2 (PMF Driven)
- **Certified PDF Transcripts:** Value-added service (£5/copy).
- **Whitelabel API:** For solicitors to provide the service directly to clients.
- **Native Mobile App:** Only after clear segment dominance and proven PMF.
