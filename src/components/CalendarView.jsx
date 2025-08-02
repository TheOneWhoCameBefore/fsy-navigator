import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

import Header from './Header';
import Modals from './Modals';
import useCalendarData from '../hooks/useCalendarData';

const CalendarHeader = memo(({ roles, activeFilterRoles, createMobileAbbreviation }) => (
    <thead>
        <tr>
            <th className="time-col sticky left-0 top-0 bg-gray-200 p-1 font-bold border-b-2 border-gray-300 border-r border-gray-400 z-50 text-xs text-center" style={{width: '70px'}}>Time</th>
            {roles.map(r => {
                const roleClass = r.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const mobileAbbr = createMobileAbbreviation(r);
                const isRoleVisible = r === 'Agenda' || activeFilterRoles[roleClass] !== false;
                return (
                    <th key={r} className={`role-col sticky top-0 bg-gray-200 p-1 md:p-2 font-bold border-b-2 border-gray-300 border-r border-gray-300 shadow-sm z-30 text-xs ${isRoleVisible ? '' : 'hidden'}`} 
                        data-role={roleClass}>
                        <span className="full-text block md:hidden">{mobileAbbr}</span>
                        <span className="mobile-abbr hidden md:block">{r}</span>
                    </th>
                );
            })}
        </tr>
    </thead>
));

const EventCell = memo(({ event, role, roleClass, isRoleVisible, activeFilterRoles, roles, showRoleModal, eventsMap, getActivityColor }) => {
    const rowspan = Math.max(1, Math.floor(event.duration / 5));
    const eventKey = `${event.weekday}-${event.startTime}-${event.endTime}-${event.eventName}-${event.eventType}`;
    const colors = getActivityColor(event);
    const visibleRoleCount = roles.filter(r => activeFilterRoles[r.replace(/[^a-z0-9]/gi, '-').toLowerCase()] !== false && r !== 'Agenda').length;
    
    return (
        <td
            key={role}
            className={`role-col h-10 p-0 text-center align-top break-words border-r border-gray-300 ${isRoleVisible ? '' : 'hidden'}`}
            data-role={roleClass}
            rowSpan={rowspan}
        >
            <div
                className={`relative w-full h-full rounded-md text-left flex items-start box-border p-1 md:p-2 text-sm cursor-pointer transition-all duration-200 hover:translate-y-[-1px] hover:shadow-md z-0 hover:z-10 ${colors.backgroundColor} ${colors.borderColor} border-l-4`}
                onClick={() => showRoleModal({
                    eventKey,
                    activity: `${event.eventAbbreviation} - ${event.eventName}`,
                    description: event.eventDescription,
                    eventTime: `${event.startTime} - ${event.endTime}`,
                    eventName: event.eventName,
                    eventType: event.eventType,
                    mergedEvent: eventsMap.get(eventKey)
                })}
            >
                <div className="sticky top-8 overflow-hidden text-ellipsis">
                    <span className={`event-full ${visibleRoleCount <= 4 ? 'block' : 'hidden'} md:block`}><strong>{event.eventAbbreviation}</strong> - {event.eventName}</span>
                    <span className={`event-abbr-only ${visibleRoleCount > 4 ? 'block' : 'hidden'} md:hidden text-xs`}><strong>{event.eventAbbreviation}</strong></span>
                </div>
            </div>
        </td>
    );
});

const EmptyCell = memo(({ role, roleClass, isRoleVisible }) => (
    <td key={role} className={`role-col h-10 p-0 text-center align-top break-words border-r border-gray-300 ${isRoleVisible ? '' : 'hidden'}`} data-role={roleClass}></td>
));

const TableView = memo(({ day, processedData, roles, activeFilterRoles, showRoleModal, eventsMap, minutesToTime, createMobileAbbreviation, getActivityColor }) => {
    const eventGridData = useMemo(() => {
        const dayEvents = processedData[day];
        if (!dayEvents || dayEvents.length === 0) {
            return null;
        }

        const allTimes = dayEvents.flatMap(e => [e.startMins, e.endMins]).filter(t => t !== null);
        if (allTimes.length === 0) return null;

        const minTime = Math.min(...allTimes);
        const maxTime = Math.max(...allTimes);
        const eventGrid = {};
        roles.forEach(role => { eventGrid[role] = {}; });

        dayEvents.forEach(event => {
            event.assignedRoles.forEach(role => {
                if (!eventGrid[role] || event.endMins <= event.startMins) return;
                eventGrid[role][event.startMins] = {
                    ...event,
                    isStart: true,
                    duration: event.endMins - event.startMins,
                    Role: role
                };
                for (let t = event.startMins + 5; t < event.endMins; t += 5) {
                    eventGrid[role][t] = { isSpanned: true };
                }
            });
        });

        return { eventGrid, minTime, maxTime };
    }, [day, processedData, roles]);

    const tableRows = useMemo(() => {
        if (!eventGridData) return [];

        const { eventGrid, minTime, maxTime } = eventGridData;
        const rows = [];

        for (let t = minTime; t < maxTime; t += 5) {
            const rowCells = [];
            rowCells.push(<td key="time" className="time-col sticky left-0 bg-gray-100 p-1 font-bold w-[70px] text-xs text-center h-10 border-r border-gray-400">{minutesToTime(t)}</td>);
            
            roles.forEach(role => {
                const eventAtTime = eventGrid[role]?.[t];
                const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const isRoleVisible = role === 'Agenda' || activeFilterRoles[roleClass] !== false;

                if (eventAtTime?.isStart) {
                    rowCells.push(
                        <EventCell 
                            key={role}
                            event={eventAtTime}
                            role={role}
                            roleClass={roleClass}
                            isRoleVisible={isRoleVisible}
                            activeFilterRoles={activeFilterRoles}
                            roles={roles}
                            showRoleModal={showRoleModal}
                            eventsMap={eventsMap}
                            getActivityColor={getActivityColor}
                        />
                    );
                } else if (!eventAtTime?.isSpanned) {
                    rowCells.push(<EmptyCell key={role} role={role} roleClass={roleClass} isRoleVisible={isRoleVisible} />);
                }
            });
            rows.push(<tr key={t} data-time-minutes={t}>{rowCells}</tr>);
        }
        return rows;
    }, [eventGridData, roles, activeFilterRoles, showRoleModal, eventsMap, minutesToTime, getActivityColor]);

    if (!eventGridData) {
        return <div className="flex items-center justify-center h-full"><p className="text-gray-600 italic">No events for {day}.</p></div>;
    }

    const manyColumnsClass = roles.filter(role => role === 'Agenda' || (activeFilterRoles[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] !== false && role !== 'Agenda')).length > 7 ? 'many-columns' : '';

    return (
        <div className="overflow-y-auto overflow-x-hidden h-full">
            <table className={`w-full border-collapse table-fixed ${manyColumnsClass}`}>
                <CalendarHeader 
                    roles={roles} 
                    activeFilterRoles={activeFilterRoles} 
                    createMobileAbbreviation={createMobileAbbreviation} 
                />
                <tbody>{tableRows}</tbody>
            </table>
        </div>
    );
});

const TravelEventCard = memo(({ agendaEvent, index }) => (
    <div key={index} 
         data-event-time={`${agendaEvent.startMins}-${agendaEvent.endMins}`}
         className="flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg p-2 shadow-sm transition-all duration-200 hover:translate-y-[-1px] hover:shadow-md text-sm">
        <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">{agendaEvent.startTime}</span>
        <span className="text-gray-700 font-medium text-center flex-grow text-sm">{agendaEvent.eventName}</span>
    </div>
));

const RoleAssignment = memo(({ role, activityData, agendaEvent, getActivityColor, formatRoleNameForCard, showRoleModal, processedData, eventsMap }) => {
    const colors = getActivityColor(activityData);
    let displayText, timeIndicator = '';
    let assignmentTime = `${agendaEvent.startTime} - ${agendaEvent.endTime}`;

    if (typeof activityData === 'string') {
        displayText = activityData;
    } else {
        displayText = activityData.activity;
        assignmentTime = `${activityData.startTime} - ${activityData.endTime}`;
        if (!activityData.isOverlapping) {
            if (activityData.startsWithin) {
                timeIndicator = ` (starts ${activityData.startTime})`;
            } else {
                timeIndicator = ` (${activityData.startTime} - ${activityData.endTime})`;
            }
        }
    }

    const eventType = typeof activityData === 'object' ? activityData.eventType : (activityData === 'No Duty' ? 'Free' : 'Duty');
    const roleNameWithAssignments = formatRoleNameForCard(role);
    const activityDescription = typeof activityData === 'object' ?
        processedData[agendaEvent.weekday]?.find(e => e.assignedRoles.includes(role) && e.startMins < agendaEvent.endMins && e.endMins > agendaEvent.startMins)?.eventDescription || '' : '';

    let eventKey = '';
    if (typeof activityData === 'object' && activityData.activity) {
        const eventName = activityData.activity.split(' - ')[1] || activityData.activity;
        eventKey = `${agendaEvent.weekday}-${activityData.startTime}-${activityData.endTime}-${eventName}-${activityData.eventType}`;
    } else {
        eventKey = `${agendaEvent.weekday}-${agendaEvent.startTime}-${agendaEvent.endTime}-${agendaEvent.eventName}-${agendaEvent.eventType}`;
    }

    const completeEvent = typeof activityData === 'object' ? 
        eventsMap.get(`${agendaEvent.weekday}-${activityData.startTime}-${activityData.endTime}-${activityData.activity.split(' - ')[1] || activityData.activity}-${activityData.eventType}`) || agendaEvent
        : agendaEvent;
    
    return (
        <div
            key={role}
            className={`flex-1 p-2 rounded-md border-l-4 cursor-pointer transition-all duration-200 hover:translate-y-[-1px] hover:shadow-md ${colors.backgroundColor} ${colors.borderColor}`}
            onClick={() => showRoleModal({
                eventKey,
                activity: displayText,
                description: activityDescription,
                eventTime: assignmentTime,
                eventName: agendaEvent.eventName,
                eventType: eventType,
                mergedEvent: completeEvent || agendaEvent
            })}
        >
            <div 
                className="font-bold text-gray-800 hover:text-blue-600 transition-colors duration-200" 
                dangerouslySetInnerHTML={{ __html: roleNameWithAssignments }}
            ></div>
            <div className={`text-sm ${colors.textColor}`}>{displayText}{timeIndicator}</div>
        </div>
    );
});

const AgendaEventCard = memo(({ agendaEvent, index, roleActivities, getActivityColor, formatRoleNameForCard, showRoleModal, processedData, eventsMap }) => {
    const roleEntries = Object.entries(roleActivities);

    const acRoles = roleEntries.filter(([role]) => role.startsWith('AC ')).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    const cnRoles = roleEntries.filter(([role]) => role.startsWith('CN ')).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    const otherRoles = roleEntries.filter(([role]) => !role.startsWith('AC ') && !role.startsWith('CN '));

    const acRoleMap = new Map(acRoles.map(([role, activity]) => [parseInt(role.match(/^AC (\d+)$/)[1]), [role, activity]]));
    const cnRoleMap = new Map(cnRoles.map(([role, activity]) => {
        const letterNumber = role.match(/^CN ([A-Z])$/)[1].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
        return [letterNumber, [role, activity]];
    }));

    const allAcNumbers = [...acRoleMap.keys(), ...cnRoleMap.keys()];
    const maxAcNumber = allAcNumbers.length > 0 ? Math.max(...allAcNumbers) : 0;

    let pairedRolesHTML = [];
    for (let acNumber = 1; acNumber <= maxAcNumber; acNumber++) {
        const acRole = acRoleMap.get(acNumber);
        const cnRole = cnRoleMap.get(acNumber);

        if (acRole || cnRole) {
            pairedRolesHTML.push(
                <div key={`pair-${acNumber}`} className="grid grid-cols-2 gap-1.5">
                    {acRole ? <RoleAssignment role={acRole[0]} activityData={acRole[1]} agendaEvent={agendaEvent} getActivityColor={getActivityColor} formatRoleNameForCard={formatRoleNameForCard} showRoleModal={showRoleModal} processedData={processedData} eventsMap={eventsMap} /> : <div className="invisible"></div>}
                    {cnRole ? <RoleAssignment role={cnRole[0]} activityData={cnRole[1]} agendaEvent={agendaEvent} getActivityColor={getActivityColor} formatRoleNameForCard={formatRoleNameForCard} showRoleModal={showRoleModal} processedData={processedData} eventsMap={eventsMap} /> : <div className="invisible"></div>}
                </div>
            );
            if (acNumber % 2 === 0 && acNumber < maxAcNumber) {
                pairedRolesHTML.push(<div key={`divider-${acNumber}`} className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent my-0.5 relative before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-1 before:h-1 before:bg-gray-300 before:rounded-full"></div>);
            } else if (acNumber % 2 !== 0 && acNumber < maxAcNumber) {
                const nextAcNum = acNumber + 1;
                if (!acRoleMap.has(nextAcNum) && !cnRoleMap.has(nextAcNum)) {
                    pairedRolesHTML.push(<div key={`divider-${acNumber}-single`} className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent my-0.5 relative before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-1 before:h-1 before:bg-gray-300 before:rounded-full"></div>);
                }
            }
        }
    }

    let otherRolesHTML = [];
    for (let i = 0; i < otherRoles.length; i += 2) {
        otherRolesHTML.push(
            <div key={`other-pair-${i}`} className="grid grid-cols-2 gap-1.5">
                <RoleAssignment role={otherRoles[i][0]} activityData={otherRoles[i][1]} agendaEvent={agendaEvent} getActivityColor={getActivityColor} formatRoleNameForCard={formatRoleNameForCard} showRoleModal={showRoleModal} processedData={processedData} eventsMap={eventsMap} />
                {otherRoles[i + 1] && <RoleAssignment role={otherRoles[i + 1][0]} activityData={otherRoles[i + 1][1]} agendaEvent={agendaEvent} getActivityColor={getActivityColor} formatRoleNameForCard={formatRoleNameForCard} showRoleModal={showRoleModal} processedData={processedData} eventsMap={eventsMap} />}
            </div>
        );
    }

    return (
        <div key={index} 
             data-event-time={`${agendaEvent.startMins}-${agendaEvent.endMins}`}
             className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-md">
            <div className="flex justify-between items-start mb-3 gap-3 flex-col md:flex-row">
                <h3 className="text-lg font-bold text-gray-800 m-0">{agendaEvent.eventName}</h3>
                <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap font-medium">{agendaEvent.startTime} - {agendaEvent.endTime}</div>
            </div>
            <div className="text-gray-700 mb-3 leading-relaxed text-sm">{agendaEvent.eventDescription}</div>
            <div className="flex flex-col gap-1.5">
                {pairedRolesHTML}
                {otherRolesHTML}
            </div>
        </div>
    );
});

const CardView = memo(({ day, processedData, getRoleActivitiesForAgendaEvent, getActivityColor, formatRoleNameForCard, showRoleModal, eventsMap, selectedRole, minutesToTime }) => {
    const agendaCards = useMemo(() => {
        const dayEvents = processedData[day];
        if (!dayEvents?.length) {
            return [];
        }

        const allAgendaEvents = dayEvents
            .filter(event => event.eventType?.toLowerCase() === 'agenda')
            .sort((a, b) => a.startMins - b.startMins);

        if (!allAgendaEvents.length) {
            return [];
        }

        return allAgendaEvents.map((agendaEvent, index) => {
            const lowerEventName = agendaEvent.eventName.toLowerCase();
            const isTravelEvent = lowerEventName.includes('travel') || lowerEventName.includes('transition') || lowerEventName.includes('move to') || lowerEventName.includes('roll call');

            if (isTravelEvent) {
                return <TravelEventCard key={index} agendaEvent={agendaEvent} index={index} />;
            } else {
                const roleActivities = getRoleActivitiesForAgendaEvent(agendaEvent);
                return (
                    <AgendaEventCard 
                        key={index}
                        agendaEvent={agendaEvent}
                        index={index}
                        roleActivities={roleActivities}
                        getActivityColor={getActivityColor}
                        formatRoleNameForCard={formatRoleNameForCard}
                        showRoleModal={showRoleModal}
                        processedData={processedData}
                        eventsMap={eventsMap}
                    />
                );
            }
        });
    }, [day, processedData, getRoleActivitiesForAgendaEvent, getActivityColor, formatRoleNameForCard, showRoleModal, eventsMap]);

    const agendaEvents = useMemo(() => {
        const dayEvents = processedData[day];
        if (!dayEvents?.length) return [];
        
        return dayEvents
            .filter(event => event.eventType?.toLowerCase() === 'agenda')
            .sort((a, b) => a.startMins - b.startMins);
    }, [day, processedData]);

    if (!processedData[day]?.length) {
        return <div className="p-4 text-center text-gray-600">No events for {day}.</div>;
    }

    if (agendaCards.length === 0) {
        return <div className="p-4 text-center text-gray-600">No agenda events for {day}.</div>;
    }

    return (
        <div className="flex h-full w-full relative pt-2">
            {/* Single container with cards and inline timelines */}
            <div className="flex-1 h-full overflow-y-auto">
                <div className="p-1 flex flex-col gap-2">
                    {agendaEvents.map((agendaEvent, index) => {
                        const lowerEventName = agendaEvent.eventName.toLowerCase();
                        const isTravelEvent = lowerEventName.includes('travel') || lowerEventName.includes('transition') || lowerEventName.includes('move to') || lowerEventName.includes('roll call');

                        let timelineContent = null;
                        if (selectedRole) {
                            if (isTravelEvent) {
                                const dayEvents = processedData[day] || [];
                                const overlappingEvents = dayEvents.filter(event => 
                                    event.eventType && event.eventType.toLowerCase() !== 'agenda' &&
                                    event.assignedRoles && 
                                    event.assignedRoles.includes(selectedRole) &&
                                    event.startMins < agendaEvent.endMins && 
                                    event.endMins > agendaEvent.startMins
                                );

                                let bgColor = '#d1d5db';
                                let title = `${agendaEvent.eventName}: Travel/No Duty`;
                                let borderColor = 'border-gray-400';

                                if (overlappingEvents.length > 0) {
                                    const activeEvent = overlappingEvents[0];
                                    const segmentActivity = {
                                        activity: `${activeEvent.eventAbbreviation} - ${activeEvent.eventName}`,
                                        eventType: activeEvent.eventType,
                                        startTime: activeEvent.startTime,
                                        endTime: activeEvent.endTime
                                    };
                                    const segmentColor = getActivityColor(segmentActivity);
                                    
                                    const colorMap = {
                                        'bg-yellow-100': '#fbbf24',
                                        'bg-cyan-100': '#22d3ee', 
                                        'bg-green-100': '#4ade80',
                                        'bg-green-50': '#86efac',
                                        'bg-blue-100': '#60a5fa',
                                        'bg-gray-50': '#d1d5db'
                                    };
                                    
                                    const borderColorMap = {
                                        'bg-yellow-100': 'border-yellow-600',
                                        'bg-cyan-100': 'border-cyan-600', 
                                        'bg-green-100': 'border-green-600',
                                        'bg-green-50': 'border-green-400',
                                        'bg-blue-100': 'border-blue-600',
                                        'bg-gray-50': 'border-gray-400'
                                    };
                                    
                                    bgColor = colorMap[segmentColor.backgroundColor] || '#d1d5db';
                                    borderColor = borderColorMap[segmentColor.backgroundColor] || 'border-gray-400';
                                    title = `${agendaEvent.eventName}: ${segmentActivity.activity}`;
                                }

                                timelineContent = (
                                    <div 
                                        className={`w-4 flex-shrink-0 border-l-2 ${borderColor} relative cursor-pointer`}
                                        style={{ 
                                            height: '100%', 
                                            minHeight: '100%',
                                            backgroundColor: bgColor
                                        }}
                                        title={title}
                                        onClick={() => showRoleModal({
                                            eventKey: `${agendaEvent.weekday}-${agendaEvent.startTime}-${agendaEvent.endTime}-${agendaEvent.eventName}-${agendaEvent.eventType}`,
                                            activity: agendaEvent.eventName,
                                            description: agendaEvent.eventDescription || '',
                                            eventTime: `${agendaEvent.startTime} - ${agendaEvent.endTime}`,
                                            eventName: agendaEvent.eventName,
                                            eventType: 'Travel',
                                            mergedEvent: {
                                                ...agendaEvent,
                                                eventName: agendaEvent.eventName || 'Travel Event',
                                                weekday: agendaEvent.weekday,
                                                assignedRoles: agendaEvent.assignedRoles || ['Agenda']
                                            }
                                        })}
                                    />
                                );
                            } else {
                                const dayEvents = processedData[day] || [];
                                const overlappingEvents = dayEvents.filter(event => 
                                    event.eventType && event.eventType.toLowerCase() !== 'agenda' &&
                                    event.assignedRoles && 
                                    event.assignedRoles.includes(selectedRole) &&
                                    event.startMins < agendaEvent.endMins && 
                                    event.endMins > agendaEvent.startMins
                                );

                                const agendaStart = agendaEvent.startMins;
                                const agendaEnd = agendaEvent.endMins;
                                const timelineSegments = [];
                                let currentTime = agendaStart;
                                
                                const sortedEvents = overlappingEvents.sort((a, b) => a.startMins - b.startMins);
                                
                                while (currentTime < agendaEnd) {
                                    const activeEvent = sortedEvents.find(event => 
                                        event.startMins <= currentTime && event.endMins > currentTime
                                    );
                                    
                                    let segmentEnd;
                                    let segmentActivity = 'No Duty';
                                    let segmentColor = { backgroundColor: 'bg-gray-50' };
                                    
                                    if (activeEvent) {
                                        segmentEnd = Math.min(activeEvent.endMins, agendaEnd);
                                        segmentActivity = {
                                            activity: `${activeEvent.eventAbbreviation} - ${activeEvent.eventName}`,
                                            eventType: activeEvent.eventType,
                                            startTime: activeEvent.startTime,
                                            endTime: activeEvent.endTime
                                        };
                                        segmentColor = getActivityColor(segmentActivity);
                                    } else {
                                        const nextEvent = sortedEvents.find(event => event.startMins > currentTime);
                                        segmentEnd = nextEvent ? Math.min(nextEvent.startMins, agendaEnd) : agendaEnd;
                                        
                                        const hasAnyDuties = overlappingEvents.length > 0;
                                        if (hasAnyDuties) {
                                            segmentActivity = 'Free';
                                            segmentColor = { backgroundColor: 'bg-green-50' };
                                        } else {
                                            segmentActivity = 'No Duty';
                                            segmentColor = { backgroundColor: 'bg-gray-50' };
                                        }
                                    }
                                    
                                    let bgColor = '#d1d5db'; // default gray
                                    let borderColor = 'border-gray-400'; // default border color
                                    
                                    if (segmentColor.backgroundColor) {
                                        const colorMap = {
                                            'bg-yellow-100': '#fbbf24',
                                            'bg-cyan-100': '#22d3ee', 
                                            'bg-green-100': '#4ade80',
                                            'bg-green-50': '#86efac',
                                            'bg-blue-100': '#60a5fa',
                                            'bg-gray-50': '#d1d5db'
                                        };
                                        
                                        const borderColorMap = {
                                            'bg-yellow-100': 'border-yellow-600',
                                            'bg-cyan-100': 'border-cyan-600', 
                                            'bg-green-100': 'border-green-600',
                                            'bg-green-50': 'border-green-400',
                                            'bg-blue-100': 'border-blue-600',
                                            'bg-gray-50': 'border-gray-400'
                                        };
                                        
                                        bgColor = colorMap[segmentColor.backgroundColor] || '#d1d5db';
                                        borderColor = borderColorMap[segmentColor.backgroundColor] || 'border-gray-400';
                                    }
                                    
                                    const segmentDuration = segmentEnd - currentTime;
                                    const agendaDuration = agendaEnd - agendaStart;
                                    const flexGrow = segmentDuration / agendaDuration;
                                    
                                    timelineSegments.push({
                                        startTime: currentTime,
                                        endTime: segmentEnd,
                                        flexGrow,
                                        bgColor,
                                        borderColor,
                                        activity: segmentActivity,
                                        title: `${agendaEvent.eventName} (${minutesToTime(currentTime)}-${minutesToTime(segmentEnd)}): ${typeof segmentActivity === 'object' ? segmentActivity.activity : segmentActivity}`
                                    });
                                    
                                    currentTime = segmentEnd;
                                }

                                timelineContent = (
                                    <div 
                                        className="w-4 flex-shrink-0 flex flex-col"
                                        style={{ height: '100%', minHeight: '100%' }}
                                    >
                                        {timelineSegments.map((segment) => (
                                            <div
                                                key={`segment-${segment.startTime}-${segment.endTime}`}
                                                className={`cursor-pointer border-l-2 ${segment.borderColor}`}
                                                style={{
                                                    flex: `${segment.flexGrow} 1 0%`,
                                                    backgroundColor: segment.bgColor,
                                                    minHeight: '2px',
                                                    position: 'relative'
                                                }}
                                                title={segment.title}
                                                onClick={() => {
                                                    if (typeof segment.activity === 'object') {
                                                        const eventName = segment.activity.activity.split(' - ')[1] || segment.activity.activity;
                                                        const eventKey = `${agendaEvent.weekday}-${segment.activity.startTime}-${segment.activity.endTime}-${eventName}-${segment.activity.eventType}`;
                                                        
                                                        const completeEvent = eventsMap.get(eventKey);
                                                        const fullEvent = completeEvent || {
                                                            ...segment.activity,
                                                            eventName: eventName,
                                                            weekday: agendaEvent.weekday,
                                                            assignedRoles: [selectedRole]
                                                        };
                                                        
                                                        showRoleModal({
                                                            eventKey,
                                                            activity: segment.activity.activity,
                                                            description: completeEvent?.eventDescription || '', 
                                                            eventTime: `${segment.activity.startTime} - ${segment.activity.endTime}`,
                                                            eventName: eventName,
                                                            eventType: segment.activity.eventType,
                                                            mergedEvent: fullEvent
                                                        });
                                                    } else {
                                                        const fullEvent = {
                                                            ...agendaEvent,
                                                            eventName: agendaEvent.eventName || 'Agenda Event',
                                                            weekday: agendaEvent.weekday,
                                                            assignedRoles: agendaEvent.assignedRoles || ['Agenda']
                                                        };
                                                        showRoleModal({
                                                            eventKey: `${agendaEvent.weekday}-${agendaEvent.startTime}-${agendaEvent.endTime}-${agendaEvent.eventName}-${agendaEvent.eventType}`,
                                                            activity: `${agendaEvent.eventName} (${segment.activity})`,
                                                            description: agendaEvent.eventDescription || '',
                                                            eventTime: `${agendaEvent.startTime} - ${agendaEvent.endTime}`,
                                                            eventName: agendaEvent.eventName,
                                                            eventType: agendaEvent.eventType,
                                                            mergedEvent: fullEvent
                                                        });
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                );
                            }
                        }

                        const cardContent = isTravelEvent ? (
                            <TravelEventCard agendaEvent={agendaEvent} index={index} />
                        ) : (
                            <AgendaEventCard 
                                agendaEvent={agendaEvent}
                                index={index}
                                roleActivities={getRoleActivitiesForAgendaEvent(agendaEvent)}
                                getActivityColor={getActivityColor}
                                formatRoleNameForCard={formatRoleNameForCard}
                                showRoleModal={showRoleModal}
                                processedData={processedData}
                                eventsMap={eventsMap}
                            />
                        );

                        return (
                            <div key={`card-timeline-${agendaEvent.startMins}-${agendaEvent.endMins}`} 
                                 data-event-time={`${agendaEvent.startMins}-${agendaEvent.endMins}`}
                                 className="flex gap-1 relative">
                                <div className={`flex-1 ${timelineContent ? 'mr-5' : ''}`}>
                                    {cardContent}
                                </div>
                                {timelineContent && (
                                    <div 
                                        className="absolute right-0 top-0 bottom-0"
                                        style={{
                                            top: index === 0 ? '0' : '-4px',
                                            bottom: index === agendaEvents.length - 1 ? '0' : '-4px',
                                            width: '16px',
                                            zIndex: 1
                                        }}
                                    >
                                        {timelineContent}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

const CONFIG = {
    DAYS_ORDER: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    LOCAL_STORAGE_KEY: 'duties-calendar-preferences',
};

const loadSavedPreferences = () => {
    const saved = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            const { filters, isCardView, selectedName } = JSON.parse(saved);
            return { 
                viewMode: isCardView ? 'card' : 'table', 
                savedFilters: filters,
                savedSelectedName: selectedName || null
            };
        } catch (e) { console.warn('Failed to parse saved preferences:', e); }
    }
    return { viewMode: 'card', savedFilters: null, savedSelectedName: null };
};

const savePreferences = (filters, viewMode, selectedNameData = null) => {
    const preferences = {
        filters: Object.entries(filters).map(([value, checked]) => ({ value, checked })),
        isCardView: viewMode === 'card',
        selectedName: selectedNameData ? {
            role: selectedNameData.role,
            fullName: selectedNameData.fullName,
            displayText: `${selectedNameData.role} - ${selectedNameData.fullName}`
        } : null
    };
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(preferences));
};

const CalendarView = ({ schedules, roles, roleAssignments, roleFullNames, allNames }) => {
    const { viewMode: initialViewMode, savedFilters, savedSelectedName } = useMemo(() => {
        const prefs = loadSavedPreferences();
        return prefs;
    }, []);

    const [viewMode, setViewMode] = useState(initialViewMode);
    const [nameSearchInput, setNameSearchInput] = useState(savedSelectedName?.displayText || '');
    const [selectedSearchNameData, setSelectedSearchNameData] = useState(savedSelectedName);
    
    const [activeFilterRoles, setActiveFilterRoles] = useState(() => {
        return {};
    });

    const [tempFilterRoles, setTempFilterRoles] = useState({});
    const [selectedEvent, setSelectedEvent] = useState(null);

    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isDutiesSummaryModalOpen, setIsDutiesSummaryModalOpen] = useState(false);

    const swiperRef = useRef(null);
    const hasInitiallyNavigatedRef = useRef(false);
    const currentViewModeRef = useRef(viewMode);
    
    useEffect(() => {
        currentViewModeRef.current = viewMode;
    }, [viewMode]);
    
    const { processedData, mergedEvents, findLinkedEvents, timeToMinutes, minutesToTime } = useCalendarData(schedules);
    
    const eventsMap = useMemo(() => {
        if (!mergedEvents) return new Map();
        
        const map = new Map();
        mergedEvents.forEach(event => {
            const key = `${event.weekday}-${event.startTime}-${event.endTime}-${event.eventName}-${event.eventType}`;
            map.set(key, event);
        });
        return map;
    }, [mergedEvents]);

    const updateCurrentTimeIndicatorFn = () => {
        const now = new Date();
        const today = now.toLocaleDateString('en-US', { weekday: 'long' });
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        document.querySelectorAll('.current-time-indicator').forEach(el => el.remove());

        const activeSlide = document.querySelector('.swiper-slide-active');
        if (activeSlide && activeSlide.dataset.day === today && viewMode === 'table') {
            const targetMinutes = Math.floor(currentMinutes / 5) * 5;
            const timeRow = activeSlide.querySelector(`tr[data-time-minutes="${targetMinutes}"]`);
            if (timeRow) {
                const indicator = document.createElement('div');
                indicator.className = 'current-time-indicator absolute left-0 right-0 h-0.5 bg-red-500 z-10 shadow-md pointer-events-none';
                
                const minutesWithinSlot = currentMinutes % 5;
                const slotProgress = minutesWithinSlot / 5;
                indicator.style.top = `${slotProgress * timeRow.offsetHeight}px`;

                const timeCell = timeRow.querySelector('.time-col');
                if (timeCell) {
                    timeCell.style.position = 'relative';
                    timeCell.appendChild(indicator);
                }
            }
        }
    };
    
    const updateCurrentTimeIndicator = useCallback(updateCurrentTimeIndicatorFn, [viewMode]);
    
    const performNavigation = useCallback((targetViewMode = null) => {
        const attemptScroll = () => {
            const activeSlide = document.querySelector('.swiper-slide-active');
            if (!activeSlide) {
                setTimeout(attemptScroll, 100);
                return;
            }

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            const currentViewMode = targetViewMode || currentViewModeRef.current || 
                (activeSlide.querySelector('.h-full.hidden') ? 
                    (activeSlide.querySelector('.h-full.hidden').classList.contains('flex') ? 'table' : 'card') :
                    (activeSlide.querySelector('.h-full.block') ? 'table' : 'card'));

            setTimeout(() => {
                let container;
                if (currentViewMode === 'card') {
                    const cardViewDiv = activeSlide.querySelector('.h-full.flex:not(.hidden)');
                    
                    if (cardViewDiv) {
                        container = cardViewDiv.querySelector('.overflow-y-auto');
                    }
                    
                    if (!container) {
                        const allOverflowContainers = activeSlide.querySelectorAll('.overflow-y-auto');
                        
                        for (const overflowContainer of allOverflowContainers) {
                            if (!overflowContainer.querySelector('table') && !overflowContainer.closest('table')) {
                                container = overflowContainer;
                                break;
                            }
                        }
                    }
                } else {
                    const tableViewDiv = activeSlide.querySelector('.h-full.block:not(.hidden)');
                    container = tableViewDiv?.querySelector('.overflow-y-auto');
                }
                
                if (!container) {
                    return;
                }

                if (currentViewMode === 'table') {
                    const targetMinutes = Math.floor(currentMinutes / 5) * 5;
                    let timeRow = container.querySelector(`tr[data-time-minutes="${targetMinutes}"]`);
                    
                    if (!timeRow) {
                        for (let offset = 5; offset <= 60; offset += 5) {
                            timeRow = container.querySelector(`tr[data-time-minutes="${targetMinutes - offset}"]`);
                            if (timeRow) {
                                break;
                            }
                        }
                    }
                    
                    if (timeRow) {
                        const containerRect = container.getBoundingClientRect();
                        const rowRect = timeRow.getBoundingClientRect();
                        const scrollTop = container.scrollTop + rowRect.top - containerRect.top - containerRect.height / 3;
                        container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
                        updateCurrentTimeIndicator();
                    }
                } else {
                    const dayEvents = processedData[activeSlide.dataset.day] || [];
                    
                    const currentEvent = dayEvents.find(e => {
                        if (e.eventType?.toLowerCase() !== 'agenda') return false;
                        return currentMinutes >= e.startMins && currentMinutes < e.endMins;
                    });
                    
                    if (currentEvent) {
                        const targetCard = container.querySelector(`[data-event-time="${currentEvent.startMins}-${currentEvent.endMins}"]`);
                        
                        if (targetCard) {
                            container.style.scrollBehavior = 'smooth';
                            
                            const containerRect = container.getBoundingClientRect();
                            const targetRect = targetCard.getBoundingClientRect();
                            const containerScrollTop = container.scrollTop;
                            
                            const topOffset = 10;
                            const targetPosition = containerScrollTop + targetRect.top - containerRect.top - topOffset;
                            const finalScrollTop = Math.max(0, targetPosition);
                            
                            container.scrollTop = finalScrollTop;
                        } else {
                            const firstCard = container.querySelector('[data-event-time]');
                            if (firstCard) {
                                firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    } else {
                        const upcomingEvent = dayEvents
                            .filter(e => e.eventType?.toLowerCase() === 'agenda' && e.startMins > currentMinutes)
                            .sort((a, b) => a.startMins - b.startMins)[0];
                        
                        if (upcomingEvent) {
                            const targetCard = container.querySelector(`[data-event-time="${upcomingEvent.startMins}-${upcomingEvent.endMins}"]`);
                            if (targetCard) {
                                container.style.scrollBehavior = 'smooth';
                                
                                const containerRect = container.getBoundingClientRect();
                                const targetRect = targetCard.getBoundingClientRect();
                                const containerScrollTop = container.scrollTop;
                                
                                const topOffset = 10;
                                const targetPosition = containerScrollTop + targetRect.top - containerRect.top - topOffset;
                                const finalScrollTop = Math.max(0, targetPosition);
                                
                                container.scrollTop = finalScrollTop;
                            }
                        } else {
                            const firstCard = container.querySelector('[data-event-time]');
                            if (firstCard) {
                                container.style.scrollBehavior = 'smooth';
                                
                                const containerRect = container.getBoundingClientRect();
                                const targetRect = firstCard.getBoundingClientRect();
                                const containerScrollTop = container.scrollTop;
                                
                                const topOffset = 10;
                                const targetPosition = containerScrollTop + targetRect.top - containerRect.top - topOffset;
                                const finalScrollTop = Math.max(0, targetPosition);
                                
                                container.scrollTop = finalScrollTop;
                            }
                        }
                    }
                }
            }, 200);
        };

        attemptScroll();
    }, [processedData, updateCurrentTimeIndicator]);

    const manualNavigateToCurrentTime = useCallback(() => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const currentSlideDay = document.querySelector('.swiper-slide-active')?.dataset.day;
        
        if (currentSlideDay !== today && swiperRef.current) {
            const todayIndex = CONFIG.DAYS_ORDER.indexOf(today);
            if (todayIndex !== -1) {
                swiperRef.current.slideTo(todayIndex);
                setTimeout(() => {
                    performNavigation();
                }, 300);
                return;
            }
        }
        
        performNavigation();
    }, [performNavigation]);
    const dutiesData = useMemo(() => {
        const dutiesData10 = {
            'AC 1': ['Music Program', 'Dance Prep (T)', 'Dance DJ (T)', 'Games Night', 'Dance Lead (F)', 'Wednesday Exercise Coordinator'],
            'AC 2': ['Music Program', 'Dance Prep (T)', 'Dance Lead (T)', 'Games Night Accom', 'TIHS Assist', 'Wednesday Exercise Coordinator', 'Bus Bye Bye', 'Friday Exercise Coordinator'],
            'AC 3': ['Music Program', 'Games Night', 'Pizza Night', 'Site Office', 'Communications Coordinator', 'Wednesday Exercise Coordinator'],
            'AC 4': ['Singers', 'Devo Assist (T)', 'Games Night Lead', 'Hall Monitor', 'Testimony Rooms', 'Dance Accom (F)', 'Bus Bye Bye'],
            'AC 5': ['Check-in Lead', 'Orientation/Hall Monitor', 'Breakfast Lead', 'Variety Show', 'Games Night', 'Pizza Night Aid'],
            'AC 6': ['Orientation/Hall Monitor', 'Lunch Lead', 'Variety Show', 'Games Night', 'Lost & Found Coordinator', 'Friday Exercise Coordinator'],
            'AC 7': ['Class Duty/Lead', 'THIS Lead', 'Dance Accom (F)', 'Site Office', 'Thank You-Notes Coordinator', 'Thursday Exercise Coordinator'],
            'AC 8': ['Dinner Lead', 'Games Night', 'Hall Monitor', 'TIHS - Slideshow', 'Social Media Coordinator', 'Thursday Exercise Coordinator', 'Tuesday Exercise Coordinator'],
            'AC 9': ['Bus Welcome', 'Flex-Time Lead', 'Dance Accom (T)', 'Games Night', 'TIHS - Assist', 'Tech Bag Coordinator', 'Tuesday Exercise Coordinator'],
            'AC 10': ['Dance', 'Orientation Prep', 'Orientation Assist', 'Flex-Time Lead', 'Dance Accom (T)', 'Lunch Lead Assist (Th)']
        };
        const dutiesData8 = {
            'AC 1': ['Bus Welcome','Music Program','Dance Accommodations (T)','Games Night Accommodations','Dance Lead (F)','Tech Bag Coordinator','Thursday Exercise Coordinator',],
            'AC 2': ['Musical Program','Dance Lead (T)','Games Night','TIHS - Assist','Dance DJ (F)','Friday Exercise Coordinator',],
            'AC 3': ['Bus Welcome','Music Program','Games Night','Pizza Night','Check-In Dance','Wednesday Exercise Coordinator',],
            'AC 4': ['Singers','Orientation','Flex-Time','Games Night Lead','Bus Bye-Bye','Lost & Found Coordinator','Tuesday Exercise Coordinator',],
            'AC 5': ['Check-In Lead','Orientation','Varitey Show','Dance DJ (T)','Games Night','Thursday Exercise Coordinator',],
            'AC 6': ['Hall Monitor','Variety Show','Games Night','Testimony Rooms','Communications Coordinator','Tuesday Exercise Coordinator',],
            'AC 7': ['Orientation','Class Duty Lead','TIHS - Slideshow','Dance Accommodations (F)','Thank You-Notes Coordinator','Wednesday Exercise Coordinator',],
            'AC 8': ['Orientation','Games Night','TIHS - Lead','Social Media Coordinator','Friday Exercise Coordinator',]
        };
        const acRolesCount = roles.filter(role => role.startsWith('AC ')).length;
        return acRolesCount === 10 ? dutiesData10 : (acRolesCount === 8 ? dutiesData8 : {});
    }, [roles]);

    useEffect(() => {
        if (roles.length > 0 && Object.keys(activeFilterRoles).length === 0) {
            const initialFilters = {};
            const baseRoles = roles.reduce((acc, role) => {
                acc[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
                return acc;
            }, {});

            if (savedFilters) {
                savedFilters.forEach(filter => { initialFilters[filter.value] = filter.checked; });
                Object.keys(baseRoles).forEach(roleKey => {
                    if (!(roleKey in initialFilters)) { initialFilters[roleKey] = true; }
                });
            } else {
                Object.assign(initialFilters, baseRoles);
            }
            
            setActiveFilterRoles(initialFilters);
        }
    }, [roles, savedFilters, activeFilterRoles]);

    useEffect(() => {
    }, [activeFilterRoles]);

    const showRoleModal = useCallback((eventData) => {
        setSelectedEvent(eventData);
        setIsRoleModalOpen(true);
    }, []);

    const handleViewToggle = useCallback(() => {
        const newViewMode = viewMode === 'card' ? 'table' : 'card';
        setViewMode(newViewMode);
        savePreferences(activeFilterRoles, newViewMode, selectedSearchNameData);
    }, [viewMode, activeFilterRoles, selectedSearchNameData]);

    const applyFilters = useCallback(() => {
        setActiveFilterRoles(tempFilterRoles);
        setIsFilterModalOpen(false);
        savePreferences(tempFilterRoles, viewMode, selectedSearchNameData);
    }, [tempFilterRoles, viewMode, selectedSearchNameData]);

    const closeFilterModal = useCallback(() => {
        setActiveFilterRoles(tempFilterRoles);
        setIsFilterModalOpen(false);
        savePreferences(tempFilterRoles, viewMode, selectedSearchNameData);
    }, [tempFilterRoles, viewMode, selectedSearchNameData]);

    const handleFilterModalOpen = useCallback(() => {
        setTempFilterRoles({ ...activeFilterRoles });
        setIsFilterModalOpen(true);
    }, [activeFilterRoles]);

    const selectNameAndFilter = useCallback((nameData) => {
        setNameSearchInput(`${nameData.role} - ${nameData.fullName}`);
        setSelectedSearchNameData(nameData);
        const newFilters = roles.reduce((acc, role) => {
            acc[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = false;
            return acc;
        }, {});
        newFilters[nameData.role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
        newFilters['agenda'] = true;
        setActiveFilterRoles(newFilters);
        savePreferences(newFilters, viewMode, nameData);
    }, [roles, viewMode]);

    const handleFilterChange = useCallback((roleClass, isChecked) => {
        setTempFilterRoles(prev => ({ ...prev, [roleClass]: isChecked }));
    }, []);

    const handleFilterControl = useCallback((action) => {
        const newFilters = { ...tempFilterRoles };
        Object.keys(newFilters).forEach(roleClass => {
            if (roleClass !== 'agenda') {
                newFilters[roleClass] = action === 'select-all';
            }
        });
        setTempFilterRoles(newFilters);
        
        if (action === 'select-none') {
            setNameSearchInput('');
            setSelectedSearchNameData(null);
        }
    }, [tempFilterRoles]);

    const goToDay = useCallback((day) => {
        const dayIndex = CONFIG.DAYS_ORDER.indexOf(day);
        if (dayIndex !== -1 && swiperRef.current) {
            swiperRef.current.slideTo(dayIndex);
        }
    }, []);

    const updateActiveDayButton = useCallback((currentDay) => {
        if (!currentDay) return;
        
        document.querySelectorAll('.quick-nav-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
            btn.classList.add('bg-white', 'text-gray-800', 'border-gray-300');
            btn.blur();
            btn.style.cssText = 'background-color: white !important; color: #374151 !important; border-color: #d1d5db !important;';
            
            const originalDisplay = btn.style.display;
            btn.style.display = 'none';
            btn.offsetHeight;
            btn.style.display = originalDisplay || '';
            btn.offsetHeight;
        });

        requestAnimationFrame(() => {
            const currentDayButton = document.querySelector(`.quick-nav-btn[data-day="${currentDay}"]`);
            if (currentDayButton) {
                currentDayButton.classList.remove('bg-white', 'text-gray-800', 'border-gray-300');
                currentDayButton.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
                currentDayButton.style.cssText = 'background-color: #2563eb !important; color: white !important; border-color: #2563eb !important;';
                
                const originalDisplay = currentDayButton.style.display;
                currentDayButton.style.display = 'none';
                currentDayButton.offsetHeight;
                currentDayButton.style.display = originalDisplay || '';
                currentDayButton.offsetHeight;
            }
        });
    }, []);

    const getActivityColor = useCallback((activityData) => {
        if (typeof activityData === 'string') {
            if (activityData === 'Free' || activityData === 'No Duty') {
                return { backgroundColor: 'bg-gray-50', borderColor: 'border-gray-500', textColor: 'text-gray-600' };
            }
            return { backgroundColor: 'bg-green-100', borderColor: 'border-green-600', textColor: 'text-green-800' };
        }

        if (activityData && activityData.eventType) {
            const eventType = activityData.eventType.toLowerCase();
            const colors = {
                'break': { backgroundColor: 'bg-yellow-100', borderColor: 'border-yellow-500', textColor: 'text-yellow-800' },
                'meeting': { backgroundColor: 'bg-cyan-100', borderColor: 'border-cyan-500', textColor: 'text-cyan-800' },
                'duty': { backgroundColor: 'bg-green-100', borderColor: 'border-green-600', textColor: 'text-green-800' },
                'agenda': { backgroundColor: 'bg-blue-100', borderColor: 'border-blue-500', textColor: 'text-blue-800' },
                'free': { backgroundColor: 'bg-gray-50', borderColor: 'border-gray-500', textColor: 'text-gray-600' }
            };
            return colors[eventType] || colors['duty'];
        }

        return { backgroundColor: 'bg-green-100', borderColor: 'border-green-600', textColor: 'text-green-800' };
    }, []);

    const formatRoleNameForCard = useCallback((roleName) => {
        if (roleName.startsWith('AC ')) {
            const assignments = roleAssignments[roleName];
            if (assignments && assignments.length > 0) {
                const namesList = assignments.join(', ');
                return `${roleName} <span class="text-sm opacity-80">(${namesList})</span>`;
            }
        }
        return roleName;
    }, [roleAssignments]);

    const getEventPriority = useCallback((eventType) => {
        const priorities = { 'duty': 1, 'break': 2, 'free': 3 };
        return priorities[eventType.toLowerCase()] || 1;
    }, []); 

    const shouldReplaceActivity = useCallback((currentActivity, newActivity) => {
        if (currentActivity === null || currentActivity === 'No Duty') return true;
        if (typeof currentActivity === 'string') return true;
        if (typeof currentActivity === 'object' && typeof newActivity === 'object') {
            if (newActivity.priority < currentActivity.priority) return true;
            else if (newActivity.priority === currentActivity.priority) {
                if (newActivity.isOverlapping && !currentActivity.isOverlapping) return true;
                else if (newActivity.isOverlapping === currentActivity.isOverlapping) {
                    const currentDuration = timeToMinutes(currentActivity.endTime) - timeToMinutes(currentActivity.startTime);
                    const newDuration = timeToMinutes(newActivity.endTime) - timeToMinutes(newActivity.startTime);
                    if (newDuration > currentDuration) return true;
                    else if (newDuration === currentDuration) {
                        return timeToMinutes(newActivity.startTime) < timeToMinutes(currentActivity.startTime);
                    }
                }
            }
        }
        return false;
    }, [timeToMinutes]);
    
    const createMobileAbbreviation = useCallback((roleName) => {
        if (roleName === 'Agenda') return 'AG';
        const acMatch = roleName.match(/^AC (\d+)$/);
        if (acMatch) return acMatch[1];
        const cnMatch = roleName.match(/^CN ([A-Z])$/);
        if (cnMatch) return cnMatch[1];
        return roleName;
    }, []);

    const getRoleActivitiesForAgendaEvent = useCallback((agendaEvent) => {
        const roleActivities = {};

        roles.forEach(role => {
            if (role !== 'Agenda') {
                const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const isRoleVisible = activeFilterRoles[roleClass] !== false;
                if (isRoleVisible) {
                    roleActivities[role] = null;
                }
            }
        });

        const rolesWithAssignments = new Set();
        const dayEvents = processedData[agendaEvent.weekday] || [];

        dayEvents.forEach(event => {
            if (event.eventType && event.eventType.toLowerCase() === 'agenda') {
                return;
            }

            const isOverlapping = event.startMins < agendaEvent.endMins && event.endMins > agendaEvent.startMins;
            const startsWithinAgenda = event.startMins >= agendaEvent.startMins && event.startMins < agendaEvent.endMins;
            const isActiveAtAgendaStart = event.startMins <= agendaEvent.startMins && event.endMins > agendaEvent.startMins;

            if (isOverlapping || startsWithinAgenda || isActiveAtAgendaStart) {
                event.assignedRoles.forEach(role => {
                    rolesWithAssignments.add(role);
                    if (Object.prototype.hasOwnProperty.call(roleActivities, role)) {
                        const currentActivity = roleActivities[role];
                        const newActivity = {
                            activity: `${event.eventAbbreviation} - ${event.eventName}`,
                            eventType: event.eventType,
                            startTime: event.startTime,
                            endTime: event.endTime,
                            isOverlapping: isOverlapping,
                            startsWithin: startsWithinAgenda,
                            priority: getEventPriority(event.eventType)
                        };

                        if (shouldReplaceActivity(currentActivity, newActivity)) {
                            roleActivities[role] = newActivity;
                        }
                    }
                });
            }
        });

        const visibleRoles = Object.keys(roleActivities);
        visibleRoles.forEach(role => {
            const acMatch = role.match(/^AC (\d+)$/);
            if (acMatch) {
                const acNumber = parseInt(acMatch[1]);
                const pairedCnLetter = String.fromCharCode('A'.charCodeAt(0) + acNumber - 1);
                const pairedCnRole = `CN ${pairedCnLetter}`;
                if (roles.includes(pairedCnRole) && rolesWithAssignments.has(pairedCnRole) && !Object.prototype.hasOwnProperty.call(roleActivities, pairedCnRole)) {
                    roleActivities[pairedCnRole] = null;
                    dayEvents.forEach(event => {
                        if ((event.startMins < agendaEvent.endMins && event.endMins > agendaEvent.startMins) && event.assignedRoles.includes(pairedCnRole)) {
                            const currentActivity = roleActivities[pairedCnRole];
                            const newActivity = {
                                activity: `${event.eventAbbreviation} - ${event.eventName}`,
                                eventType: event.eventType,
                                startTime: event.startTime,
                                endTime: event.endTime,
                                isOverlapping: event.startMins < agendaEvent.endMins && event.endMins > agendaEvent.startMins,
                                startsWithin: event.startMins >= agendaEvent.startMins && event.startMins < agendaEvent.endMins,
                                priority: getEventPriority(event.eventType)
                            };
                            if (shouldReplaceActivity(currentActivity, newActivity)) {
                                roleActivities[pairedCnRole] = newActivity;
                            }
                        }
                    });
                }
            }
            const cnMatch = role.match(/^CN ([A-Z])$/);
            if (cnMatch) {
                const cnLetter = cnMatch[1];
                const acNumber = cnLetter.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
                const pairedAcRole = `AC ${acNumber}`;
                if (roles.includes(pairedAcRole) && rolesWithAssignments.has(pairedAcRole) && !Object.prototype.hasOwnProperty.call(roleActivities, pairedAcRole)) {
                    roleActivities[pairedAcRole] = null;
                    dayEvents.forEach(event => {
                        if ((event.startMins < agendaEvent.endMins && event.endMins > agendaEvent.startMins) && event.assignedRoles.includes(pairedAcRole)) {
                            const currentActivity = roleActivities[pairedAcRole];
                            const newActivity = {
                                activity: `${event.eventAbbreviation} - ${event.eventName}`,
                                eventType: event.eventType,
                                startTime: event.startTime,
                                endTime: event.endTime,
                                isOverlapping: event.startMins < agendaEvent.endMins && event.endMins > agendaEvent.startMins,
                                startsWithin: event.startMins >= agendaEvent.startMins && event.endMins > agendaEvent.startMins,
                                priority: getEventPriority(event.eventType)
                            };
                            if (shouldReplaceActivity(currentActivity, newActivity)) {
                                roleActivities[pairedAcRole] = newActivity;
                            }
                        }
                    });
                }
            }
        });

        Object.keys(roleActivities).forEach(role => {
            if (roleActivities[role] === null) {
                roleActivities[role] = 'No Duty';
            }
        });

        return roleActivities;
    }, [roles, processedData, getEventPriority, shouldReplaceActivity, activeFilterRoles]);

    const memoizedSlides = useMemo(() => {
        if (!processedData || roles.length === 0 || Object.keys(activeFilterRoles).length === 0) {
            return CONFIG.DAYS_ORDER.map((day) => (
                <div key={day} className="swiper-slide" data-day={day}>
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-600 italic">Loading {day}...</p>
                    </div>
                </div>
            ));
        }

        const slides = CONFIG.DAYS_ORDER.map((day) => (
            <div key={day} className="swiper-slide" data-day={day}>
                <div className={`h-full ${viewMode === 'table' ? 'block' : 'hidden'}`}>
                    <TableView 
                        day={day}
                        processedData={processedData}
                        roles={roles}
                        activeFilterRoles={activeFilterRoles}
                        showRoleModal={showRoleModal}
                        eventsMap={eventsMap}
                        minutesToTime={minutesToTime}
                        createMobileAbbreviation={createMobileAbbreviation}
                        getActivityColor={getActivityColor}
                    />
                </div>
                <div className={`h-full ${viewMode === 'card' ? 'flex' : 'hidden'}`}>
                    <CardView 
                        day={day}
                        processedData={processedData}
                        getRoleActivitiesForAgendaEvent={getRoleActivitiesForAgendaEvent}
                        getActivityColor={getActivityColor}
                        formatRoleNameForCard={formatRoleNameForCard}
                        showRoleModal={showRoleModal}
                        eventsMap={eventsMap}
                        selectedRole={selectedSearchNameData?.role}
                        minutesToTime={minutesToTime}
                    />
                </div>
            </div>
        ));
        
        return slides;
    }, [processedData, roles, viewMode, activeFilterRoles, showRoleModal, eventsMap, minutesToTime, createMobileAbbreviation, getActivityColor, getRoleActivitiesForAgendaEvent, formatRoleNameForCard, selectedSearchNameData?.role]);

    useEffect(() => {
        if (!processedData || Object.keys(processedData).length === 0) {
            return;
        }

        if (swiperRef.current && swiperRef.current.initialized) {
            return;
        }

        swiperRef.current?.destroy();
        
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const initialSlide = Math.max(0, CONFIG.DAYS_ORDER.indexOf(today));

        const timeoutId = setTimeout(() => {
            if (swiperRef.current && swiperRef.current.initialized) {
                return;
            }

            const swiperContainer = document.querySelector('.swiper');
            if (!swiperContainer) {
                return;
            }

            swiperRef.current = new Swiper('.swiper', {
                modules: [Navigation],
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                initialSlide: initialSlide,
                on: {
                    init: (swiper) => {
                        const currentDay = swiper.slides[swiper.activeIndex]?.dataset.day;
                        updateActiveDayButton(currentDay);
                        
                        if (currentDay === today && !hasInitiallyNavigatedRef.current) {
                            hasInitiallyNavigatedRef.current = true;
                            setTimeout(() => {
                                performNavigation();
                            }, 300);
                        }
                    },
                    slideChangeTransitionEnd: (swiper) => {
                        const currentDay = swiper.slides[swiper.activeIndex]?.dataset.day;
                        updateActiveDayButton(currentDay);
                        setTimeout(() => {
                            updateCurrentTimeIndicator();
                        }, 100);
                    },
                },
            });
        }, 100);

        return () => { 
            clearTimeout(timeoutId);
            swiperRef.current?.destroy(); 
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processedData]); // Only depend on processedData, not on memoizedSlides to prevent recreation on filter changes

    useEffect(() => {
        const interval = setInterval(() => {
            updateCurrentTimeIndicator();
        }, 60000);

        return () => clearInterval(interval);
    }, [updateCurrentTimeIndicator]);

    return (
        <>
            {Object.keys(activeFilterRoles).length === 0 || !processedData || Object.keys(processedData).length === 0 ? (
                <div className="fixed inset-0 w-screen h-screen box-border flex flex-col font-sans text-gray-800 bg-gray-100">
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-600 italic">Loading calendar...</p>
                    </div>
                </div>
            ) : (
                <>
                    <Header
                        roles={roles}
                        allNames={allNames}
                        viewMode={viewMode}
                        nameSearchInput={nameSearchInput}
                        setNameSearchInput={setNameSearchInput}
                        setSelectedSearchNameData={setSelectedSearchNameData}
                        setActiveFilterRoles={setActiveFilterRoles}
                        onFilterModalOpen={handleFilterModalOpen}
                        onViewToggle={handleViewToggle}
                        onDutiesSummaryClick={() => setIsDutiesSummaryModalOpen(true)}
                        onNameSelect={selectNameAndFilter}
                        onClearNameSearch={(newFilters) => savePreferences(newFilters, viewMode, null)}
                        goToDay={goToDay}
                        updateActiveDayButton={updateActiveDayButton}
                    />
                    <main className="flex-grow min-h-0 relative">
                        <div className="swiper h-full">
                            <div className="swiper-wrapper">
                                {memoizedSlides}
                            </div>
                        </div>
                        
                        {/* Floating "Go to Now" button */}
                        <button
                            onClick={manualNavigateToCurrentTime}
                            className="fixed bottom-6 left-6 w-14 h-14 border border-gray-300 bg-white text-gray-800 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center text-xs font-semibold z-50 hover:shadow-xl"
                            title="Go to current time"
                        >
                            NOW
                        </button>
                    </main>
                    <Modals
                        isRoleModalOpen={isRoleModalOpen}
                        closeRoleModal={() => setIsRoleModalOpen(false)}
                        selectedEvent={selectedEvent}
                        findLinkedEvents={findLinkedEvents}
                        roleFullNames={roleFullNames}
                        isFilterModalOpen={isFilterModalOpen}
                        closeFilterModal={closeFilterModal}
                        tempFilterRoles={tempFilterRoles}
                        setTempFilterRoles={setTempFilterRoles}
                        applyFilters={applyFilters}
                        roles={roles}
                        roleAssignments={roleAssignments}
                        isDutiesSummaryModalOpen={isDutiesSummaryModalOpen}
                        closeDutiesSummaryModal={() => setIsDutiesSummaryModalOpen(false)}
                        handleFilterChange={handleFilterChange}
                        handleFilterControl={handleFilterControl}
                        showRoleModal={showRoleModal}
                        dutiesData={dutiesData}
                        allNames={allNames}
                        selectNameAndFilter={selectNameAndFilter}
                    />
                </>
            )}
        </>
    );
};

export default memo(CalendarView);