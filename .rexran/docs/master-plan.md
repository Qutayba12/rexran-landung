# ArabicCaller Master Plan v3.0 - Sovereign Edition

## 1. Vision & Mission
To build the most secure, compliant, and reliable AI-powered live call translation infrastructure in the UK. ArabicCaller bridges the language gap for immigrants (Arabic/Urdu/Bengali/Somali ↔ English) while ensuring absolute data privacy and fiscal transparency.

## 2. Core Strategic Pillars
- **Privacy-First (GDPR/ICO):** Zero-persistence voice processing and automated data retention.
- **Fiscal Integrity:** Real-time API usage tracking and automated cost kill-switches.
- **Technical Excellence:** Modular FastAPI architecture with sub-second latency.
- **User Empowerment:** Transparent PAYG (Pay-As-You-Go) pricing with zero commitment.

---

## 3. 8-Week Execution Roadmap

### Week 1: Legal Fortress & Accreditation
- **Entity:** Register UK LTD and open Wise/Stripe Business accounts.
- **Compliance:** Register with ICO as Data Controller.
- **Protection:** Secure Professional Indemnity Insurance and draft Legal Disclaimer.
- **Telephony:** Authenticate Twilio Business Profile for local UK numbers.

### Weeks 2–3: Elite Engine & Hard-Stop Logic
- **Modular Backend:** FastAPI architecture separating STT (Soniox), LLM (GPT-4o mini), and TTS (ElevenLabs Turbo 2.5).
- **Cybersecurity:** TLS 1.2+ encrypted WebSockets and In-Memory Buffer policy.
- **Financial Guardian:** Implement server-side Hard-Stop logic to hang up calls when estimated cost hits user balance.
- **Performance:** Sub-second latency optimization.

### Weeks 4–5: Data Engineering & Dashboard
- **Elite Schema (Supabase):** 
    - `users`: Balance, preferred language, unique phone.
    - `calls`: Metadata, Indexed `compliance_audit_id`, `retention_expiry_at`.
    - `api_usage_logs`: Detailed tracking of tokens, characters, and costs per call.
    - `transactions`: Ledger for top-ups and deductions.
- **Observability:** Prometheus + Grafana for real-time latency and cost monitoring.
- **User Portal:** Next.js 16 dashboard for credit management and language selection.

### Week 6: Field Testing & Compliance Audit
- **Closed Beta:** Pilot with 5 Community Ambassadors.
- **Stress Test:** Simulate 50 concurrent calls using Locust.
- **Retention Audit:** Verify automated data wiping based on expiry timestamps.

### Weeks 7–8: Commercial Launch & Growth
- **Premium Pricing Strategy:**
    - Starter: £0.50/min.
    - Pro: £0.35/min.
    - Enterprise: £0.25/min.
- **Growth Loops:** WhatsApp referral system and Ambassador rewards.
- **Strategic Ads:** Targeted Google/TikTok ads for GP, Council, and Banking scenarios.

---

## 4. Financial Profile (10,000 Min/Mo Projection)
- **Revenue:** ~£3,500.
- **Operational Cost:** ~£450 (AI + Telephony).
- **Fixed Overhead:** ~£60.
- **Net Profit (Post-Tax):** ~£2,400/mo.
- **Margin:** ~69%.

---

## 5. Technical Stack
- **Languages:** Python (FastAPI), TypeScript (Next.js 16).
- **Database:** Supabase (PostgreSQL).
- **AI Suite:** Soniox (STT), OpenAI (LLM), ElevenLabs (TTS).
- **Telephony:** Twilio Programmable Voice (Media Streams).
- **Accounting:** Xero Integration.
