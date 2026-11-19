# Quad Entry Compass

Create a crisp, minimalistic web app called 'KCC Event & Pass Portal' using React, Tailwind CSS, and Lucide icons. Use a clean white/slate color palette with emerald and amber status badges. Build a simple top navigation bar with 4 tabs: 'Events & Passes', 'Book Venue', 'Gate Scanner', and 'Admin'.

'Events & Passes': Show a clean grid of approved campus events (displaying Event Title, Assigned Venue, Date, Time, and Remaining Seats). Clicking 'Claim Entry Pass' opens a clean modal asking for Roll Number and College Email. After submitting, display a vertical Digital Entry Pass card with the student's official photo, Name, Roll No, Branch, Event Title, a QR Code, and an 'ACTIVE' badge.

'Book Venue': Left column has a clean form to request a venue (Event Title, Description, Organizer Roll No, Venue dropdown, Date, Start Time, End Time, Expected Crowd). Right column shows 'My Booking Requests' filtered by Organizer Roll No—if a request status is 'reassigned', highlight the newly assigned classroom/venue and Admin's remark with two buttons: 'Accept Reassigned Venue' and 'Decline & Cancel'.

'Gate Scanner': Two-column card. Left side has a webcam QR scanner area plus a manual token input box for testing. Right side displays a status panel that switches cleanly between Idle, Green 'ENTRY APPROVED' (showing official student photo, Name, Roll No, Branch, Event), and Red 'REJECTED: PASS ALREADY USED'.

'Admin': Top section lists Pending Venue Requests with 3 buttons: 'Approve', 'Reassign' (opens inline dropdown of all venues + remark input), and 'Reject'. Bottom section shows a clean 'College ERP Student Registry' table and a compact inline form to add a new student record.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/98564df4-1bd5-4aba-9620-e8f210348803).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
