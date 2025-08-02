import { useMemo, useCallback } from 'react';

const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
    const [time, period] = timeStr.split(' ');
    if (!time || !period) return null;
    let [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    if (period.toLowerCase() === 'pm' && hours !== 12) hours += 12;
    if (period.toLowerCase() === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const period = h >= 12 && h < 24 ? 'PM' : 'AM';
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
};

const useCalendarData = (schedules) => {
    // Memoize the initial merging of events
    const mergedEvents = useMemo(() => {
        return schedules.map(event => ({
            ...event,
            assignedRoles: event.assignedRoles || (event.role ? [event.role] : [])
        }));
    }, [schedules]);

    // Memoize the processing of events into a daily structure
    const processedData = useMemo(() => {
        const data = {};
        ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach(day => data[day] = []);
        
        mergedEvents.forEach(event => {
            const startMins = timeToMinutes(event.startTime);
            const endMins = timeToMinutes(event.endTime);
            if (event.weekday && data[event.weekday] && startMins !== null) {
                data[event.weekday].push({
                    ...event,
                    startMins,
                    endMins: endMins === null ? startMins + 15 : endMins,
                });
            }
        });
        return data;
    }, [mergedEvents]);

    

    // Memoize the complex event linking logic
    const findLinkedEvents = useCallback((currentEvent) => {
        const linkedEvents = [];
        const currentEventName = currentEvent.eventName;
        const currentEventType = currentEvent.eventType;
        const currentWeekday = currentEvent.weekday;

        const filterAndAddEvents = (keywords, targetEventType, checkFn) => {
            if (keywords.length > 0) {
                const currentStartMins = timeToMinutes(currentEvent.startTime);
                const currentEndMins = timeToMinutes(currentEvent.endTime);

                const relatedEvents = mergedEvents.filter(event => {
                    if (event.weekday !== currentWeekday) return false;
                    if (targetEventType && event.eventType.toLowerCase() !== targetEventType) return false;
                    if (!keywords.some(keyword => event.eventName.includes(keyword))) return false;
                    if (event.eventName === currentEventName && event.eventType === currentEventType) return false; // Don't link to self

                    if (checkFn) {
                        return checkFn(event, currentStartMins, currentEndMins);
                    }
                    return true;
                });
                linkedEvents.push(...relatedEvents);
            }
        };

        const timeProximityCheck = (event, currentStartMins, currentEndMins) => {
            const eventStartMins = timeToMinutes(event.startTime);
            const eventEndMins = timeToMinutes(event.endTime);

            if (currentStartMins === null || currentEndMins === null ||
                eventStartMins === null || eventEndMins === null) {
                return true;
            }

            // Calculate overlap duration
            const overlap = Math.max(0, Math.min(currentEndMins, eventEndMins) - Math.max(currentStartMins, eventStartMins));
            const timeDiff = Math.abs(currentStartMins - eventStartMins);

            // If there's any overlap, they're related
            if (overlap > 0) return true;
            
            // For Class events specifically, be more lenient with afternoon timing
            // Class Coordinator (1:15 PM - 3:30 PM) should link to all Class Support in afternoon
            if (currentStartMins >= 780 && eventStartMins >= 780) { // Both after 1 PM
                // Allow linking if events are within the broader afternoon class period
                const currentSpansAfternoon = currentStartMins < 930 && currentEndMins > 780; // Overlaps 1 PM - 3:30 PM
                const eventSpansAfternoon = eventStartMins < 930 && eventEndMins > 780;
                
                if (currentSpansAfternoon && eventSpansAfternoon) {
                    return true;
                }
            }
            
            // If events are within 60 minutes of each other, check if they're in the same time period
            if (timeDiff <= 60) {
                const isCurrentMorning = currentStartMins < 780; // 1 PM = 780 minutes
                const isEventMorning = eventStartMins < 780;
                return isCurrentMorning === isEventMorning;
            }
            
            return false;
        };

        // Agenda to Duty linking
        if (currentEventType.toLowerCase() === 'agenda') {
            const agendaKeywords = [];
            if (currentEventName.includes('Check-in') || currentEventName.includes('Check-In') || currentEventName.includes('Check In')) agendaKeywords.push('Check-in', 'Check-In', 'Check In');
            if (currentEventName.includes('Games Night')) agendaKeywords.push('Games Night');
            if (currentEventName.includes('Pizza Night')) agendaKeywords.push('Pizza Night');
            if (currentEventName.includes('Dance')) agendaKeywords.push('Dance');
            if (currentEventName.includes('Class')) agendaKeywords.push('Class');
            if (currentEventName.includes('Breakfast')) agendaKeywords.push('Breakfast');
            if (currentEventName.includes('Lunch')) agendaKeywords.push('Lunch');
            if (currentEventName.includes('Dinner')) agendaKeywords.push('Dinner');
            if (currentEventName.includes('Testimony')) agendaKeywords.push('Testimony');
            if (currentEventName.includes('Devotional')) agendaKeywords.push('Devotional');
            if (currentEventName.includes('Service')) agendaKeywords.push('Service');
            if (currentEventName.includes('Activity')) agendaKeywords.push('Activity');
            if (currentEventName.includes('Orientation')) agendaKeywords.push('Orientation');
            if (currentEventName.includes('Flex Time') || currentEventName.includes('Participant Flex Time')) agendaKeywords.push('Flex Time');
            if (currentEventName.includes('Musical Program')) agendaKeywords.push('Musical Program');
            if (currentEventName.includes('Variety Show')) agendaKeywords.push('Variety Show');
            if (currentEventName.includes('Travel to Variety Show')) agendaKeywords.push('Variety Show');
            if (currentEventName.includes('Young Men Morning Devotional and Young Women Activity')) agendaKeywords.push('YM', 'YW', 'YM/YW', 'YM//YW', 'Young Men', 'Young Women');
            if (currentEventName.includes('Young Women Morning Devotional and Young Men Activity')) agendaKeywords.push('YM', 'YW', 'YM/YW', 'YM//YW', 'Young Men', 'Young Women');

            filterAndAddEvents(agendaKeywords, null, (event, currentStartMins, currentEndMins) => {
                if (event.eventType.toLowerCase() === 'agenda') return false;
                if (agendaKeywords.includes('Class') && event.eventName.includes('Class')) {
                    return timeProximityCheck(event, currentStartMins, currentEndMins);
                }
                return true;
            });
        } else { // Duty to Agenda linking
            const dutyKeywords = [];
            if (currentEventName.includes('Check-in') || currentEventName.includes('Check-In') || currentEventName.includes('Check In')) dutyKeywords.push('Check-in', 'Check-In', 'Check In');
            if (currentEventName.includes('Games Night')) dutyKeywords.push('Games Night');
            if (currentEventName.includes('Pizza Night')) dutyKeywords.push('Pizza Night');
            if (currentEventName.includes('Dance')) dutyKeywords.push('Dance');
            if (currentEventName.includes('Class')) dutyKeywords.push('Class');
            if (currentEventName.includes('Breakfast')) dutyKeywords.push('Breakfast');
            if (currentEventName.includes('Lunch')) dutyKeywords.push('Lunch');
            if (currentEventName.includes('Dinner')) dutyKeywords.push('Dinner');
            if (currentEventName.includes('Testimony')) dutyKeywords.push('Testimony');
            if (currentEventName.includes('Devotional')) dutyKeywords.push('Devotional');
            if (currentEventName.includes('Service')) dutyKeywords.push('Service');
            if (currentEventName.includes('Activity')) dutyKeywords.push('Activity');
            if (currentEventName.includes('Orientation')) dutyKeywords.push('Orientation');
            if (currentEventName.includes('Flex Time')) dutyKeywords.push('Flex Time', 'Participant Flex Time');
            if (currentEventName.includes('Musical Program')) dutyKeywords.push('Musical Program');
            if (currentEventName.includes('Variety Show')) dutyKeywords.push('Variety Show');
            if (currentEventName.includes('YM/YW Activity') || currentEventName.includes('YM//YW Activity') || currentEventName.includes('YM Activity') || currentEventName.includes('YW Activity')) dutyKeywords.push('Young Men Morning Devotional and Young Women Activity', 'Young Women Morning Devotional and Young Men Activity');

            filterAndAddEvents(dutyKeywords, 'agenda', (event, currentStartMins, currentEndMins) => {
                if (currentEventName.includes('Class') && event.eventName.includes('Class')) {
                    return timeProximityCheck(event, currentStartMins, currentEndMins);
                }
                return true;
            });
        }

        // Specific event linking (within same event type and weekday) - BIDIRECTIONAL
        const specificLinkPatterns = [
            { name: 'Check-in', subpatterns: ['Coordinator', 'Setup', 'Set Up', 'Check-in 1', 'Check-in 2', 'Check-In 1', 'Check-In 2', 'Check In 1', 'Check In 2', 'Participant Check-in 1', 'Participant Check-in 2'] },
            { name: 'Dance', subpatterns: ['Coordinator', 'DJ', 'Accommodations', 'Support'] },
            { name: 'Games Night', subpatterns: ['Coordinator', 'Accommodations', 'Support'] },
            { name: 'Pizza Night', subpatterns: ['Coordinator', 'Support'] },
            { name: 'Class', subpatterns: ['Coordinator', 'Support', 'Meeting'], checkFn: timeProximityCheck }
        ];

        specificLinkPatterns.forEach(pattern => {
            if (currentEventName.includes(pattern.name)) {
                // Find ALL events that contain the pattern name (bidirectional linking)
                filterAndAddEvents([pattern.name], currentEventType.toLowerCase(), (event, currentStartMins, currentEndMins) => {
                    if (!event.eventName.includes(pattern.name)) return false;
                    
                    // Link if either event contains any of the subpatterns (bidirectional)
                    const eventContainsSubpattern = pattern.subpatterns.some(sub => event.eventName.includes(sub));
                    const currentContainsSubpattern = pattern.subpatterns.some(sub => currentEventName.includes(sub));
                    
                    // Either event must contain a subpattern to be related (OR logic for bidirectional)
                    if (!eventContainsSubpattern && !currentContainsSubpattern) return false;
                    
                    if (pattern.checkFn) return pattern.checkFn(event, currentStartMins, currentEndMins);
                    return true;
                });
            }
        });

        // General Coordinator/Support patterns - BIDIRECTIONAL
        const generalPatterns = [{ coordinator: 'Coordinator', support: 'Support' }, { coordinator: 'Lead', support: 'Support' }, { coordinator: 'Lead', support: 'Assist' }];
        for (const pattern of generalPatterns) {
            const isCoordinator = currentEventName.includes(pattern.coordinator);
            const isSupport = currentEventName.includes(pattern.support);
            if (isCoordinator || isSupport) {
                const isSpecificPatternHandled = specificLinkPatterns.some(p => currentEventName.includes(p.name));
                if (isSpecificPatternHandled) continue;

                const baseEventName = currentEventName.replace(pattern.coordinator, '').replace(pattern.support, '').trim();
                
                // Bidirectional: find both coordinator and support events for this base activity
                filterAndAddEvents([pattern.coordinator, pattern.support], currentEventType.toLowerCase(), (event) => {
                    const eventBaseName = event.eventName.replace(pattern.coordinator, '').replace(pattern.support, '').trim();
                    return eventBaseName === baseEventName && (event.eventName.includes(pattern.coordinator) || event.eventName.includes(pattern.support));
                });
            }
        }

        const uniqueLinkedEvents = linkedEvents.filter((event, index, self) =>
            index === self.findIndex(e => 
                e.eventName === event.eventName && 
                e.weekday === event.weekday &&
                e.startTime === event.startTime &&
                e.endTime === event.endTime &&
                JSON.stringify(e.assignedRoles.sort()) === JSON.stringify(event.assignedRoles.sort())
            )
        );

        return uniqueLinkedEvents;
    }, [mergedEvents, timeToMinutes]);

    
    return { mergedEvents, processedData, findLinkedEvents, timeToMinutes, minutesToTime };
};

export default useCalendarData;