# DVLA Contract Staff Attendance Management System

A modern, enterprise-grade **Contract Staff Attendance Management Web Application** designed for the **Driver and Vehicle Licensing Authority (DVLA Ghana)**.

---

## 🏛️ System Overview

The system enables contract staff to check in and check out with high punctuality accuracy, while administrators monitor attendance live, manage personnel, approve leaves, correct records, and generate audit-compliant reports.

---

## 🚀 Key Features

### 1. Simplified Check-In / Check-Out UX (Requirement 19)
- **Not Checked In**: Shows status and a prominent **[ CHECK IN ]** button.
- **Checked In**: Displays exact check-in time, station, and turns into **[ CHECK OUT ]**.
- **Attendance Complete**: Computes exact working hours (e.g. `8h 54m`) with timestamps.

### 2. Multi-Role Permissions (Requirement 2)
- **Administrator**: Complete control over contract staff onboarding, record corrections with mandatory reason logging, user management, audit logs, reports, and attendance rules.
- **Contract Staff**: Personal check-in/out terminal, working duration tracking, attendance history, and leave applications.

### 3. Core Business & Attendance Rules (Requirement 17)
1. **Single Check-In**: A staff member can only check in once per working day.
2. **Sequential Flow**: Cannot check out before checking in.
3. **Single Check-Out**: Cannot check out more than once per day.
4. **Automated Hours**: Automatically calculates exact working hours and minutes.
5. **Configurable Punctuality**: Configurable work start time (e.g. `08:00`) and late grace period (e.g. `15m`). Clocking in past 08:15 automatically flags as `LATE`.
6. **Administrative Corrections**: Admins can correct records; requires reason.
7. **Audit Logging**: All record adjustments, onboarding, logins, and status toggles are recorded in immutable audit logs.
8. **Staff Integrity**: Staff cannot edit their own records.
9. **Status Enforcement**: Deactivated/Inactive contract staff are blocked from checking in.
10. **Leave Integration**: Approved leave automatically marks attendance as `ON_LEAVE`.

---

## 📄 Application Pages

1. **Login**: [`/login`](http://localhost:3000/login) - Corporate authentication portal
2. **Forgot Password**: [`/forgot-password`](http://localhost:3000/forgot-password) - Recovery flow
3. **Admin Dashboard**: [`/admin/dashboard`](http://localhost:3000/admin/dashboard) - Statistics, charts, today's attendance table, recent audit activity
4. **Staff Dashboard**: [`/staff/dashboard`](http://localhost:3000/staff/dashboard) - 1-Click Check-in / Check-out, duration metrics, history
5. **Staff Management**: [`/staff`](http://localhost:3000/staff) - Staff roster, Ghana Card data, Add Staff modal, deactivate toggle
6. **Staff Profile**: [`/staff/[id]`](http://localhost:3000/staff/cs-001) - Complete profile with contract timeline and attendance summary
7. **Attendance Records**: [`/attendance`](http://localhost:3000/attendance) - Search, date/department/status filters, details modal, admin correction
8. **Reports & Exports**: [`/reports`](http://localhost:3000/reports) - Daily, Weekly, Monthly, Late, Hours reports with CSV export & print view
9. **Leave Management**: [`/leave`](http://localhost:3000/leave) - Submit leave, approve/reject workflow, attendance integration
10. **Notifications Center**: [`/notifications`](http://localhost:3000/notifications) - Real-time alerts & mark-as-read
11. **Audit Logs**: [`/audit-logs`](http://localhost:3000/audit-logs) - Immutable event logs with IP addresses and descriptions
12. **User Accounts**: [`/users`](http://localhost:3000/users) - Role provisioning and account toggles
13. **Settings**: [`/settings`](http://localhost:3000/settings) - Configurable shift times, grace thresholds, organization metadata
14. **User Profile**: [`/profile`](http://localhost:3000/profile) - Personal info & Change Password

---

## 🛠️ Tech Stack & Database Architecture

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Database Engine**: Native SQLite database (`node:sqlite` DatabaseSync) in `data/dvla_attendance.db` (zero external binary configuration needed, persistent, ACID compliant)
- **Prisma Schema**: `prisma/schema.prisma` with all 10 models, enums, relations, and indexes configured for MySQL
- **Security**: Password hashing with `bcryptjs`, tamper-proof HMAC session cookies, role-based middleware guards
