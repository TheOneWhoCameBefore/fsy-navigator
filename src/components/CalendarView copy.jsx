import React, { useState, useEffect, useRef, useCallback, useMemo, memo, startTransition } from 'react';
import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

import Header from './Header';
import Modals from './Modals';
import useCalendarData from '../hooks/useCalendarData';

// Configuration and constants specific to the calendar
const CONFIG = {
    DAYS_ORDER: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    LOCAL_STORAGE_KEY: 'duties-calendar-preferences',
};

const CalendarView = ({ schedules, roles, roleAssignments, roleFullNames, allNames }) => {
    // Debug: Track when component re-renders and why
    const prevRolesRef = useRef(roles);
    const renderCountRef = useRef(0);
    const prevStateRef = useRef({});
    renderCountRef.current += 1;
    
    console.log(`[Component] CalendarView render #${renderCountRef.current}`);
    console.log(`[Props] roles changed: ${prevRolesRef.current !== roles}, same content: ${JSON.stringify(prevRolesRef.current) === JSON.stringify(roles)}`);
    prevRolesRef.current = roles;
    
    // Load saved preferences immediately to prevent visual switching - MEMOIZED
    const { viewMode: initialViewMode, savedFilters } = useMemo(() => {
        console.log(`[Preferences] Loading preferences...`);
        const loadSavedPreferences = () => {
            const savedPreferences = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
            if (savedPreferences) {
                try {
                    const { filters, isCardView } = JSON.parse(savedPreferences);
                    return {
                        viewMode: isCardView ? 'card' : 'table',
                        savedFilters: filters
                    };
                } catch (e) {
                    console.warn('Failed to parse saved preferences:', e);
                }
            }
            return { viewMode: 'card', savedFilters: null };
        };
        const result = loadSavedPreferences();
        console.log(`[Preferences] Loaded - initialViewMode: ${result.viewMode}, savedFilters: ${JSON.stringify(result.savedFilters)}`);
        return result;
    }, []); // Empty dependency array - only load once
    
    // Memoize savedFilters to prevent recreation
    const savedFiltersString = useMemo(() => JSON.stringify(savedFilters), [savedFilters]);
    
    // Create a stable roles identifier to prevent unnecessary re-renders
    const rolesString = useMemo(() => {
        if (roles.length === 0) return '';
        const result = JSON.stringify(roles);
        console.log(`[Roles] rolesString updated: length=${roles.length}, first few roles: ${roles.slice(0, 3).join(', ')}`);
        return result;
    }, [roles]);
    
    // Pre-compute initial filter state to prevent visual switching - FULLY MEMOIZED
    const getInitialFilters = useCallback(() => {
        console.log(`[getInitialFilters] Called - roles.length: ${roles.length}, rolesString: ${rolesString.substring(0, 30)}...`);
        
        if (roles.length === 0) return {}; // Wait for roles
        
        const baseFilters = roles.reduce((acc, role) => {
            acc[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
            return acc;
        }, {});
        
        if (savedFilters) {
            const loadedFilters = {};
            savedFilters.forEach(filter => {
                loadedFilters[filter.value] = filter.checked;
            });
            // Ensure any new roles (like Agenda) are included and set to true
            Object.keys(baseFilters).forEach(role => {
                if (!(role in loadedFilters)) {
                    loadedFilters[role] = true;
                }
            });
            console.log(`[getInitialFilters] Returning loaded filters:`, loadedFilters);
            return loadedFilters;
        }
        console.log(`[getInitialFilters] Returning base filters:`, baseFilters);
        return baseFilters;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rolesString, savedFiltersString]); // Use stable strings for comparison

    // --- State Management ---
    // All UI state is now managed locally within this component
    const [viewMode, setViewMode] = useState(initialViewMode);
    const [activeFilterRoles, setActiveFilterRoles] = useState(() => getInitialFilters());
    const [tempFilterRoles, setTempFilterRoles] = useState({});
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [nameSearchInput, setNameSearchInput] = useState('');
    const [_selectedSearchNameData, setSelectedSearchNameData] = useState(null);
    
    // SINGLE state for complete readiness - replaces all individual flags
    const [isFullyReady, setIsFullyReady] = useState(false);

    // Debug state changes
    const currentState = {
        viewMode,
        activeFilterRolesCount: Object.keys(activeFilterRoles).length,
        isFullyReady
    };
    
    if (JSON.stringify(prevStateRef.current) !== JSON.stringify(currentState)) {
        console.log(`[State Change] Render #${renderCountRef.current}:`, {
            previous: prevStateRef.current,
            current: currentState
        });
        prevStateRef.current = currentState;
    }

    // Modal State
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isDutiesSummaryModalOpen, setIsDutiesSummaryModalOpen] = useState(false);

    // --- Refs and Custom Hooks ---
    const swiperRef = useRef(null);
    const hasScrolledToTimeRef = useRef(false);
    const hasInitializedRef = useRef(false); // Track if we've already initialized
    const { processedData, mergedEvents, findLinkedEvents, timeToMinutes, minutesToTime } = useCalendarData(schedules);

    // Determine which dutiesData to use based on number of AC roles (memoized)
    const acRolesCount = useMemo(() => roles.filter(role => role.startsWith('AC ')).length, [roles]);
    
    // Duties data for 10 AC roles (memoized)
    const dutiesData10 = useMemo(() => ({
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
    }), []);

    // Duties data for 8 AC roles (memoized)
    const dutiesData8 = useMemo(() => ({
        'AC 1': ['Bus Welcome','Music Program','Dance Accommodations (T)','Games Night Accommodations','Dance Lead (F)','Tech Bag Coordinator','Thursday Exercise Coordinator',],
        'AC 2': ['Musical Program','Dance Lead (T)','Games Night','TIHS - Assist','Dance DJ (F)','Friday Exercise Coordinator',],
        'AC 3': ['Bus Welcome','Music Program','Games Night','Pizza Night','Check-In Dance','Wednesday Exercise Coordinator',],
        'AC 4': ['Singers','Orientation','Flex-Time','Games Night Lead','Bus Bye-Bye','Lost & Found Coordinator','Tuesday Exercise Coordinator',],
        'AC 5': ['Check-In Lead','Orientation','Varitey Show','Dance DJ (T)','Games Night','Thursday Exercise Coordinator',],
        'AC 6': ['Hall Monitor','Variety Show','Games Night','Testimony Rooms','Communications Coordinator','Tuesday Exercise Coordinator',],
        'AC 7': ['Orientation','Class Duty Lead','TIHS - Slideshow','Dance Accommodations (F)','Thank You-Notes Coordinator','Wednesday Exercise Coordinator',],
        'AC 8': ['Orientation','Games Night','TIHS - Lead','Social Media Coordinator','Friday Exercise Coordinator',]
    }), []);

    const dutiesData = useMemo(() => {
        return acRolesCount === 10 ? dutiesData10 : (acRolesCount === 8 ? dutiesData8 : {});
    }, [acRolesCount, dutiesData10, dutiesData8]);

    // --- Navigation Functions ---
    const goToDay = useCallback((day) => {
        const dayIndex = CONFIG.DAYS_ORDER.indexOf(day);
        if (dayIndex !== -1 && swiperRef.current) {
            swiperRef.current.slideTo(dayIndex);
            // Let the Swiper slideChange event handle updating the day button styling
        }
    }, []);

    const updateActiveDayButton = useCallback((currentDay) => {
        // Reset all buttons to default state with aggressive visual refresh
        document.querySelectorAll('.quick-nav-btn').forEach(btn => {
            // Remove all possible states
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
            btn.classList.add('bg-white', 'text-gray-800', 'border-gray-300');
            
            // Clear any lingering focus/hover states
            btn.blur();
            
            // Force complete style reset with direct CSS property manipulation
            btn.style.cssText = 'background-color: white !important; color: #374151 !important; border-color: #d1d5db !important;';
            
            // Force immediate visual refresh by hiding and showing the element
            const originalDisplay = btn.style.display;
            btn.style.display = 'none';
            btn.offsetHeight; // Force reflow
            btn.style.display = originalDisplay || '';
            
            // Additional forced reflow
            btn.offsetHeight;
        });

        // Use requestAnimationFrame to ensure DOM updates are complete
        requestAnimationFrame(() => {
            const currentDayButton = document.querySelector(`.quick-nav-btn[data-day="${currentDay}"]`);
            if (currentDayButton) {
                // Ensure this button also loses focus first
                currentDayButton.blur();
                
                // Remove default classes and add active classes
                currentDayButton.classList.remove('bg-white', 'text-gray-800', 'border-gray-300');
                currentDayButton.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
                
                // Force the active styles with direct CSS manipulation
                currentDayButton.style.cssText = 'background-color: #2563eb !important; color: white !important; border-color: #2563eb !important;';
                
                // Force visual refresh for the active button too
                const originalDisplay = currentDayButton.style.display;
                currentDayButton.style.display = 'none';
                currentDayButton.offsetHeight; // Force reflow
                currentDayButton.style.display = originalDisplay || '';
                
                // Final forced reflow
                currentDayButton.offsetHeight;
            }
        });
    }, []);
    
    const navigateToCurrentTime = useCallback(() => {
        const now = new Date();
        const today = now.toLocaleDateString('en-US', { weekday: 'long' });
        const todayIndex = CONFIG.DAYS_ORDER.indexOf(today);
        
        // Only proceed if it's a valid day and we haven't already scrolled
        if (todayIndex === -1 || hasScrolledToTimeRef.current) return;
        
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        // const currentMinutes = 12 * 60 + 30; // Test time: 12:30 PM
        
        // Mark that we've handled the initial scroll immediately to prevent multiple calls
        hasScrolledToTimeRef.current = true;
        
        // Single scroll function with better DOM readiness checks
        const performScroll = () => {
            // Reduced delay for faster, less visible scrolling
            setTimeout(() => {
                if (viewMode === 'table') {
                    // Table view scrolling - try multiple selectors to find the container
                    let tableContainer = document.querySelector('.swiper-slide-active .overflow-y-auto');
                    if (!tableContainer) {
                        // Fallback: try to find any table container in the active slide
                        const activeSlide = document.querySelector('.swiper-slide-active');
                        if (activeSlide) {
                            tableContainer = activeSlide.querySelector('.overflow-y-auto');
                        }
                    }
                    if (!tableContainer) {
                        // Second fallback: find the table container by looking for the table itself
                        const table = document.querySelector('.swiper-slide-active table');
                        if (table) {
                            tableContainer = table.closest('.overflow-y-auto');
                        }
                    }
                    
                    if (!tableContainer) {
                        console.warn('Table container not found for scrolling, DOM may not be ready yet');
                        return;
                    }
                    
                    const roundedMinutes = Math.floor(currentMinutes / 5) * 5;
                    let timeRow = document.querySelector(`tr[data-time-minutes="${roundedMinutes}"]`);
                    
                    if (!timeRow) {
                        const allTimeRows = Array.from(document.querySelectorAll('tr[data-time-minutes]'));
                        if (allTimeRows.length === 0) {
                            console.warn('No time rows found for scrolling');
                            return;
                        }
                        
                        const timeValues = allTimeRows.map(row => parseInt(row.getAttribute('data-time-minutes')));
                        timeValues.sort((a, b) => a - b);
                        
                        // Handle edge cases
                        if (roundedMinutes < timeValues[0]) {
                            tableContainer.scrollTop = 0;
                            return;
                        } else if (roundedMinutes > timeValues[timeValues.length - 1]) {
                            tableContainer.scrollTop = tableContainer.scrollHeight;
                            return;
                        }
                        
                        // Find closest time (could be before or after the target)
                        let closestTime = timeValues[0];
                        let smallestDifference = Math.abs(timeValues[0] - roundedMinutes);
                        
                        for (const time of timeValues) {
                            const difference = Math.abs(time - roundedMinutes);
                            if (difference < smallestDifference) {
                                smallestDifference = difference;
                                closestTime = time;
                            }
                        }
                        
                        timeRow = document.querySelector(`tr[data-time-minutes="${closestTime}"]`);
                    }
                    
                    if (timeRow) {
                        // Get the sticky header height to account for it in scroll positioning
                        const headerRow = document.querySelector('.swiper-slide-active thead tr');
                        const headerHeight = headerRow ? headerRow.offsetHeight : 40; // fallback to 40px
                        
                        // Add the 5-minute offset (which is one row) plus adjust by moving 3 hours forward
                        const oneRowHeight = 40; // Each 5-min row is about 40px tall  
                        const adjustmentRows = 16; // 3 hours = 180 minutes = 36 five-minute intervals
                        const scrollAdjustment = (adjustmentRows * oneRowHeight);
                        
                        // Calculate scroll position: offsetTop minus header height PLUS our adjustment (opposite direction)
                        const scrollTop = Math.max(0, timeRow.offsetTop - headerHeight + scrollAdjustment);
                        
                        // Use smooth scrolling with requestAnimationFrame for better performance
                        tableContainer.style.scrollBehavior = 'smooth';
                        
                        // Use requestAnimationFrame for smoother animation
                        requestAnimationFrame(() => {
                            tableContainer.scrollTop = scrollTop;
                        });
                    }
                } else {
                    // Card view scrolling
                    const dayEvents = processedData[today];
                    if (!dayEvents || dayEvents.length === 0) return;
                    
                    // For card view, look specifically for the card container (not table container)
                    let cardContainer = null;
                    const activeSlide = document.querySelector('.swiper-slide-active');
                    if (activeSlide) {
                        // Look for overflow container that doesn't contain a table (card view)
                        const overflowContainers = activeSlide.querySelectorAll('.overflow-y-auto');
                        for (let container of overflowContainers) {
                            if (!container.querySelector('table')) {
                                cardContainer = container;
                                break;
                            }
                        }
                    }
                    
                    if (!cardContainer) {
                        console.warn('Card view container not found for scrolling');
                        return;
                    }
                    
                    const agendaEvents = dayEvents
                        .filter(event => event.eventType && event.eventType.toLowerCase() === 'agenda')
                        .sort((a, b) => a.startMins - b.startMins);
                    
                    if (agendaEvents.length === 0) return;
                    
                    // Handle edge cases first
                    if (currentMinutes < agendaEvents[0].startMins) {
                        cardContainer.scrollTop = 0;
                        return;
                    }
                    
                    if (currentMinutes > agendaEvents[agendaEvents.length - 1].endMins) {
                        cardContainer.scrollTop = cardContainer.scrollHeight;
                        return;
                    }
                    
                    // Find target event
                    let targetEvent = agendaEvents.find(event => 
                        currentMinutes >= event.startMins && currentMinutes < event.endMins
                    );
                    
                    if (!targetEvent) {
                        targetEvent = agendaEvents.find(event => event.startMins > currentMinutes);
                    }
                    
                    if (!targetEvent && agendaEvents.length > 0) {
                        targetEvent = agendaEvents[agendaEvents.length - 1];
                    }
                    
                    if (targetEvent) {
                        const eventIndex = agendaEvents.indexOf(targetEvent);
                        
                        // Find the actual agenda event card (not role assignments within cards)
                        let targetElement = null;
                        
                        // Look for the card that represents this agenda event
                        // Cards are direct children of the card container
                        const directChildren = Array.from(cardContainer.children);
                        
                        // Try to find by index first (most reliable)
                        if (directChildren[eventIndex] && directChildren[eventIndex].offsetHeight > 0) {
                            targetElement = directChildren[eventIndex];
                        }
                        
                        // Fallback: search for a card containing the event time as a prominent element
                        if (!targetElement) {
                            for (let child of directChildren) {
                                // Look for time spans (agenda event cards have prominent time displays)
                                const timeSpans = child.querySelectorAll('span');
                                for (let span of timeSpans) {
                                    if (span.textContent.includes(targetEvent.startTime)) {
                                        // Make sure this is a time span (usually has specific styling)
                                        if (span.className.includes('bg-') || span.className.includes('text-xs')) {
                                            targetElement = child;
                                            break;
                                        }
                                    }
                                }
                                if (targetElement) break;
                            }
                        }
                        
                        // Another fallback: look for cards containing the exact event name as a main heading/title
                        if (!targetElement) {
                            for (let child of directChildren) {
                                // Look for the event name in prominent text elements (not in role assignment details)
                                const headings = child.querySelectorAll('span.font-medium, span.text-gray-700');
                                for (let heading of headings) {
                                    if (heading.textContent.trim() === targetEvent.eventName) {
                                        targetElement = child;
                                        break;
                                    }
                                }
                                if (targetElement) break;
                            }
                        }
                        
                        if (targetElement && targetElement !== cardContainer) {
                            // Use smooth scrolling like table view
                            cardContainer.style.scrollBehavior = 'smooth';
                            
                            // Scroll with a small offset to show some context above the card
                            targetElement.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start',
                                inline: 'nearest'
                            });
                            
                            // Add a small upward adjustment to show some context above the card
                            setTimeout(() => {
                                cardContainer.scrollTop = Math.max(0, cardContainer.scrollTop - 20);
                            }, 300); // Match the smooth scroll timing
                            
                        } else {
                            // Simple proportional fallback
                            const proportion = eventIndex / agendaEvents.length;
                            const scrollPosition = proportion * cardContainer.scrollHeight;
                            cardContainer.scrollTop = Math.max(0, scrollPosition - 50);
                        }
                    }
                }
            }, 20); // Much shorter delay - scroll almost immediately
        };
        
        // Return the scroll function to be called once when DOM is ready
        return performScroll;
    }, [viewMode, processedData]);

    const getAdjacentRole = useCallback((role) => {
        const acMatch = role.match(/^AC (\d+)$/);
        if (acMatch) {
            const acNumber = parseInt(acMatch[1]);
            const adjacentNumber = acNumber % 2 === 1 ? acNumber + 1 : acNumber - 1;
            return `AC ${adjacentNumber}`;
        }
        const cnMatch = role.match(/^CN ([A-Z])$/);
        if (cnMatch) {
            const cnLetter = cnMatch[1];
            const letterIndex = cnLetter.charCodeAt(0) - 'A'.charCodeAt(0);
            const adjacentIndex = letterIndex % 2 === 0 ? letterIndex + 1 : letterIndex - 1;
            const adjacentLetter = String.fromCharCode('A'.charCodeAt(0) + adjacentIndex);
            return `CN ${adjacentLetter}`;
        }
        return null;
    }, []);

    const selectNameAndFilter = (nameData) => {
        // Set the input text for the user
        setNameSearchInput(`${nameData.role} - ${nameData.fullName}`);
        setSelectedSearchNameData(nameData);

        // Calculate the new filters
        const newActiveFilters = {};
        roles.forEach(role => {
            const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            newActiveFilters[roleClass] = false; // Start by hiding all roles
        });

        // Show the selected person's role
        const selectedRoleClass = nameData.role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        newActiveFilters[selectedRoleClass] = true;

        // Show the adjacent role if it exists
        const adjacentRole = getAdjacentRole(nameData.role);
        if (adjacentRole && roles.includes(adjacentRole)) {
            newActiveFilters[adjacentRole.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
        }
        
        // Always show the Agenda
        newActiveFilters['agenda'] = true;

        // Apply the new filters
        setActiveFilterRoles(newActiveFilters);
    };

    const handleFilterChange = (roleClass, isChecked) => {
        setTempFilterRoles(prev => ({ ...prev, [roleClass]: isChecked }));
    };

    const handleFilterControl = (action) => {
        const newFilters = {};
        roles.forEach(role => {
            const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            if (roleClass === 'agenda') {
                newFilters[roleClass] = true;
            } else {
                newFilters[roleClass] = action === 'select-all';
            }
        });
        setTempFilterRoles(newFilters);
    };

    // --- Helper Functions (Moved from original App.jsx) ---
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
        // Only show names for AC roles in card view
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
        const priorities = {
            'duty': 1,
            'break': 2,
            'free': 3
        };
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
                            const currentStart = timeToMinutes(currentActivity.startTime);
                            const newStart = timeToMinutes(newActivity.startTime);
                            return newStart < currentStart;
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

    // --- Side Effects (useEffect hooks) ---

    // Simplified filter initialization - just mark as ready when roles are available
    useEffect(() => {
        console.log(`[Filter Effect] Triggered - roles.length: ${roles.length}, activeFilterRoles keys: ${Object.keys(activeFilterRoles).length}, hasInitializedRef.current: ${hasInitializedRef.current}`);
        
        if (roles.length === 0 || hasInitializedRef.current) return;
        
        // Update filters if they weren't set correctly on initial load
        const currentFilters = getInitialFilters();
        if (Object.keys(activeFilterRoles).length === 0 && Object.keys(currentFilters).length > 0) {
            console.log(`[Filter Effect] Setting activeFilterRoles`);
            setActiveFilterRoles(currentFilters);
        }
        
        console.log(`[Filter Effect] Reset ready state - roles.length: ${roles.length}`);
        
        // Mark as fully ready once roles are loaded and filters are set
        // Use startTransition to batch this state update and prevent render interruption
        setTimeout(() => {
            startTransition(() => {
                setIsFullyReady(true);
                hasInitializedRef.current = true; // Prevent running again
                console.log(`[Filter Effect] Set isFullyReady = true, hasInitializedRef = true`);
            });
        }, 50);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roles.length]); // Only depend on roles.length, not the function itself

    // Initialize and manage Swiper - only after all data is ready
    const processedDataKeys = Object.keys(processedData).length;
    useEffect(() => {
        console.log(`[Swiper Effect] Triggered - roles: ${roles.length}, processedData: ${processedDataKeys}, isFullyReady: ${isFullyReady}`);
        
        if (roles.length === 0 || processedDataKeys === 0 || !isFullyReady) {
            console.log(`[Swiper Effect] Skipping - missing requirements`);
            return;
        }

        // Clean up any existing swiper
        if (swiperRef.current) {
            console.log(`[Swiper Effect] Cleaning up existing Swiper`);
            swiperRef.current.destroy(true, true);
            swiperRef.current = null;
        }

        // Get today's index before creating Swiper
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayIndex = CONFIG.DAYS_ORDER.indexOf(today);
        const startSlide = todayIndex !== -1 ? todayIndex : 0;

        console.log(`[Swiper Effect] Today: ${today}, Index: ${todayIndex}, Start Slide: ${startSlide}`);

        // Ensure DOM is ready, then create Swiper
        const timer = setTimeout(() => {
            console.log(`[Swiper Effect] Creating Swiper with initialSlide: ${startSlide}`);
            
            swiperRef.current = new Swiper('.swiper', {
                modules: [Navigation],
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                keyboard: { enabled: true },
                initialSlide: startSlide, // Start directly at today's slide
                speed: 300, // Restore smooth transitions for swiping
                allowTouchMove: true,
                on: {
                    init: function() {
                        console.log(`[Swiper Effect] Initialized on slide ${this.activeIndex}, expected: ${startSlide}`);
                        
                        // Swiper is now initialized directly on the correct slide
                        const currentDay = this.slides[this.activeIndex]?.dataset.day;
                        console.log(`[Swiper Effect] Current day: ${currentDay}, expected: ${today}`);
                        
                        if (currentDay) {
                            // Update button styling immediately
                            updateActiveDayButton(currentDay);
                            
                            // Execute scroll BEFORE showing the page to prevent visible jumping
                            if (currentDay === today) {
                                console.log(`[Swiper Effect] Executing scroll for initial load`);
                                // Execute scroll immediately with minimal delay
                                setTimeout(() => {
                                    const scrollFunction = navigateToCurrentTime();
                                    if (scrollFunction) {
                                        scrollFunction();
                                    }
                                }, 20); // Reduced from 50ms to 20ms for faster execution
                            }
                            
                            // After successful initialization, trigger re-render to load all slide content
                            // Use requestAnimationFrame to ensure DOM updates are complete before loading all slides
                            console.log(`[Swiper Effect] Triggering slide content loading after DOM settles`);
                            requestAnimationFrame(() => {
                                setTimeout(() => {
                                    console.log(`[Swiper Effect] All slides loaded = true`);
                                }, 50); // Short delay after animation frame
                            });
                        }
                    },
                    slideChangeTransitionEnd: function () {
                        const currentDay = this.slides[this.activeIndex]?.dataset.day;
                        if (currentDay) {
                            updateActiveDayButton(currentDay);
                        }
                    },
                },
            });
            
            console.log(`[Swiper Effect] Swiper initialization complete`);
        }, 100); // Reduced delay since we're preventing multiple initializations

        return () => {
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roles.length, processedDataKeys, isFullyReady]); // Minimal dependencies to prevent loops


    // --- UI Interaction Handlers ---

    const handleViewToggle = useCallback(() => {
        const newViewMode = viewMode === 'card' ? 'table' : 'card';
        setViewMode(newViewMode);
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({ 
            filters: Object.entries(activeFilterRoles).map(([value, checked]) => ({ value, checked })), 
            isCardView: newViewMode === 'card' 
        }));
        
        // Prevent re-initialization by maintaining current swiper state
        // The view change will be handled by the memoized slides re-rendering
    }, [viewMode, activeFilterRoles]);
    
    const showRoleModal = useCallback((eventData) => {
        setSelectedEvent(eventData);
        setIsRoleModalOpen(true);
    }, []);

    const applyFilters = useCallback(() => {
        setActiveFilterRoles(tempFilterRoles);
        setIsFilterModalOpen(false);
        // Save preferences
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({ 
            filters: Object.entries(tempFilterRoles).map(([value, checked]) => ({ value, checked })), 
            isCardView: viewMode === 'card' 
        }));
    }, [tempFilterRoles, viewMode]);
    
    const closeFilterModal = useCallback(() => {
        // Automatically apply filters when closing modal
        setActiveFilterRoles(tempFilterRoles);
        setIsFilterModalOpen(false);
        // Save preferences
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({ 
            filters: Object.entries(tempFilterRoles).map(([value, checked]) => ({ value, checked })), 
            isCardView: viewMode === 'card' 
        }));
    }, [tempFilterRoles, viewMode]);
    
    const handleFilterModalOpen = useCallback(() => {
        setTempFilterRoles({ ...activeFilterRoles });
        setIsFilterModalOpen(true);
    }, [activeFilterRoles]);

    // --- Rendering Logic ---

    // Note: The original, very large rendering functions are included here for completeness.
    // In a future refactor, these could even be broken into their own sub-components.

    const renderCalendarForDay = useCallback((day) => {
        const dayEvents = processedData[day];
        if (!dayEvents || dayEvents.length === 0) {
            return <div className="flex items-center justify-center h-full"><p className="text-gray-600 italic">No events for {day}.</p></div>;
        }

        const allTimes = dayEvents.flatMap(e => [e.startMins, e.endMins]).filter(t => t !== null);
        if (allTimes.length === 0) return <div className="flex items-center justify-center h-full"><p className="text-gray-600 italic">No valid events for {day}.</p></div>;

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

        const tableRows = [];
        for (let t = minTime; t < maxTime; t += 5) {
            const rowCells = [];
            rowCells.push(<td key="time" className="time-col sticky left-0 bg-gray-100 p-1 font-bold w-[70px] text-xs text-center h-10 border-r border-gray-400">{minutesToTime(t)}</td>);
            roles.forEach(role => {
                const eventAtTime = eventGrid[role]?.[t];
                const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const isRoleVisible = role === 'Agenda' || activeFilterRoles[roleClass] !== false; // Always show Agenda

                if (eventAtTime?.isStart) {
                    const rowspan = Math.max(1, Math.floor(eventAtTime.duration / 5));
                    const eventKey = `${eventAtTime.weekday}-${eventAtTime.startTime}-${eventAtTime.endTime}-${eventAtTime.eventName}-${eventAtTime.eventType}`;
                    const colors = getActivityColor(eventAtTime);
                    const visibleRoleCount = roles.filter(r => activeFilterRoles[r.replace(/[^a-z0-9]/gi, '-').toLowerCase()] !== false && r !== 'Agenda').length;
                    rowCells.push(
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
                                    activity: `${eventAtTime.eventAbbreviation} - ${eventAtTime.eventName}`,
                                    description: eventAtTime.eventDescription,
                                    eventTime: `${eventAtTime.startTime} - ${eventAtTime.endTime}`,
                                    eventName: eventAtTime.eventName,
                                    eventType: eventAtTime.eventType,
                                    mergedEvent: mergedEvents.find(e => {
                                        const key = `${e.weekday}-${e.startTime}-${e.endTime}-${e.eventName}-${e.eventType}`;
                                        return key === eventKey;
                                    })
                                })}
                            >
                                <div className="sticky top-8 overflow-hidden text-ellipsis">
                                    {/* On small screens, show full name if <= 4 visible roles, else abbreviation only */}
                                    <span className={`event-full ${visibleRoleCount <= 4 ? 'block' : 'hidden'} md:block`}><strong>{eventAtTime.eventAbbreviation}</strong> - {eventAtTime.eventName}</span>
                                    <span className={`event-abbr-only ${visibleRoleCount > 4 ? 'block' : 'hidden'} md:hidden text-xs`}><strong>{eventAtTime.eventAbbreviation}</strong></span>
                                </div>
                            </div>
                        </td>
                    );
                } else if (!eventAtTime?.isSpanned) {
                    rowCells.push(<td key={role} className={`role-col h-10 p-0 text-center align-top break-words border-r border-gray-300 ${isRoleVisible ? '' : 'hidden'}`} data-role={roleClass}></td>);
                }
            });
            tableRows.push(<tr key={t} data-time-minutes={t}>{rowCells}</tr>);
        }

        const manyColumnsClass = roles.filter(role => role === 'Agenda' || (activeFilterRoles[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] !== false && role !== 'Agenda')).length > 7 ? 'many-columns' : '';

        return (
            <div className="overflow-y-auto overflow-x-hidden h-full">
                <table className={`w-full border-collapse table-fixed ${manyColumnsClass}`}>
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
                    <tbody>{tableRows}</tbody>
                </table>
            </div>
        );
    }, [processedData, roles, minutesToTime, createMobileAbbreviation, getActivityColor, showRoleModal, mergedEvents, activeFilterRoles]);

    const getRoleActivitiesForAgendaEvent = useCallback((agendaEvent) => {
        const roleActivities = {};

        roles.forEach(role => {
            if (role !== 'Agenda') {
                const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const isRoleVisible = role === 'Agenda' || activeFilterRoles[roleClass] !== false;
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

    const generateRoleAssignmentHTML = useCallback((role, activityData, agendaEvent) => {
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
                    mergedEvent: mergedEvents.find(e => {
                        const key = `${e.weekday}-${e.startTime}-${e.endTime}-${e.eventName}-${e.eventType}`;
                        return key === eventKey;
                    })
                })}
            >
                <div 
                    className="font-bold text-gray-800 hover:text-blue-600 transition-colors duration-200" 
                    dangerouslySetInnerHTML={{ __html: roleNameWithAssignments }}
                ></div>
                <div className={`text-sm ${colors.textColor}`}>{displayText}{timeIndicator}</div>
            </div>
        );
    }, [getActivityColor, formatRoleNameForCard, showRoleModal, processedData, mergedEvents]);

    const generateCardViewForDay = useCallback((day) => {
        const dayEvents = processedData[day];
        if (!dayEvents || dayEvents.length === 0) {
            return <div className="p-2 flex flex-col gap-4 h-full overflow-y-auto"><div className="text-center text-gray-600 italic p-8">No events for {day}.</div></div>;
        }

        const allAgendaEvents = dayEvents
            .filter(event => event.eventType && event.eventType.toLowerCase() === 'agenda')
            .sort((a, b) => a.startMins - b.startMins);

        if (allAgendaEvents.length === 0) {
            return <div className="p-2 flex flex-col gap-4 h-full overflow-y-auto"><div className="text-center text-gray-600 italic p-8">No agenda events for {day}.</div></div>;
        }

        return (
            <div className="p-1 flex flex-col gap-2 h-full overflow-y-auto w-full">
                {allAgendaEvents.map((agendaEvent, index) => {
                    const lowerEventName = agendaEvent.eventName.toLowerCase();
                    const isTravelEvent = lowerEventName.includes('travel') || lowerEventName.includes('transition') || lowerEventName.includes('move to') || lowerEventName.includes('roll call');

                    if (isTravelEvent) {
                        return (
                            <div key={index} className="flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg p-2 shadow-sm transition-all duration-200 hover:translate-y-[-1px] hover:shadow-md text-sm">
                                <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">{agendaEvent.startTime}</span>
                                <span className="text-gray-700 font-medium text-center flex-grow text-sm">{agendaEvent.eventName}</span>
                            </div>
                        );
                    } else {
                        const roleActivities = getRoleActivitiesForAgendaEvent(agendaEvent);
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
                                        {acRole ? generateRoleAssignmentHTML(acRole[0], acRole[1], agendaEvent) : <div className="invisible"></div>}
                                        {cnRole ? generateRoleAssignmentHTML(cnRole[0], cnRole[1], agendaEvent) : <div className="invisible"></div>}
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
                                    {generateRoleAssignmentHTML(otherRoles[i][0], otherRoles[i][1], agendaEvent)}
                                    {otherRoles[i + 1] && generateRoleAssignmentHTML(otherRoles[i + 1][0], otherRoles[i + 1][1], agendaEvent)}
                                </div>
                            );
                        }

                        return (
                            <div key={index} className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-md">
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
                    }
                })}
            </div>
        );
    }, [processedData, getRoleActivitiesForAgendaEvent, generateRoleAssignmentHTML]);

    const memoizedSlides = useMemo(() => {
        // Always render slides - control initialization separately
        if (roles.length === 0) {
            console.log(`[Slides] Not rendering - roles: ${roles.length}`);
            return [];
        }
        
        // Get today's info to determine initial slide rendering strategy
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayIndex = CONFIG.DAYS_ORDER.indexOf(today);
        
        console.log(`[Slides] Rendering slides - today: ${today}, todayIndex: ${todayIndex}`);
        
        return CONFIG.DAYS_ORDER.map((day, index) => {
            console.log(`[Slides] Day: ${day}, Index: ${index}`);
            
            return (
                <div key={day} className="swiper-slide" data-day={day}>
                    <>
                        <div className={`h-full ${viewMode === 'table' ? 'block' : 'hidden'}`}>
                            {renderCalendarForDay(day)}
                        </div>
                        <div className={`h-full ${viewMode === 'card' ? 'flex' : 'hidden'}`}>
                            {generateCardViewForDay(day)}
                        </div>
                    </>
                </div>
            );
        });
    }, [viewMode, renderCalendarForDay, generateCardViewForDay, roles]);


    return (
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
                goToDay={goToDay}
            />
            <main className="flex-grow min-h-0 relative">
                {roles.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-600 italic">Loading calendar...</p>
                    </div>
                ) : (
                    <div className="swiper h-full">
                        <div className="swiper-wrapper">
                            {memoizedSlides}
                        </div>
                    </div>
                )}
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
    );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(CalendarView);