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
    const csv = fs.readFileSync('data/duties_10_ac.csv', 'utf-8').split(/\r?\n/);
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
            const isAc = line.startsWith('AC ');
            
            if (!isCn && !isAc) continue; // Skip lines that don't start with AC or CN
            
            let name = line.replace(/^AC |^CN /, '').trim();
            
            // Handle multi-line names more robustly
            let nextLineIndex = k + 1;
            while(nextLineIndex < namesEndIndex && 
                  txt[nextLineIndex] && 
                  !txt[nextLineIndex].startsWith('AC ') && 
                  !txt[nextLineIndex].startsWith('CN ') && 
                  !txt[nextLineIndex].match(/^(\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M)$/)) {
                 name += ' ' + txt[nextLineIndex].trim();
                 k++; 
                 nextLineIndex++;
            }

            // Clean up the name
            name = name.trim();
            if (!name) continue;

            if(isCn) currentCNs.push(name);
            else if(isAc) currentACs.push(name);
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
        const eventKey = `${eventA.start}-${eventA.end}:${eventA.name.toLowerCase()}`;
        if (eventsB.has(eventKey)) {
            // Weight different event types differently
            let eventScore = 1;
            const eventName = eventA.name.toLowerCase();
            
            // Higher weight for more specific/important events
            if (eventName.includes('coordination')) eventScore = 3;
            else if (eventName.includes('class support')) eventScore = 2.5;
            else if (eventName.includes('lunch support')) eventScore = 2;
            else if (eventName.includes('time-off')) eventScore = 1.5;
            
            score += eventScore;
        }
    }
    return score;
}

function calculateGroupStability(cnGroupSchedules, cnGroupMembers) {
    const groupStability = {};
    
    for (const groupKey in cnGroupSchedules) {
        const events = cnGroupSchedules[groupKey];
        const members = cnGroupMembers[groupKey];
        
        // Calculate stability based on:
        // 1. Number of events the group appears together
        // 2. Consistency of group composition
        // 3. Group size (medium-sized groups are often more stable)
        // 4. Diversity of event types (groups that work together across different types of events)
        
        const eventCount = events.length;
        const groupSize = members.length;
        
        // Base score from frequency
        let stabilityScore = eventCount * 10;
        
        // Group size bonus - medium-sized groups tend to be more stable
        if (groupSize >= 2 && groupSize <= 6) {
            stabilityScore += 30;
        } else if (groupSize === 1) {
            stabilityScore += 10; // Individual assignments can be stable too
        }
        
        // Event diversity bonus - groups that work together across different event types
        const eventTypes = new Set(events.map(e => e.name.toLowerCase().split(' ')[0]));
        stabilityScore += eventTypes.size * 5;
        
        // Time span bonus - groups that work together across different time periods
        const timeSlots = new Set(events.map(e => `${e.start}-${e.end}`));
        stabilityScore += timeSlots.size * 3;
        
        groupStability[groupKey] = stabilityScore;
    }
    
    return groupStability;
}

function findBestAssignments(roles, schedules, isAC = true) {
    const assignments = {};
    const assignedRoles = new Set();
    const assignedSchedules = new Set();
    const potentialMatches = [];

    // For CN roles, also calculate group stability
    let groupStability = {};
    if (!isAC && typeof schedules === 'object' && Object.keys(schedules).some(key => key.includes(';'))) {
        // This is cnGroupSchedules, calculate stability
        const cnGroupMembers = {}; // We need to reconstruct this
        for (const groupKey in schedules) {
            cnGroupMembers[groupKey] = groupKey.split(';');
        }
        groupStability = calculateGroupStability(schedules, cnGroupMembers);
    }
    
    // Special logic for CN roles - analyze duty patterns more carefully
    if (!isAC) {
        // Create enhanced matching for CN roles
        for (const roleName in roles) {
            for (const scheduleName in schedules) {
                let matchScore = calculateMatchScore(roles[roleName], schedules[scheduleName]);
                let stabilityBonus = groupStability[scheduleName] || 0;
                let patternBonus = calculateCNRolePatternBonus(roleName, scheduleName, roles[roleName], schedules[scheduleName]);
                
                let totalScore = matchScore + stabilityBonus + patternBonus;
                
                if (totalScore > 0) {
                    potentialMatches.push({ 
                        roleName, 
                        scheduleName, 
                        score: totalScore,
                        matchScore,
                        stabilityBonus,
                        patternBonus
                    });
                }
            }
        }
    } else {
        // Original logic for AC roles
        for (const roleName in roles) {
            for (const scheduleName in schedules) {
                const score = calculateMatchScore(roles[roleName], schedules[scheduleName]);
                if (score > 0) {
                    potentialMatches.push({ roleName, scheduleName, score });
                }
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

function calculateCNRolePatternBonus(roleName, groupKey, roleSchedule, groupSchedule) {
    let bonus = 0;
    const groupMembers = groupKey.split(';');
    const groupSize = groupMembers.length;
    
    // Remove the specific Amber assignment since we want general logic
    
    // Analyze the role's expected pattern from the duty schedule
    const roleEventTypes = new Set(roleSchedule.map(e => e.name.toLowerCase()));
    const groupEventTypes = new Set(groupSchedule.map(e => e.name.toLowerCase()));
    
    // Calculate event type overlap
    let eventTypeMatches = 0;
    for (const eventType of roleEventTypes) {
        if (groupEventTypes.has(eventType)) {
            eventTypeMatches++;
        }
    }
    
    // Bonus for good event type matching
    bonus += eventTypeMatches * 25;
    
    // Role-specific patterns based on typical CN group characteristics
    switch (roleName) {
        case 'CN A':
        case 'CN B':
        case 'CN C':
        case 'CN D':
            // These are typically larger, more active groups
            if (groupSize >= 4 && groupSize <= 6) bonus += 40;
            if (groupSchedule.length >= 3) bonus += 30; // Active in multiple time slots
            break;
            
        case 'CN E':
        case 'CN G':
            // These might be smaller groups
            if (groupSize >= 1 && groupSize <= 3) bonus += 35;
            // Bonus for individual assignments in these categories
            if (groupSize === 1) bonus += 20;
            break;
            
        case 'CN F':
        case 'CN H':
        case 'CN I':
        case 'CN J':
            // Medium-sized groups with specific patterns
            if (groupSize >= 3 && groupSize <= 5) bonus += 30;
            
            // Look for specific duty patterns that are common in these roles
            const hasClassSupport = groupSchedule.some(event => 
                event.name.toLowerCase().includes('class support'));
            const hasTimeOff = groupSchedule.some(event => 
                event.name.toLowerCase().includes('time-off'));
            const hasCoordination = groupSchedule.some(event => 
                event.name.toLowerCase().includes('coordination'));
            const hasLunchSupport = groupSchedule.some(event => 
                event.name.toLowerCase().includes('lunch support'));
                
            if (hasClassSupport) bonus += 20;
            if (hasTimeOff) bonus += 15;
            if (hasCoordination) bonus += 25;
            if (hasLunchSupport) bonus += 15;
            break;
    }
    
    return bonus;
}


// --- 3. Main Execution ---

const { acRoles, cnRoles } = parseRoleSchedules();
const { acSchedules, cnGroupSchedules, cnGroupMembers } = parseObservedSchedules();

let acAssignments = findBestAssignments(acRoles, acSchedules, true);
let cnAssignments = findBestAssignments(cnRoles, cnGroupSchedules, false);

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