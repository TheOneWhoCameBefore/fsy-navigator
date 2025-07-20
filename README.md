# FSY Navigator - Staff Calendar Application

A React-based calendar application for managing staff roles, duties, and schedules at FSY (For the Strength of Youth) conferences.

# FSY Navigator - Staff Calendar Application

A React-based calendar application for managing staff roles, duties, and schedules at FSY (For the Strength of Youth) conferences.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or later) and npm
- Firebase project with:
  - Anonymous Authentication enabled
  - Firestore database configured
  - Security rules properly set up

### Installation

1. **Clone and install:**
   ```bash
   npm install
   ```

2. **Configure Firebase:**
   - Create `src/firebase-config.js` with your Firebase credentials:
   ```javascript
   export const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "your-app-id"
   };
   
   export const appId = "your-unique-app-id";
   export const initialAuthToken = null;
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run preview
   ```

## 🎯 Features

- **Role-based Schedule Management**: View schedules for AC (Activity Counselor) and CN (Counselor) roles
- **Name Search**: Quickly find and filter by individual staff members
- **Dual View Modes**: Switch between table and card views
- **Responsive Design**: Optimized for mobile and desktop
- **Real-time Updates**: Live synchronization with Firebase
- **Interactive Modals**: Detailed event information with staff assignments
- **Duties Summary**: Quick overview of AC role responsibilities

## 📊 Database Structure

### Firestore Collections:

1. **`roleAssignments`** - Maps staff to roles
2. **`agendaEvents`** - Main schedule events  
3. **`roleEvents`** - Role-specific duties and assignments

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure
```
src/
├── App.jsx          # Main application component
├── main.jsx         # Application entry point
└── firebase-config.js # Firebase configuration
```

## 🔧 Configuration

### Firebase Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/{collection}/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🚀 Deployment

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy the `dist/` folder** to your hosting provider (Firebase Hosting, Netlify, Vercel, etc.)

## 🎨 Customization

The app uses Tailwind CSS for styling. Key customizable elements:
- Color schemes in the activity type indicators
- Mobile breakpoints and responsive behavior
- Modal layouts and interactions

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)  
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📄 License

This project is licensed under the MIT License.

## 📊 Database Structure

The application uses three Firebase Firestore collections:

### 1. **`roleAssignments`** - Staff assignments to roles
```javascript
{
  role: "AC 1",
  names: ["John Smith", "Sarah Johnson"],
  updatedAt: "2025-01-20T..."
}
```

### 2. **`agendaEvents`** - Main schedule events
```javascript
{
  weekday: "Monday",
  startTime: "9:00 AM",
  endTime: "10:00 AM", 
  eventName: "Morning Meeting",
  eventType: "agenda",
  assignedRoles: ["AC 1", "AC 2"],
  updatedAt: "2025-01-20T..."
}
```

### 3. **`roleEvents`** - Individual duties, breaks, free time
```javascript
{
  weekday: "Monday", 
  startTime: "10:00 AM",
  endTime: "11:00 AM",
  eventName: "Music Program Setup",
  eventType: "duty",
  assignedRoles: ["AC 1", "AC 3"],
  updatedAt: "2025-01-20T..."
}
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run upload-data` - Upload CSV data to Firebase
- `npm run clear-data` - Clear all Firebase collections
- `npm run reset-data` - Clear and re-upload all data

## 📁 Data Files

- `role_assignments.csv` - Maps staff members to their roles (AC 1, CN A, etc.)
- `duties_and_agenda.csv` - All schedule events, duties, breaks, and agenda items

## 🎨 Features

- **Interactive Calendar View:** Swipeable daily calendar with role-based filtering
- **Card & Table Views:** Switch between compact card view and detailed table view
- **Name Search:** Search and filter by staff member names
- **Role Filtering:** Show/hide specific roles (AC 1-10, CN A-J, etc.)
- **Event Details:** Click any event to see assigned staff and related events
- **Responsive Design:** Works on desktop and mobile devices
- **Real-time Updates:** Automatically syncs with Firebase changes

## 🏗️ Architecture

- **Frontend:** React 18 with Vite build system
- **Backend:** Firebase Firestore for data storage
- **Authentication:** Firebase Anonymous Authentication
- **Styling:** Tailwind CSS (via CDN)
- **Navigation:** Swiper.js for calendar sliding
- **State Management:** React hooks and context

## 📋 Event Types

- **`agenda`** - Main schedule items (meetings, meals, group activities)
- **`duty`** - Assigned staff responsibilities
- **`break`** - Rest periods and breaks
- **`free`** - Optional activities and free time
- **`meeting`** - Coordination meetings

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project
2. Enable Firestore database
3. Enable Anonymous Authentication
4. Update `src/firebase-config.js` with your project configuration
5. Set Firestore security rules (see `THREE_COLLECTION_STRUCTURE.md`)

### Development vs Production
- Development uses anonymous authentication
- Production may require custom authentication tokens
- Environment-specific configuration via global variables

## 📚 Documentation

See `THREE_COLLECTION_STRUCTURE.md` for detailed information about the database structure and data optimization.

## 🎯 Data Optimization

The application combines duplicate events from CSV data to reduce database operations by ~90%:
- **Before:** ~3,500 individual records with massive duplication
- **After:** ~300 unique combined events with assigned role arrays

This results in dramatically faster loading times and reduced Firebase costs.+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
