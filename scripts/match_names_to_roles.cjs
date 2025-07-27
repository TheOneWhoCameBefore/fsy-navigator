#!/usr/bin/env node
/**
 * Best Match Role Assignment
 * - Calculates a "match score" between each role and each person/group.
 * - Assigns roles based on the highest score and uses elimination for the last pair.
 * - Includes "Time-off" as a key event for matching.
 */

const fs = require('fs');

// --- 1. Data Parsing Functions ---

function parseRoleSchedules() {
    const csv = fs.readFileSync('data/duties_8_ac.csv', 'utf-8').split(/\r?\n/);
    const acRoles = {};
    const cnRoles = {};

    for (let i = 1; i < csv.length; i++) {
        const row = csv[i];
        if (!row.trim()) continue;
        const cols = row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        
        const weekday = cols[0].replace(/"/g, '').trim();
        if (weekday !== 'Wednesday') continue;

        const eventName = cols[4].replace(/"/g, '').trim();
        // --- CHANGE: Only ignore "No Duty" ---
        if (eventName.toLowerCase() === 'no duty') continue;

        const role = cols[3].replace(/"/g, '').trim();
        const event = {
            start: cols[1].replace(/"/g, '').trim(),
            end: cols[2].replace(/"/g, '').trim(),
            name: eventName,
        };

        if (role.startsWith('AC')) {
            if (!acRoles[role]) acRoles[role] = [];
            acRoles[role].push(event);
        } else if (role.startsWith('CN')) {
            if (!cnRoles[role]) cnRoles[role] = [];
            cnRoles[role].push(event);
        }
    }
    return { acRoles, cnRoles };
}

function parseObservedSchedules() {
    const txt = fs.readFileSync('data/Wednesday Copy.txt', 'utf-8').split(/\r?\n/);
    const acSchedules = {};
    const cnGroupSchedules = {};
    const cnGroupMembers = {};

    let i = 0;
    while (i < txt.length) {
        let timeMatch = null;
        let timeLineIndex = i;
        while(timeLineIndex < txt.length) {
            const line = txt[timeLineIndex];
            if (line) {
                 timeMatch = line.match(/^(\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M)$/);
                 if (timeMatch) break;
            }
            timeLineIndex++;
        }

        if (!timeMatch) break;

        const time = { start: timeMatch[1], end: timeMatch[2] };

        let titleStartIndex = timeLineIndex + 1;
        let namesStartIndex = titleStartIndex;
        while(namesStartIndex < txt.length && !txt[namesStartIndex].startsWith('AC ') && !txt[namesStartIndex].startsWith('CN ')) {
            namesStartIndex++;
        }
        const eventName = txt.slice(titleStartIndex, namesStartIndex).map(l => l.trim()).filter(l => l && l.toLowerCase() !== 'no staff assigned').join(' ');
        
        // --- CHANGE: Stop ignoring "Time-off" events ---
        if (!eventName) {
            i = namesStartIndex;
            continue;
        }

        let namesEndIndex = namesStartIndex;
        while(namesEndIndex < txt.length && (txt[namesEndIndex] ? !txt[namesEndIndex].match(/^(\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M)$/) : true)) {
            namesEndIndex++;
        }

        const currentACs = [];
        const currentCNs = [];
        for (let k = namesStartIndex; k < namesEndIndex; k++) {
            const line = txt[k];
            if (!line || !line.trim()) continue;

            const isCn = line.startsWith('CN ');
            let name = line.replace(/^AC |^CN /, '').trim();
            
            let nextLineIndex = k + 1;
            while(nextLineIndex < namesEndIndex && txt[nextLineIndex] && !txt[nextLineIndex].startsWith('AC ') && !txt[nextLineIndex].startsWith('CN ') && !txt[nextLineIndex].match(/^(\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M)$/)) {
                 name += ' ' + txt[nextLineIndex].trim();
                 k++; 
                 nextLineIndex++;
            }

            if(isCn) currentCNs.push(name);
            else currentACs.push(name);
        }
        
        const event = { ...time, name: eventName };

        currentACs.forEach(name => {
            if (!acSchedules[name]) acSchedules[name] = [];
            acSchedules[name].push(event);
        });

        if (currentCNs.length > 0) {
            const groupKey = [...currentCNs].sort().join(';');
            if (!cnGroupMembers[groupKey]) {
                cnGroupMembers[groupKey] = currentCNs;
                cnGroupSchedules[groupKey] = [];
            }
            cnGroupSchedules[groupKey].push(event);
        }

        i = namesEndIndex;
    }
    
    return { acSchedules, cnGroupSchedules, cnGroupMembers };
}


// --- 2. Matching and Scoring Functions ---

function calculateMatchScore(scheduleA, scheduleB) {
    let score = 0;
    if (!scheduleA || !scheduleB) return 0;
    
    const eventsB = new Set(scheduleB.map(e => `${e.start}-${e.end}:${e.name.toLowerCase()}`));
    
    for (const eventA of scheduleA) {
        if (eventsB.has(`${eventA.start}-${eventA.end}:${eventA.name.toLowerCase()}`)) {
            score++;
        }
    }
    return score;
}

function findBestAssignments(roles, schedules) {
    const assignments = {};
    const assignedRoles = new Set();
    const assignedSchedules = new Set();
    const potentialMatches = [];

    for (const roleName in roles) {
        for (const scheduleName in schedules) {
            const score = calculateMatchScore(roles[roleName], schedules[scheduleName]);
            if (score > 0) {
                potentialMatches.push({ roleName, scheduleName, score });
            }
        }
    }

    potentialMatches.sort((a, b) => b.score - a.score);

    for (const match of potentialMatches) {
        if (!assignedRoles.has(match.roleName) && !assignedSchedules.has(match.scheduleName)) {
            assignments[match.roleName] = match.scheduleName;
            assignedRoles.add(match.roleName);
            assignedSchedules.add(match.scheduleName);
        }
    }
    return assignments;
}


// --- 3. Main Execution ---

const { acRoles, cnRoles } = parseRoleSchedules();
const { acSchedules, cnGroupSchedules, cnGroupMembers } = parseObservedSchedules();

let acAssignments = findBestAssignments(acRoles, acSchedules);
let cnAssignments = findBestAssignments(cnRoles, cnGroupSchedules);

// "Mop-up" Logic
const unassignedAcRoles = Object.keys(acRoles).filter(r => !acAssignments[r]);
const unassignedAcNames = Object.keys(acSchedules).filter(n => !Object.values(acAssignments).includes(n));
if (unassignedAcRoles.length === 1 && unassignedAcNames.length === 1) {
    acAssignments[unassignedAcRoles[0]] = unassignedAcNames[0];
    console.log(`\nℹ️  Assigned remaining AC role by elimination: ${unassignedAcRoles[0]} -> ${unassignedAcNames[0]}`);
}

const unassignedCnRoles = Object.keys(cnRoles).filter(r => !cnAssignments[r]);
const unassignedCnGroups = Object.keys(cnGroupSchedules).filter(g => !Object.values(cnAssignments).includes(g));
if (unassignedCnRoles.length === 1 && unassignedCnGroups.length === 1) {
    cnAssignments[unassignedCnRoles[0]] = unassignedCnGroups[0];
    console.log(`ℹ️  Assigned remaining CN role by elimination: ${unassignedCnRoles[0]}`);
}


// --- 4. Format and Output Results ---
const finalAssignments = [];
console.log("\n--- Assignment Results ---");

for (const role in acRoles) {
    const assignedName = acAssignments[role];
    finalAssignments.push({ role, names: assignedName || "" });
    if(assignedName) console.log(` ${role} -> ${assignedName}`);
    else console.log(` ${role} -> Not matched`);
}

for (const role in cnRoles) {
    const groupKey = cnAssignments[role];
    const assignedNames = groupKey ? cnGroupMembers[groupKey].join(';') : "";
    finalAssignments.push({ role, names: assignedNames });
     if(assignedNames) console.log(` ${role} -> ${assignedNames.replace(/;/g, ', ')}`);
    else console.log(` ${role} -> Not matched`);
}

const csvRows = ["role,names,updatedAt"];
finalAssignments.sort((a,b) => a.role.localeCompare(b.role)).forEach(a => {
    csvRows.push(`"${a.role}","${a.names}","${new Date().toISOString()}"`);
});

fs.writeFileSync('data/role_assignments.csv', csvRows.join("\n"));
console.log("\n Saved final assignments to role_assignments.csv");