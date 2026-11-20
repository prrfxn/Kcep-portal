# KCC Event & Pass Portal (KCEP)

An ERP-integrated campus venue booking and anti-counterfeit digital event pass portal built for **KCC Institute of Technology and Management**. The system prevents venue double-booking, supports admin venue reassignment counter-offers, issues single-use QR entry passes bound to official student records, and enforces 3-tier Role-Based Access Control (RBAC).

---

## Core Features

### 1. Events & Digital Entry Passes (Student View)
- **Live Approved Events Feed:** Displays upcoming and ongoing (`LIVE NOW`) campus events with assigned venue details, schedule, and real-time remaining seat counts (`venue.capacity - issued_passes`).
- **ERP-Bound Pass Generation:** Verifies `roll_no` and `official_email` against the locked `college_student_registry` before issuing a unique UUID `pass_token` QR ticket (strictly 1 pass per student per event).
- **Offline Pass Retrieval & Download:** Students can retrieve previously claimed passes via **View My Passes** and export high-resolution PNG tickets (`html-to-image`) for offline gate entry.

### 2. Campus Venue Booking & Counter-Offers (Organizer View)
- **Time-Overlap Conflict Detection:** Blocks double-bookings on the same date and time window (`start_time < new_end AND end_time > new_start`) across all `approved` and `reassigned` bookings.
- **Reassignment Counter-Offer Workflow:** If the Admin reassigns a booking to an alternate hall/classroom with a remark, the organizer can **Accept Reassigned Venue** or **Decline & Cancel** directly from *My Booking Requests*.

### 3. Gate Scanner Terminal (Gate Staff & Admin)
- **Live Camera & Manual Token Verification:** Uses `html5-qrcode` (with mobile rear-camera support) alongside a manual token fallback.
- **Multi-Layer Validation:**
  1. Checks event expiration (`REJECTED: PASS EXPIRED`).
  2. Checks active event filter (`REJECTED: WRONG EVENT`).
  3. Enforces single-use burn-after-scan locking (`is_used = true`, `scanned_at = now()`), flashing **Green (`ENTRY APPROVED`)** with official student photo/details on first scan and **Red (`REJECTED: PASS ALREADY USED`)** on duplicate or screenshot scans.

### 4. Admin Command Center & ERP Registry (Admin Only)
- **Booking Approvals & Reassignments:** Approve, reject, or reassign pending venue requests with conflict validation.
- **Live Attendance Analytics & CSV Export:** Tracks approved events, passes issued, and gate check-ins across upcoming and past events, with one-click attendance `.csv` exports containing summary metrics and timestamps.
- **College ERP Student Registry:** Manage student records with bulk `.csv` upsert imports and referential integrity protection.

### 5. 3-Tier RBAC & Night Mode
- **Student (Default):** Access to *Events & Passes* and *Book Venue*.
- **Gate Staff (`GATE2026`):** Unlocks *Gate Scanner* only (Principle of Least Privilege).
- **Admin (`KCC2026`):** Full access to *Admin*, *Gate Scanner*, and student modules.
- **Theme Support:** Built-in Light / Dark mode toggle persisted in `localStorage`.

---

## Tech Stack

- **Frontend:** React, TypeScript, TanStack Start / Router, Tailwind CSS, Lucide Icons
- **QR & Media:** `qrcode.react`, `html5-qrcode`, `html-to-image`
- **Backend & Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel

---

## Database Schema (PostgreSQL / Supabase)

1. **`college_student_registry`** — Master student records (`roll_no` PK, `full_name`, `branch`, `year`, `official_email`, `photo_url`).
2. **`venues`** — Campus halls and classrooms (`id` PK, `name`, `venue_type`, `capacity`).
3. **`events`** — Venue requests and approved events (`id` PK, `title`, `description`, `organizer_roll_no` FK, `requested_venue_id` FK, `assigned_venue_id` FK, `event_date`, `start_time`, `end_time`, `expected_crowd`, `status`, `admin_remark`).
4. **`event_passes`** — Single-use QR entry tickets (`id` PK, `event_id` FK, `roll_no` FK, `pass_token` UUID UNIQUE, `is_used`, `scanned_at`, `UNIQUE(event_id, roll_no)`).

---

## Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/prrfxn/Kcep-portal.git
   cd Kcep-portal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_publishable_anon_key
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```