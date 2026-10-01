# Smart Calendar

Smart Calendar is a personal planner for tasks, calendar events, and reminders. The maintained app is a React web app that can be installed as a Progressive Web App (PWA), plus an optional Windows desktop app built with Electron.

## Features

- Create a local account and sign in on the current device.
- Add, edit, complete, reopen, and delete tasks.
- Set a date, time, category, priority, notes, and reminder time for each task.
- Set a task to repeat daily or weekly. Completing a repeating task creates its next occurrence.
- Browse tasks by calendar date; navigate months and add tasks for the selected date.
- Search and filter tasks by status or category.
- View upcoming, overdue (triggered), and all reminders.
- Review completed tasks, task statistics, and category totals; add custom categories.
- Adjust appearance, default reminder time, notification, and sound preferences.
- Use encrypted local storage. The PWA can work offline after its first visit; the Windows app can check reminders from the system tray while it is running.

## Choose how to run it

| Option | Best for | Requirements |
| --- | --- | --- |
| Run in a browser | Development and everyday use | A recent browser |
| Install as a PWA | App-like use from a supported browser | An HTTPS-hosted build for installation on another device |
| Install the Windows app | Windows desktop and background reminders | 64-bit Windows |
| Run the legacy backend | Developing the earlier server-backed API | JDK 26 and MySQL |

The current React PWA and Electron app use the local calendar store. They do **not** connect to the Spring Boot backend. The backend is kept for the earlier server-backed version and is optional.

## Run the web app locally

Install Node.js (the project was verified with Node.js 24) and npm. In PowerShell, from the repository root:

```powershell
cd frontend\smart-calendar-ui
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Useful frontend commands, run from `frontend\smart-calendar-ui`:

```powershell
npm test       # Run reminder and recurrence unit tests
npm run lint   # Check JavaScript and React code
npm run build  # Create the production web app in dist\
npm run preview
```

Use `npm install` instead of `npm ci` if you intentionally change dependencies and need to update the lock file.

## Install the PWA

To publish the browser app, build it with `npm run build` and host the contents of `frontend\smart-calendar-ui\dist` on a static host with HTTPS. Open the site in a supported browser and use its **Install app** command (or the in-app installation button when the browser offers it). The PWA manifest and service worker are in `frontend\smart-calendar-ui\public`.

The browser checks reminders while the app is open and requires notification permission. Browsers do not guarantee that reminders will fire after the app has been completely closed.

## Build or run the Windows desktop app

From `frontend\smart-calendar-ui`:

```powershell
npm run desktop:dev
npm run desktop:pack
```

`desktop:dev` starts Vite and Electron. In the desktop app, closing the window hides it in the system tray; choose **Quit Smart Calendar** from the tray menu to exit. The installer is generated in `frontend\smart-calendar-ui\release`. Packaging targets 64-bit Windows and produces an NSIS installer with Start menu and desktop shortcuts.

A prebuilt installer is also included at [`Smart Calendar Installer/SmartCalendar-Setup.exe`](./Smart%20Calendar%20Installer/SmartCalendar-Setup.exe). Run the installer and follow its prompts. Internet, Java, and MySQL are not required by the installed app.

The included installer is **unsigned**. Windows Smart App Control or other security software may block it. A trusted code-signing certificate is required to distribute a signed installer; signing cannot be done without the certificate and its password. To build and verify a signed installer locally, use `desktop\package-signed.ps1` from the React app directory when you have a valid code-signing `.pfx`. Keep the certificate and password private; never commit or distribute them.

## Local data and privacy

Each account's tasks, preferences, categories, and reminder history are stored on the current device in IndexedDB and encrypted in the app using a key derived from the account password. The account is local to the browser profile or desktop installation: it is not a cloud account, and data is not automatically shared or synchronized between devices or between the PWA and desktop app.

Remember the password. There is no server-side password reset or recovery for the local calendar. Clearing browser/site data, uninstalling or resetting the app data, or losing the device may remove the calendar. Keep your own backups if the data is important. The optional legacy backend does not import or back up this local data.

## Legacy Spring Boot backend (optional)

The backend source is in `Backend\SmartCalendarBackend`. It uses Spring Boot, Java 26, Spring Data JPA, Spring Security, and MySQL. Configure a local MySQL database and credentials for the backend before starting it; do not commit database passwords or other secrets.

PowerShell:

```powershell
cd Backend\SmartCalendarBackend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

The server uses port `8080` by default. Its task routes are under `/tasks`, and account routes are under `/auth`. The React app does not call these endpoints in the current local-first configuration.

## Project layout

```text
Smart-Calander/
├── README.md
├── Datase/
│   └── smart_calendar.sql                 # Legacy MySQL schema/data script
├── Backend/
│   └── SmartCalendarBackend/
│       ├── pom.xml
│       └── src/
│           ├── main/java/com/smartcalendar/ # Spring Boot API
│           ├── main/resources/              # Backend configuration
│           └── test/                        # Backend tests
├── frontend/
│   ├── smart-calendar-ui/                   # Maintained React/Vite app
│   │   ├── desktop/                         # Electron main, preload, packaging
│   │   ├── public/                          # PWA manifest, service worker, icons
│   │   └── src/
│   │       ├── api/                         # Encrypted local store and helpers
│   │       ├── components/                  # React pages and styles
│   │       ├── App.jsx
│   │       └── main.jsx
│   ├── assets/                              # Legacy frontend assets
│   ├── css/                                 # Legacy static frontend styles
│   └── js/                                  # Legacy static frontend scripts
└── Smart Calendar Installer/
    ├── README.txt
    └── SmartCalendar-Setup.exe              # Prebuilt Windows installer
```

The files under `frontend\css` and `frontend\js` are from the earlier static frontend. They are not the entry point for the maintained React app. Start React development in `frontend\smart-calendar-ui`.
