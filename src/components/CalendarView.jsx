import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

import Header from './Header';
import Modals from './Modals';
import useCalendarData from '../hooks/useCalendarData';

const CONFIG = {
    DAYS_ORDER: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    LOCAL_STORAGE_KEY: 'duties-calendar-preferences',
};

const loadSavedPreferences = () => {
    const saved = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            const { filters, isCardView } = JSON.parse(saved);
            return { viewMode: isCardView ? 'card' : 'table', savedFilters: filters };
        } catch (e) { console.warn('Failed to parse saved preferences:', e); }
    }
    return { viewMode: 'card', savedFilters: null };
};

const CalendarView = ({ schedules, roles, roleAssignments, roleFullNames, allNames }) => {
    console.log('🔄 CalendarView render - schedules:', schedules?.length, 'roles:', roles?.length);
    
    // --- State Management ---
    const { viewMode: initialViewMode, savedFilters } = useMemo(() => {
        console.log('💾 Loading saved preferences...');
        return loadSavedPreferences();
    }, []); // Empty dependency array - only run once

    const [viewMode, setViewMode] = useState(initialViewMode);
    const [activeFilterRoles, setActiveFilterRoles] = useState({});
    const [tempFilterRoles, setTempFilterRoles] = useState({});
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [nameSearchInput, setNameSearchInput] = useState('');
    const [_selectedSearchNameData, setSelectedSearchNameData] = useState(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Modal State
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isDutiesSummaryModalOpen, setIsDutiesSummaryModalOpen] = useState(false);

    // --- Refs and Custom Hooks ---
    const swiperRef = useRef(null);
    const hasScrolledRef = useRef(false);
    
    // Use calendar data hook directly
    const { processedData, mergedEvents, findLinkedEvents, timeToMinutes, minutesToTime } = useCalendarData(schedules);
    console.log('📊 Processed data keys:', Object.keys(processedData || {}), 'Total events:', schedules?.length);
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

    // --- Initialization Effect ---
    useEffect(() => {
        if (roles.length > 0 && !filtersInitialized) {
            console.log('⚙️ Initializing filters for roles:', roles.length);
            const initialFilters = {};
            const baseRoles = roles.reduce((acc, role) => {
                acc[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
                return acc;
            }, {});

            if (savedFilters) {
                console.log('💾 Applying saved filters:', savedFilters.length);
                savedFilters.forEach(filter => { initialFilters[filter.value] = filter.checked; });
                Object.keys(baseRoles).forEach(roleKey => {
                    if (!(roleKey in initialFilters)) { initialFilters[roleKey] = true; }
                });
            } else {
                console.log('🆕 Using default filters');
                Object.assign(initialFilters, baseRoles);
            }
            setActiveFilterRoles(initialFilters);
            setFiltersInitialized(true);
        } else if (roles.length > 0 && filtersInitialized) {
            console.log('⏭️ Filters already initialized, skipping');
        }
    }, [roles, savedFilters, filtersInitialized]); // Removed activeFilterRoles dependency

    // --- UI Interaction Handlers ---
    const showRoleModal = useCallback((eventData) => {
        setSelectedEvent(eventData);
        setIsRoleModalOpen(true);
    }, []);

    const handleViewToggle = useCallback(() => {
        const newViewMode = viewMode === 'card' ? 'table' : 'card';
        setViewMode(newViewMode);
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({
            filters: Object.entries(activeFilterRoles).map(([value, checked]) => ({ value, checked })),
            isCardView: newViewMode === 'card'
        }));
    }, [viewMode, activeFilterRoles]);

    const applyFilters = useCallback(() => {
        setActiveFilterRoles(tempFilterRoles);
        setIsFilterModalOpen(false);
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({
            filters: Object.entries(tempFilterRoles).map(([value, checked]) => ({ value, checked })),
            isCardView: viewMode === 'card'
        }));
    }, [tempFilterRoles, viewMode]);

    const closeFilterModal = useCallback(() => {
        // Automatically apply filters when closing modal (like the backup)
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
    }, [roles]);

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
    }, [tempFilterRoles]);

    const goToDay = useCallback((day) => {
        const dayIndex = CONFIG.DAYS_ORDER.indexOf(day);
        if (dayIndex !== -1 && swiperRef.current) {
            swiperRef.current.slideTo(dayIndex);
        }
    }, []);

    // --- Core Navigation Callbacks ---
    const updateActiveDayButton = useCallback((currentDay) => {
        if (!currentDay) return;
        
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
                // Apply active styles with forced override
                currentDayButton.classList.remove('bg-white', 'text-gray-800', 'border-gray-300');
                currentDayButton.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
                
                // Force style application with direct CSS
                currentDayButton.style.cssText = 'background-color: #2563eb !important; color: white !important; border-color: #2563eb !important;';
                
                // Force immediate visual refresh
                const originalDisplay = currentDayButton.style.display;
                currentDayButton.style.display = 'none';
                currentDayButton.offsetHeight; // Force reflow
                currentDayButton.style.display = originalDisplay || '';
                
                // Additional forced reflow
                currentDayButton.offsetHeight;
            }
        });
    }, []);

    const updateCurrentTimeIndicator = useCallback(() => {
        const now = new Date();
        const today = now.toLocaleDateString('en-US', { weekday: 'long' });
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Remove existing indicators
        document.querySelectorAll('.current-time-indicator').forEach(el => el.remove());

        // Only show indicator if we're on today's slide
        const activeSlide = document.querySelector('.swiper-slide-active');
        if (activeSlide && activeSlide.dataset.day === today && viewMode === 'table') {
            const targetMinutes = Math.floor(currentMinutes / 5) * 5;
            const timeRow = activeSlide.querySelector(`tr[data-time-minutes="${targetMinutes}"]`);
            if (timeRow) {
                const indicator = document.createElement('div');
                indicator.className = 'current-time-indicator absolute left-0 right-0 h-0.5 bg-red-500 z-10 shadow-md pointer-events-none';
                
                // Calculate precise position within the 5-minute slot
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
    }, [viewMode]);

    const navigateToCurrentTime = useCallback(() => {
        console.log('⏰ navigateToCurrentTime called - hasScrolled:', hasScrolledRef.current);
        if (hasScrolledRef.current) return;
        
        const attemptScroll = () => {
            console.log('🔍 Attempting scroll...');
            const activeSlide = document.querySelector('.swiper-slide-active');
            console.log('📍 Active slide found:', !!activeSlide);
            if (!activeSlide) {
                console.log('⏳ No active slide, retrying in 100ms');
                // Retry after a short delay if slide not ready
                setTimeout(attemptScroll, 100);
                return;
            }

            hasScrolledRef.current = true;
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            console.log('🕐 Current time:', `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`, 'Minutes:', currentMinutes);
            console.log('👁️ Current view mode:', viewMode);

            // Use a longer delay to ensure DOM is fully rendered
            setTimeout(() => {
                // Find the visible container based on current view mode
                let container;
                if (viewMode === 'card') {
                    // Find the card view container - look for the h-full element that has 'flex' class and is not hidden
                    const cardViewDiv = activeSlide.querySelector('.h-full:not(.hidden)');
                    console.log('🔍 Card view debug:');
                    console.log('- cardViewDiv found:', !!cardViewDiv);
                    console.log('- cardViewDiv classes:', cardViewDiv?.className);
                    
                    // Check if this is actually the card view (should contain flex class)
                    if (cardViewDiv && cardViewDiv.className.includes('flex')) {
                        container = cardViewDiv.querySelector('.overflow-y-auto');
                        console.log('- Found flex container, overflow-y-auto child found:', !!container);
                    } else {
                        console.log('- cardViewDiv is not flex container, trying direct search');
                        // Try direct selection of overflow-y-auto in the slide
                        const allOverflowContainers = activeSlide.querySelectorAll('.overflow-y-auto');
                        console.log('- All overflow-y-auto containers found:', allOverflowContainers.length);
                        
                        // Look for the one that's not in a table (card view container)
                        for (const overflowContainer of allOverflowContainers) {
                            if (!overflowContainer.querySelector('table')) {
                                container = overflowContainer;
                                console.log('- Found non-table overflow container');
                                break;
                            }
                        }
                    }
                    console.log('- Final container found:', !!container);
                } else {
                    // Find the table view container (the visible one) 
                    const tableViewDiv = activeSlide.querySelector('.h-full.block:not(.hidden)');
                    container = tableViewDiv?.querySelector('.overflow-y-auto');
                }
                
                console.log('📦 Container found:', !!container, 'for view mode:', viewMode);
                if (!container) {
                    console.warn('❌ Scroll container not found for view mode:', viewMode);
                    console.log('🔍 Available containers in slide:', activeSlide.querySelectorAll('*').length, 'elements');
                    console.log('🔍 Available overflow-y-auto elements:', activeSlide.querySelectorAll('.overflow-y-auto').length);
                    console.log('🔍 Available h-full elements:', activeSlide.querySelectorAll('.h-full').length);
                    return;
                }

                if (viewMode === 'table') {
                    console.log('📊 Table view scrolling...');
                    // Find the closest time row (search for nearby times if exact match not found)
                    const targetMinutes = Math.floor(currentMinutes / 5) * 5;
                    let timeRow = container.querySelector(`tr[data-time-minutes="${targetMinutes}"]`);
                    console.log('🎯 Looking for time row:', targetMinutes, 'Found:', !!timeRow);
                    
                    // If exact time not found, look for the nearest earlier time
                    if (!timeRow) {
                        console.log('🔍 Exact time not found, searching for nearby times...');
                        for (let offset = 5; offset <= 60; offset += 5) {
                            timeRow = container.querySelector(`tr[data-time-minutes="${targetMinutes - offset}"]`);
                            if (timeRow) {
                                console.log('✅ Found nearby time row at offset:', offset);
                                break;
                            }
                        }
                    }
                    
                    if (timeRow) {
                        const headerHeight = container.querySelector('thead')?.offsetHeight || 50;
                        
                        // Calculate visible roles to determine scroll offset
                        const visibleRoles = roles.filter(role => 
                            role === 'Agenda' || activeFilterRoles[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] !== false
                        );
                        const densityFactor = Math.max(0.3, Math.min(1, visibleRoles.length / roles.length));
                        const dynamicOffset = Math.floor(80 * densityFactor); // Dynamic offset based on content density
                        
                        const scrollTop = Math.max(0, timeRow.offsetTop - headerHeight - dynamicOffset);
                        
                        // Add smooth scrolling behavior
                        container.style.scrollBehavior = 'smooth';
                        container.scrollTop = scrollTop;
                        
                        // Update time indicator after scrolling
                        setTimeout(() => {
                            updateCurrentTimeIndicator();
                        }, 300);
                        
                        console.log(`✅ Scrolled to time: ${Math.floor(targetMinutes/60)}:${(targetMinutes%60).toString().padStart(2,'0')} with ${visibleRoles.length} visible roles`);
                    } else {
                        console.warn('❌ No time row found for current time');
                        const allTimeRows = container.querySelectorAll('tr[data-time-minutes]');
                        console.log('📋 Available time rows:', Array.from(allTimeRows).map(row => row.getAttribute('data-time-minutes')));
                    }
                } else {
                    console.log('🎴 Card view scrolling...');
                    const dayEvents = processedData[activeSlide.dataset.day] || [];
                    console.log('📅 Day events for', activeSlide.dataset.day, ':', dayEvents.length);
                    
                    // Debug: Show all event types for this day
                    const eventTypes = [...new Set(dayEvents.map(e => e.eventType))];
                    console.log('🏷️ Event types found:', eventTypes);
                    
                    // Debug: Show sample events
                    console.log('📋 Sample events:', dayEvents.slice(0, 3).map(e => ({
                        name: e.eventName,
                        type: e.eventType,
                        startMins: e.startMins,
                        endMins: e.endMins,
                        startTime: e.startTime,
                        endTime: e.endTime
                    })));
                    
                    // Debug: Show all agenda events for this day
                    const agendaEvents = dayEvents.filter(e => e.eventType?.toLowerCase() === 'agenda');
                    console.log('📋 Agenda events:', agendaEvents.map(e => ({
                        name: e.eventName,
                        startMins: e.startMins,
                        endMins: e.endMins,
                        startTime: e.startTime,
                        endTime: e.endTime
                    })));
                    
                    const currentEvent = dayEvents.find(e => {
                        // Look for agenda events that contain the current time
                        if (e.eventType?.toLowerCase() !== 'agenda') return false;
                        return currentMinutes >= e.startMins && currentMinutes < e.endMins;
                    });
                    
                    console.log('🎯 Current event:', currentEvent?.eventName, 'Current minutes:', currentMinutes);
                    if (currentEvent) {
                        const targetSelector = `[data-event-time="${currentEvent.startMins}-${currentEvent.endMins}"]`;
                        console.log('🔍 Looking for element with selector:', targetSelector);
                        const targetCard = container.querySelector(targetSelector);
                        console.log('🎴 Target card found:', !!targetCard);
                        
                        // Debug: show all available data-event-time attributes
                        const allEventCards = container.querySelectorAll('[data-event-time]');
                        console.log('🎴 Available event cards:', Array.from(allEventCards).map(card => card.getAttribute('data-event-time')));
                        
                        // Debug: Let's also check what's actually in the container
                        console.log('🔍 Container HTML structure:');
                        console.log('- Container children count:', container.children.length);
                        console.log('- Container innerHTML preview:', container.innerHTML.substring(0, 500));
                        
                        if (targetCard) {
                            console.log(`🎯 Scrolling to event: ${currentEvent.eventName} - aligning to top of container`);
                            
                            // Use smooth scrolling
                            container.style.scrollBehavior = 'smooth';
                            
                            // Calculate the target scroll position to align card top with container top
                            const containerRect = container.getBoundingClientRect();
                            const targetRect = targetCard.getBoundingClientRect();
                            const containerScrollTop = container.scrollTop;
                            
                            // Position the top of the target card at the top of the container with small offset
                            const topOffset = 10; // Small padding from the top
                            const targetPosition = containerScrollTop + targetRect.top - containerRect.top - topOffset;
                            const finalScrollTop = Math.max(0, targetPosition);
                            
                            console.log(`📏 Scroll calculation: containerScrollTop=${containerScrollTop}, targetRect.top=${targetRect.top}, containerRect.top=${containerRect.top}, finalScrollTop=${finalScrollTop}`);
                            
                            // Perform the scroll
                            container.scrollTop = finalScrollTop;
                            
                            console.log(`✅ Scrolled to event: ${currentEvent.eventName} at position ${finalScrollTop}`);
                        } else if (allEventCards.length === 0) {
                            console.warn('❌ No event cards found at all! This indicates the DOM elements are not being rendered.');
                            console.log('🔍 Let\'s debug why cards aren\'t rendering...');
                            
                            // Check if we're looking in the right view
                            const cardView = activeSlide.querySelector('.h-full.flex');
                            const tableView = activeSlide.querySelector('.h-full.block');
                            console.log('📱 Card view element found:', !!cardView, 'visible:', cardView?.style.display !== 'none');
                            console.log('📊 Table view element found:', !!tableView, 'visible:', tableView?.style.display !== 'none');
                            
                            // Check if generateCardViewForDay is actually being rendered
                            console.log('🎴 Current view mode in state:', viewMode);
                            console.log('🎴 Active slide data-day:', activeSlide.dataset.day);
                        } else {
                            console.warn('❌ Target card not found, but some event cards exist. Scrolling to first card as fallback.');
                            const firstCard = allEventCards[0];
                            if (firstCard) {
                                firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                console.log('✅ Scrolled to first available card');
                            }
                        }
                    } else {
                        // If no current event, scroll to the next upcoming event
                        const upcomingEvent = dayEvents
                            .filter(e => e.eventType?.toLowerCase() === 'agenda' && e.startMins > currentMinutes)
                            .sort((a, b) => a.startMins - b.startMins)[0];
                        
                        console.log('⏭️ Upcoming event:', upcomingEvent?.eventName, 'at minutes:', upcomingEvent?.startMins);
                        if (upcomingEvent) {
                            const targetCard = container.querySelector(`[data-event-time="${upcomingEvent.startMins}-${upcomingEvent.endMins}"]`);
                            if (targetCard) {
                                console.log(`🎯 Scrolling to upcoming event: ${upcomingEvent.eventName} - aligning to top of container`);
                                
                                // Use smooth scrolling
                                container.style.scrollBehavior = 'smooth';
                                
                                // Calculate the target scroll position to align card top with container top
                                const containerRect = container.getBoundingClientRect();
                                const targetRect = targetCard.getBoundingClientRect();
                                const containerScrollTop = container.scrollTop;
                                
                                // Position the top of the target card at the top of the container with small offset
                                const topOffset = 10; // Small padding from the top
                                const targetPosition = containerScrollTop + targetRect.top - containerRect.top - topOffset;
                                const finalScrollTop = Math.max(0, targetPosition);
                                
                                container.scrollTop = finalScrollTop;
                                
                                console.log(`✅ Scrolled to upcoming event: ${upcomingEvent.eventName} at position ${finalScrollTop}`);
                            }
                        } else {
                            console.log('⚠️ No upcoming agenda events found - scrolling to first event card');
                            // Fallback: scroll to the first event card
                            const firstCard = container.querySelector('[data-event-time]');
                            if (firstCard) {
                                console.log('🎯 Scrolling to first event card as fallback - aligning to top');
                                
                                container.style.scrollBehavior = 'smooth';
                                
                                // Calculate scroll position to align first card with top of container
                                const containerRect = container.getBoundingClientRect();
                                const targetRect = firstCard.getBoundingClientRect();
                                const containerScrollTop = container.scrollTop;
                                
                                // Position at top of container with small offset
                                const topOffset = 10;
                                const targetPosition = containerScrollTop + targetRect.top - containerRect.top - topOffset;
                                const finalScrollTop = Math.max(0, targetPosition);
                                
                                container.scrollTop = finalScrollTop;
                                
                                console.log(`✅ Scrolled to first event card at position ${finalScrollTop}`);
                            }
                        }
                    }
                }
            }, 200); // Increased delay to ensure DOM is ready
        };

        attemptScroll();
    }, [viewMode, processedData, activeFilterRoles, roles, updateCurrentTimeIndicator]);
    
    // --- Swiper Initialization Effect ---
    useEffect(() => {
        console.log('🎢 Swiper useEffect triggered - processedData:', !!processedData, 'keys:', Object.keys(processedData || {}).length, 'hasSwiper:', !!swiperRef.current);
        
        if (!processedData || Object.keys(processedData).length === 0) {
            console.log('❌ Swiper init skipped - no processed data');
            return;
        }

        // Don't recreate if already exists and initialized
        if (swiperRef.current && swiperRef.current.initialized) {
            console.log('⏭️ Swiper already initialized, skipping recreation');
            return;
        }

        swiperRef.current?.destroy();
        
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const initialSlide = Math.max(0, CONFIG.DAYS_ORDER.indexOf(today));
        console.log('📅 Today is:', today, 'Initial slide:', initialSlide);

        // Use a single timeout to prevent multiple initializations
        const timeoutId = setTimeout(() => {
            // Double-check we still need to create swiper
            if (swiperRef.current && swiperRef.current.initialized) {
                console.log('🚫 Swiper already exists, cancelling creation');
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
                        console.log('🎢 Swiper init event fired');
                        const currentDay = swiper.slides[swiper.activeIndex]?.dataset.day;
                        console.log('📍 Current day from slide:', currentDay, 'Today:', today);
                        updateActiveDayButton(currentDay);
                        // Delay the scroll to current time to ensure content is rendered
                        if (currentDay === today && !hasScrolledRef.current) {
                            console.log('⏰ Scheduling scroll to current time in 300ms');
                            setTimeout(() => {
                                console.log('🚀 Attempting to navigate to current time');
                                navigateToCurrentTime();
                            }, 300);
                        } else {
                            console.log('⏭️ Skipping scroll - currentDay:', currentDay, 'today:', today, 'hasScrolled:', hasScrolledRef.current);
                        }
                    },
                    slideChangeTransitionEnd: (swiper) => {
                        const currentDay = swiper.slides[swiper.activeIndex]?.dataset.day;
                        updateActiveDayButton(currentDay);
                        // Update time indicator when changing slides
                        setTimeout(() => {
                            updateCurrentTimeIndicator();
                        }, 100);
                    },
                },
            });
        }, 50);

        return () => { 
            clearTimeout(timeoutId);
            swiperRef.current?.destroy(); 
        };
    }, [processedData, navigateToCurrentTime, updateActiveDayButton, updateCurrentTimeIndicator]);

    // Update time indicator periodically
    useEffect(() => {
        const interval = setInterval(() => {
            updateCurrentTimeIndicator();
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [updateCurrentTimeIndicator]);

    // --- Rendering Logic & Helpers ---
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

        // Add pairing logic from backup - show paired AC/CN roles even if they don't have assignments
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

        // Create event key to find the complete merged event with all assigned roles
        let eventKey = '';
        if (typeof activityData === 'object' && activityData.activity) {
            const eventName = activityData.activity.split(' - ')[1] || activityData.activity;
            eventKey = `${agendaEvent.weekday}-${activityData.startTime}-${activityData.endTime}-${eventName}-${activityData.eventType}`;
        } else {
            eventKey = `${agendaEvent.weekday}-${agendaEvent.startTime}-${agendaEvent.endTime}-${agendaEvent.eventName}-${agendaEvent.eventType}`;
        }

        // Find the complete event from processedData to get all assigned roles
        const completeEvent = typeof activityData === 'object' ? 
            processedData[agendaEvent.weekday]?.find(e => 
                e.startTime === activityData.startTime && 
                e.endTime === activityData.endTime && 
                e.assignedRoles.includes(role)
            ) : agendaEvent;
        
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
                    mergedEvent: completeEvent || agendaEvent // Pass the complete event with all roles
                })}
            >
                <div 
                    className="font-bold text-gray-800 hover:text-blue-600 transition-colors duration-200" 
                    dangerouslySetInnerHTML={{ __html: roleNameWithAssignments }}
                ></div>
                <div className={`text-sm ${colors.textColor}`}>{displayText}{timeIndicator}</div>
            </div>
        );
    }, [getActivityColor, formatRoleNameForCard, showRoleModal, processedData]);
    
    const generateCardViewForDay = useCallback((day) => {
        const dayEvents = processedData[day];
        if (!dayEvents?.length) {
            return <div className="p-4 text-center text-gray-600">No events for {day}.</div>;
        }

        const allAgendaEvents = dayEvents
            .filter(event => event.eventType?.toLowerCase() === 'agenda')
            .sort((a, b) => a.startMins - b.startMins);

        if (!allAgendaEvents.length) {
            return <div className="p-4 text-center text-gray-600">No agenda events for {day}.</div>;
        }
        
        return (
            <div className="p-1 flex flex-col gap-2 h-full overflow-y-auto w-full">
                {allAgendaEvents.map((agendaEvent, index) => {
                    const lowerEventName = agendaEvent.eventName.toLowerCase();
                    const isTravelEvent = lowerEventName.includes('travel') || lowerEventName.includes('transition') || lowerEventName.includes('move to') || lowerEventName.includes('roll call');

                    if (isTravelEvent) {
                        return (
                            <div key={index} 
                                 data-event-time={`${agendaEvent.startMins}-${agendaEvent.endMins}`}
                                 className="flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg p-2 shadow-sm transition-all duration-200 hover:translate-y-[-1px] hover:shadow-md text-sm">
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
                    }
                })}
            </div>
        );
    }, [processedData, getRoleActivitiesForAgendaEvent, generateRoleAssignmentHTML]);

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


    const memoizedSlides = useMemo(() => {
        console.log('🎬 Creating memoized slides - processedData:', !!processedData, 'roles:', roles.length, 'viewMode:', viewMode);
        if (!processedData || roles.length === 0) {
            console.log('❌ Skipping slide creation - no data');
            return null;
        }

        const slides = CONFIG.DAYS_ORDER.map((day) => (
            <div key={day} className="swiper-slide" data-day={day}>
                <div className={`h-full ${viewMode === 'table' ? 'block' : 'hidden'}`}>{renderCalendarForDay(day)}</div>
                <div className={`h-full ${viewMode === 'card' ? 'flex' : 'hidden'}`}>{generateCardViewForDay(day)}</div>
            </div>
        ));
        
        console.log('✅ Created', slides.length, 'slides for view mode:', viewMode);
        return slides;
    }, [processedData, roles.length, viewMode, renderCalendarForDay, generateCardViewForDay]); // Include required dependencies

    return (
        <>
            <Header
                roles={roles}
                allNames={allNames}
                viewMode={viewMode}
                nameSearchInput={nameSearchInput}
                setNameSearchInput={setNameSearchInput}
                onFilterModalOpen={handleFilterModalOpen}
                onViewToggle={handleViewToggle}
                onDutiesSummaryClick={() => setIsDutiesSummaryModalOpen(true)}
                onNameSelect={selectNameAndFilter}
                goToDay={goToDay}
            />
            <main className="flex-grow min-h-0 relative">
                {!memoizedSlides ? (
                    <div className="flex items-center justify-center h-full"><p className="text-gray-600 italic">Loading calendar...</p></div>
                ) : (
                    <div className="swiper h-full"><div className="swiper-wrapper">{memoizedSlides}</div></div>
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

export default memo(CalendarView);