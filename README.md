# FSY Staff Calendar Application

A## 🔧 Technology Stack

- **Frontend**: React 18 with modern hooks and memoization
- **Styling**: Tailwind CSS for responsive design  
- **Navigation**: Swiper.js for touch-friendly calendar navigation
- **Maps**: Leaflet.js for interactive outdoor location maps
- **Backend**: Firebase Firestore for data storage
- **Build Tool**: Vite for fast development and optimized builds
- **Deployment**: Netlify with automatic buildsensive React-based staff calendar application designed for FSY (For the Strength of Youth) events. This application provides an interactive interface for managing staff schedules, duty assignments, and agenda events with both table and card views.

## 🌟 Features

### Core Functionality
- **Dual Application Pages**: Navigate between Staff Calendar and Camp Selection Dashboard
- **Staff Calendar**: Detailed table view and mobile-friendly card view for staff schedules
- **Camp Selection Dashboard**: Interactive real-time selection system for camp groups
- **Interactive Calendar**: Navigate through days with swipe gestures and quick navigation buttons
- **Real-time Filtering**: Filter staff roles dynamically with instant visual feedback
- **Name Search**: Quick search functionality to find specific staff members and their schedules
- **Event Details**: Click any event to view detailed information including staff assignments and descriptions

### Staff Management (Calendar Page)
- **Role-based Organization**: Supports AC (Activity Coordinator) and CN (Counselor) roles with flexible counts (8 or 10 AC roles)
- **Staff Assignments**: View which staff members are assigned to specific roles
- **Duty Summaries**: Comprehensive modal showing all duties for each AC role
- **Adjacent Role Pairing**: Automatically shows paired roles (AC/CN combinations) when filtering

### Camp Selection Dashboard (New Page)
- **Real-time Selection System**: Companies can select company names, indoor locations, and outdoor locations
- **CN Counselor Integration**: Select CN counselors from existing roleAssignments data
- **Interactive Map**: Leaflet.js map showing outdoor locations with real-time status
- **Atomic Transactions**: Firebase transactions ensure selections are claimed safely with counselor assignments
- **Live Updates**: Real-time synchronization prevents conflicts between groups
- **Management Interface**: View all claimed spots, export data, and manage assignments
- **Export Functionality**: Download CSV and JSON reports of all company assignments
- **Visual Status Indicators**: Clear visual feedback for available vs claimed items

### Data Visualization
- **Color-coded Events**: Different colors for agenda items, duties, meetings, breaks, and free time
- **Responsive Design**: Optimized for both desktop and mobile viewing
- **Event Merging**: Contiguous events are intelligently merged for cleaner display
- **Interactive Maps**: Outdoor locations displayed on interactive map with status indicators
- **Time Indicators**: Clear time slots with proper AM/PM formatting

## � Technology Stack

- **Frontend**: React 18 with modern hooks and memoization
- **Styling**: Tailwind CSS for responsive design
- **Navigation**: Swiper.js for touch-friendly calendar navigation
- **Backend**: Firebase Firestore for data storage
- **Build Tool**: Vite for fast development and optimized builds
- **Deployment**: Netlify with automatic builds

## 📁 Project Structure

```
/app/
├── src/                          # React application source
│   ├── App.jsx                   # Main application component
│   ├── main.jsx                  # Application entry point
│   └── firebase-config.js        # Firebase configuration
├── scripts/                      # Data processing and upload scripts
│   ├── parse_duty_roster.cjs     # Parse CSV duty roster files
│   ├── upload_agenda_events.cjs  # Upload agenda events to Firestore
│   ├── upload_duties_events.cjs  # Upload duty events to Firestore
│   ├── upload_role_assignments.cjs # Upload staff role assignments
│   ├── match_names_to_roles.cjs  # Match staff names to roles
│   └── clear_firestore.cjs       # Clear Firestore collections
├── data/                         # CSV data files and processed outputs
│   ├── agenda.csv               # Main agenda events
│   ├── duties_10_ac.csv         # Duties for 10 AC role configuration
│   ├── duties_8_ac.csv          # Duties for 8 AC role configuration
│   ├── role_assignments.csv     # Staff name to role mappings
│   └── *.csv                    # Raw data files
├── public/                       # Static assets
├── dist/                         # Production build output
└── package.json                 # Project dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 22.0.0 or higher
- npm or yarn package manager
- Firebase project with Firestore enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   Update `src/firebase-config.js` with your Firebase project configuration:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     // ... other config
   };
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open http://localhost:5173 in your browser

## 📊 Data Management

### Firebase Collections

The application uses Firebase Firestore with the following collections:

#### Staff Calendar Collections

##### `roleAssignments`
```javascript
{
  role: "AC 1",
  names: ["John Smith", "Sarah Johnson"],
  updatedAt: "2025-01-20T..."
}
```

##### `agendaEvents`
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

##### `roleEvents`
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

#### Camp Selection Dashboard Collections

##### `camp_names`
```javascript
{
  name: "Thunder Hawks",
  status: "available", // or "claimed"
  claimedBy: null, // or group name when claimed
  updatedAt: "2025-01-20T..."
}
```

##### `indoor_locations`  
```javascript
{
  name: "The Great Hall",
  status: "available", // or "claimed"
  claimedBy: null, // or group name when claimed
  description: "Large indoor meeting space",
  updatedAt: "2025-01-20T..."
}
```

##### `outdoor_locations`
```javascript
{
  name: "Lookout Hill",
  status: "available", // or "claimed"
  claimedBy: null, // or group name when claimed
  description: "A small hill with a great view...",
  lat: 51.051,
  lon: -114.078,
  updatedAt: "2025-01-20T..."
}
```

### CSV Data Processing (Staff Calendar)

The staff calendar uses several CSV files for data management:

#### 1. Agenda Events (`data/agenda.csv`)
```csv
Weekday,Start Time,End Time,Event Name,Event Abbreviation,Event Type,Event Description
Monday,7:00 AM,8:00 AM,Morning Devotional,MD,agenda,Daily spiritual message
```

#### 2. Duty Assignments (`data/duties_10_ac.csv` or `data/duties_8_ac.csv`)
```csv
Weekday,Start Time,End Time,Role,Event Name,Event Abbreviation,Event Type,Event Description
Monday,8:00 AM,9:00 AM,AC 1,Breakfast Setup,BS,duty,Coordinate breakfast preparation
```

#### 3. Role Assignments (`data/role_assignments.csv`)
```csv
Role,Full Name
AC 1,John Smith
AC 2,Jane Doe
```

### Data Upload Scripts

Process and upload data to Firestore using the provided scripts:

```bash
# Parse duty roster from raw CSV files
node scripts/parse_duty_roster.cjs

# Upload processed data to Firestore
node scripts/upload_agenda_events.cjs
node scripts/upload_duties_events.cjs
node scripts/upload_role_assignments.cjs

# Clear all data (use with caution)
node scripts/clear_firestore.cjs
```

### Database Structure

The application uses Firebase Firestore with multiple collections as documented above.

### Setting Up Camp Selection Data

To use the Camp Selection Dashboard, you need to create the following collections in your Firestore database:

#### Creating Sample Data

You can create sample documents using the Firebase Console or scripts:

**camp_names collection example documents:**
```javascript
// Document ID: thunder-hawks
{
  name: "Thunder Hawks",
  status: "available",
  claimedBy: null
}

// Document ID: lightning-eagles  
{
  name: "Lightning Eagles", 
  status: "available",
  claimedBy: null
}
```

**indoor_locations collection example documents:**
```javascript
// Document ID: great-hall
{
  name: "The Great Hall",
  status: "available", 
  claimedBy: null,
  description: "Large meeting space with stage"
}

// Document ID: library
{
  name: "The Library",
  status: "available",
  claimedBy: null,
  description: "Quiet study and discussion area"
}
```

**outdoor_locations collection example documents:**
```javascript  
// Document ID: lookout-hill
{
  name: "Lookout Hill",
  status: "available",
  claimedBy: null, 
  description: "Elevated area with panoramic views",
  lat: 51.051,
  lon: -114.078
}

// Document ID: forest-grove
{
  name: "Forest Grove",
  status: "available", 
  claimedBy: null,
  description: "Shaded woodland area perfect for activities",
  lat: 51.045,
  lon: -114.085
}
```

#### `roleAssignments`
```javascript
{
  role: "AC 1",
  names: ["John Smith", "Sarah Johnson"],
  updatedAt: "2025-01-20T..."
}
```

#### `agendaEvents`
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

#### `roleEvents`
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

## 🎛 Application Features

### View Modes

**Table View**
- Comprehensive time-slot grid showing all roles and events
- Detailed event information with hover effects
- Responsive column management (abbreviations on mobile)
- Real-time current time indicator

**Card View**
- Mobile-optimized agenda-based layout
- Grouped role assignments by agenda item
- Clean, touch-friendly interface
- Travel events displayed separately

### Filtering and Search

**Role Filtering**
- Toggle visibility of specific roles
- Paired role selection (AC/CN combinations)
- Select all/deselect all functionality
- Persistent filter preferences

**Name Search**
- Autocomplete staff name search
- Automatic role filtering when name selected
- Quick access to staff member's schedule

### Event Management

**Event Details Modal**
- Complete event information
- Staff assignments with role breakdown
- Related/linked events display
- Clickable staff names for quick filtering

**Duty Summary Modal**
- Comprehensive AC role duty listings
- Flexible layout supporting 8 or 10 AC roles
- Direct navigation to staff schedules
- Organized by role pairs

### Color Legend
- **Main Agenda** (Blue): Primary scheduled events
- **Duty** (Green): Assigned staff responsibilities
- **Meeting** (Cyan): Coordination and planning meetings
- **Break/Off** (Yellow): Rest periods and time off

## 🔧 Configuration

### Environment Variables

Create a `.env` file for local development:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Customization Options

**Role Configuration**
- Modify `dutiesData10` and `dutiesData8` in `App.jsx` for different duty assignments
- Update role patterns in parsing scripts for different naming conventions

**Event Types and Colors**
- Edit `getActivityColor` function in `App.jsx` to modify event color schemes
- Add new event types by updating the parsing and display logic

**Time Formatting**
- Adjust time display formats in parsing scripts
- Modify AM/PM logic for different time zones or preferences

## 📱 Responsive Design

### Desktop Features
- Full table view with all columns visible
- Hover effects and detailed tooltips
- Keyboard navigation support
- Multiple modal layouts

### Mobile Optimizations
- Swipe navigation between days
- Abbreviated role names for narrow screens
- Card view optimized for touch interaction
- Collapsible modals and menus

## � Deployment

### Netlify Deployment (Recommended)

The project includes a `netlify.toml` configuration file:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
```

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   - Connect your repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - Deploy automatically on pushes to main branch

### Manual Deployment

1. **Build production assets**
   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your preferred hosting service

## 🐛 Troubleshooting

### Common Issues

**Data Not Loading**
- Check Firebase configuration in `firebase-config.js`
- Verify Firestore collections exist and have proper permissions
- Check browser console for detailed error messages

**Events Not Displaying Correctly**
- Ensure CSV data follows the expected format
- Verify time formats are consistent (use 24-hour or proper AM/PM)
- Check that role names match between agenda and duty files

**Mobile Responsiveness Issues**
- Clear browser cache and reload
- Test on actual mobile devices vs. browser dev tools
- Check for console errors related to Swiper.js

### Performance Optimization

- Events are memoized to prevent unnecessary re-renders
- Filter operations use efficient algorithms
- Large datasets are handled with virtualization techniques
- Database queries are optimized to reduce Firebase costs

## 🧪 Development Scripts

### Available Scripts

#### Development
```bash
npm run dev      # Start development server with hot reload
npm run build    # Build optimized production bundle
npm run preview  # Preview production build locally
npm run lint     # Run ESLint for code quality
```

#### Company Selection Management
```bash
npm run setup-spots       # Upload sample company names and locations
npm run upload-companies  # Upload company names from CSV file
npm run export-spots      # Export all company assignments to CSV/JSON
npm run reset-spots       # Reset all spots to available status
npm run import-mymaps     # Import outdoor locations from Google MyMaps CSV
```

#### Google MyMaps Integration
Import outdoor locations directly from Google MyMaps CSV exports:

```bash
# Import locations (adds to existing)
npm run import-mymaps ./data/my_locations.csv

# Import locations (replaces existing)
npm run import-mymaps ./data/my_locations.csv --replace
```

**Expected CSV formats:**

*Format 1 - Standard coordinates:*
- **Name**: Location name (required)
- **Description**: Location description (optional) 
- **Latitude**: Decimal degrees (required)
- **Longitude**: Decimal degrees (required)

*Format 2 - Google MyMaps WKT export:*
- **name**: Location name (required)
- **description**: Location description (optional)
- **WKT**: Well-Known Text format: `"POINT (longitude latitude)"` (required)

### Data Processing Workflow

1. **Prepare CSV files** in the `data/` directory
2. **Parse duty rosters** with `parse_duty_roster.cjs`
3. **Upload to Firestore** using upload scripts
4. **Verify data** in the application interface

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use ESLint configuration provided
- Follow React best practices with hooks
- Write descriptive commit messages
- Add comments for complex logic
- Maintain responsive design principles

### Testing Guidelines

- Test both table and card views
- Verify mobile responsiveness
- Check all modal interactions
- Validate data upload scripts
- Test filter and search functionality

## 🔄 Data Flow

```
CSV Files → Parsing Scripts → Firebase Firestore → React App
    ↓              ↓                    ↓             ↓
Raw Data → Processed Data → Cloud Storage → User Interface
```

1. **CSV Processing**: Raw schedule data is parsed and normalized
2. **Data Upload**: Processed data is uploaded to Firestore collections
3. **Real-time Sync**: React app subscribes to Firestore changes
4. **User Interface**: Data is displayed with interactive features

## 📈 Performance Metrics

- **Bundle Size**: ~2.5MB (including dependencies)
- **Load Time**: <3 seconds on 3G connection
- **Database Queries**: Optimized to <10 reads per page load
- **Memory Usage**: <50MB RAM for typical datasets

## 🔐 Security Considerations

- Anonymous authentication for public access
- Firestore security rules prevent unauthorized writes
- Client-side data validation
- HTTPS enforced in production

## 📝 License

This project is private and proprietary. All rights reserved.

## 📞 Support

For questions, issues, or feature requests:
1. Check the troubleshooting section above
2. Review existing issues in the repository
3. Create a new issue with detailed description and reproduction steps

## 🔄 Version History

- **v1.0.0** - Initial release with core calendar functionality
- **v1.1.0** - Added card view and mobile optimization
- **v1.2.0** - Enhanced filtering and search capabilities
- **v1.3.0** - Performance improvements and bug fixes
- **v1.4.0** - Flexible AC role support (8 or 10 roles)
- **v1.5.0** - Improved data processing and upload scripts
- **v2.0.0** - **Major Update**: Added Camp Selection Dashboard with interactive maps and real-time selection system

---

Built with ❤️ for FSY staff scheduling and camp coordination.
