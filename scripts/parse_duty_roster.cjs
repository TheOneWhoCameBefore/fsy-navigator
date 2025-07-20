#!/usr/bin/env node
/**
 * FSY Duty Roster CSV Parser (merge contiguous events)
 * - Blank cells: No Duty (free)
 * - Non-blank cells: event name/type
 * - Merge contiguous events with same name/type/role/weekday
 * - Outputs in duties_10_ac.csv format
 */

const fs = require('fs');

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

function parseCSVLine(line) {
  // Simple CSV parser for quoted fields
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function isRoleName(cell) {
  const trimmed = cell.trim();
  // Match AC columns (AC 1, AC 2, etc.) and CN columns (CN A, CN B, etc.)
  if (/^AC\s*\d+$/.test(trimmed)) return true;
  if (/^CN\s*[A-Z]$/i.test(trimmed)) return true;
  return false;
}

function isWeekday(cell) {
  return WEEKDAYS.includes(cell.trim());
}

function formatTime(timeStr, weekday = '', isAfternoon = false) {
  // Converts '7:30' to '7:30 AM' or '13:30' to '1:30 PM' with proper AM/PM logic
  if (!/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr;
  let [hour, minute] = timeStr.split(':').map(Number);
  
  let suffix = 'AM';
  let displayHour = hour;
  
  // Handle 24-hour format times (13:00 and above)
  if (hour >= 13) {
    suffix = 'PM';
    displayHour = hour - 12;
  }
  // Handle noon
  else if (hour === 12) {
    suffix = 'PM';
    displayHour = 12;
  }
  // Handle midnight
  else if (hour === 0) {
    suffix = 'AM';
    displayHour = 12;
  }
  // Handle ambiguous hours 1-11 based on context
  else {
    displayHour = hour;
    if (weekday === 'Sunday') {
      suffix = 'PM'; // Sunday events are evening
    } else if (isAfternoon) {
      suffix = 'PM'; // We've already crossed noon today
    } else {
      suffix = 'AM'; // Default to AM until we cross noon
    }
  }
  
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

function addMinutesToTime(timeStr, minutes) {
  let [hour, minute] = timeStr.split(':').map(Number);
  minute += minutes;
  if (minute >= 60) {
    hour += Math.floor(minute / 60);
    minute = minute % 60;
  }
  if (hour >= 24) hour = hour % 24;
  return `${hour}:${minute.toString().padStart(2, '0')}`;
}

function guessType(name) {
  const n = name.toLowerCase();
  if (n.includes('meeting')) return 'meeting';
  if (n.includes('time-off')) return 'break';
  if (n.includes('free') || n.includes('interview')) return 'free';
  return 'duty';
}

function guessAbbr(name) {
  const n = name.toLowerCase().trim();
  
  // Special mappings for common duty types
  const abbrevMap = {
    'meeting': 'ME',
    'interviews': 'IN', 
    'time-off': 'OF',
    'no duty': 'ND',
    'check-in set up': 'CS',
    'check-in #1': 'C1',
    'check-in #2': 'C2', 
    'check-in coordinator': 'CC',
    'bus arrival': 'BA',
    'orientation': 'OR',
    'orientation prep': 'OP',
    'dinner support': 'DS',
    'dinner coordinator': 'DC',
    'breakfast support': 'BS',
    'breakfast coordinator': 'BC',
    'seating support': 'SS',
    'hallway supervision': 'HS',
    'site-office': 'SO',
    'lights out': 'LO',
    'devotional coordinator': 'DV',
    'music performance coordinator (singers)': 'MP',
    'counselor dance': 'CD',
    'ac/cn meeting': 'AM'
  };
  
  // Check for exact matches first
  if (abbrevMap[n]) return abbrevMap[n];
  
  // Check for partial matches
  for (const [key, abbr] of Object.entries(abbrevMap)) {
    if (n.includes(key)) return abbr;
  }
  
  // Default: first two letters of first two words
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].substring(0,2).toUpperCase();
  return 'DU';
}

function guessDesc(name, type) {
  if (type === 'meeting') return 'A scheduled meeting for coordination, planning, or discussion.';
  if (type === 'break') return `Break time: ${name}.`;
  if (type === 'free') return 'Time without duty but still actively participating in the session.';
  if (type === 'duty') return `A specific duty or task: ${name}.`;
  return `Event: ${name}.`;
}

function main() {
  const inputFile = '../data/8 AC Duties Cleaned - 2025 Proposed Duty Roster.csv';
  const outputFile = '../data/duties_8_ac.csv';
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.split('\n');
  const rows = lines.map(parseCSVLine);

  // Identify role columns
  let roleColumns = {};
  for (let rowIdx = 0; rowIdx < Math.min(5, rows.length); rowIdx++) {
    const row = rows[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      if (isRoleName(row[colIdx])) {
        roleColumns[colIdx] = row[colIdx].trim();
      }
    }
  }

  // Parse events
  let currentWeekday = '';
  let timeRows = {};
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    // Detect weekday marker
    if (row[0] && isWeekday(row[0])) {
      currentWeekday = row[0].trim();
      continue;
    }
    // Detect time row
    if (row[0] && /^\d{1,2}:\d{2}$/.test(row[0].trim())) {
      timeRows[rowIdx] = row[0].trim();
    }
  }

  let events = [];
  console.log(`Found ${Object.keys(roleColumns).length} role columns:`, Object.values(roleColumns));
  console.log(`Processing ${Object.keys(timeRows).length} time rows...`);
  
  for (const [colIdx, roleName] of Object.entries(roleColumns)) {
    let sortedTimeRows = Object.entries(timeRows).map(([rowIdx, time]) => [parseInt(rowIdx), time]).sort((a, b) => a[0] - b[0]);
    let prevEvent = null;
    let currentDayIsAfternoon = false; // Track if we've crossed noon for current day
    let currentDay = '';
    
    for (const [rowIdx, timeStr] of sortedTimeRows) {
      // Find the weekday for this time slot
      let eventWeekday = '';
      for (let checkIdx = rowIdx; checkIdx >= 0; checkIdx--) {
        if (rows[checkIdx] && rows[checkIdx][0] && isWeekday(rows[checkIdx][0])) {
          eventWeekday = rows[checkIdx][0].trim();
          break;
        }
      }
      
      if (!eventWeekday) continue; // Skip if no weekday found
      
      // Reset afternoon flag when we move to a new day
      if (eventWeekday !== currentDay) {
        currentDayIsAfternoon = false;
        currentDay = eventWeekday;
      }
      
      const row = rows[rowIdx];
      const cellValue = (colIdx < row.length ? row[colIdx] : '').trim();
      
      let eventName, eventType, eventAbbr, eventDesc;
      if (!cellValue) {
        eventName = 'No Duty';
        eventType = 'free';
        eventAbbr = 'ND';
        eventDesc = 'Time without duty but still actively participating in the session.';
      } else {
        eventName = cellValue;
        eventType = guessType(cellValue);
        eventAbbr = guessAbbr(cellValue);
        eventDesc = guessDesc(cellValue, eventType);
      }
      
      let endTime = addMinutesToTime(timeStr, 5);
      
      // Use improved time formatting with day-aware AM/PM logic
      let startTimeOut = formatTime(timeStr, eventWeekday, currentDayIsAfternoon);
      let endTimeOut = formatTime(endTime, eventWeekday, startTimeOut.includes('PM'));
      
      // Update afternoon flag if we've crossed noon
      if (startTimeOut.includes('PM') && eventWeekday !== 'Sunday') {
        currentDayIsAfternoon = true;
      }
      
      // Merge contiguous events with same properties
      if (
        prevEvent &&
        prevEvent['Event Name'] === eventName &&
        prevEvent['Event Type'] === eventType &&
        prevEvent['Role'] === roleName &&
        prevEvent['Weekday'] === eventWeekday
      ) {
        prevEvent['End Time'] = endTimeOut;
      } else {
        if (prevEvent) events.push(prevEvent);
        prevEvent = {
          'Weekday': eventWeekday,
          'Start Time': startTimeOut,
          'End Time': endTimeOut,
          'Role': roleName,
          'Event Name': eventName,
          'Event Abbreviation': eventAbbr,
          'Event Type': eventType,
          'Event Description': eventDesc
        };
      }
    }
    if (prevEvent) events.push(prevEvent);
  }
  // Write output
  const headers = ['Weekday','Start Time','End Time','Role','Event Name','Event Abbreviation','Event Type','Event Description'];
  let csvContent = headers.join(',') + '\n';
  for (const event of events) {
    const row = headers.map(h => {
      let v = event[h] || '';
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    });
    csvContent += row.join(',') + '\n';
  }
  fs.writeFileSync(outputFile, csvContent, 'utf-8');
  console.log(` Saved ${events.length} merged events to ${outputFile}`);
}

main();
