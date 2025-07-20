import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
// Fixed Swiper CSS imports for Swiper v11
import 'swiper/css';
import 'swiper/css/navigation';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

// Import Firebase configuration
import { firebaseConfig as defaultFirebaseConfig, appId as defaultAppId, initialAuthToken as defaultInitialAuthToken } from './firebase-config.js';

// Global variables provided by the Canvas environment (fallback to local config)
const appId = typeof __app_id !== 'undefined' ? __app_id : defaultAppId;
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : defaultFirebaseConfig;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : defaultInitialAuthToken;

// Load Tailwind CSS CDN
const loadTailwind = () => {
  const script = document.createElement('script');
  script.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(script);
};

loadTailwind();

const CONFIG = {
    DAYS_ORDER: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    LOCAL_STORAGE_KEY: 'duties-calendar-preferences',
};

const App = () => {
    const [schedules, setSchedules] = useState([]);
    const [roleAssignments, setRoleAssignments] = useState({});
    const [roleFullNames, setRoleFullNames] = useState({});
    const [allNames, setAllNames] = useState([]);
    const [roles, setRoles] = useState([]);
    const [processedData, setProcessedData] = useState({});
    const [mergedEvents, setMergedEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);

    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [tempFilterRoles, setTempFilterRoles] = useState({});
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isDutiesSummaryModalOpen, setIsDutiesSummaryModalOpen] = useState(false);

    const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
    const [activeFilterRoles, setActiveFilterRoles] = useState({}); // { 'ac-1': true, 'agenda': false }

    const swiperRef = useRef(null);
    const calendarContainerRef = useRef(null);

    const [nameSearchInput, setNameSearchInput] = useState('');
    const [nameSearchDropdownActive, setNameSearchDropdownActive] = useState(false);
    const [selectedSearchNameData, setSelectedSearchNameData] = useState(null); // Changed to useState

    // --- Firebase Initialization and Data Fetching ---
    useEffect(() => {
        // Check if Firebase config is valid
        if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
            setError("Firebase configuration is missing or invalid. Please check your firebase-config.js file.");
            setLoading(false);
            return;
        }
        
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // Sign in anonymously if no token is provided or user is not signed in
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    } catch (authError) {
                        setError("Authentication failed. Please check console for details.");
                    }
                }
                setIsAuthReady(true); // Auth state is now known
            });

            return () => {
                unsubscribeAuth();
            };
        } catch (e) {
            setError("Failed to initialize Firebase. Check your configuration and console for details.");
            setLoading(false);
        }
    }, []);

    // Fetch schedules and role assignments once authenticated
    useEffect(() => {
        if (!db || !isAuthReady) return;

        setLoading(true);
        setError(null);

        const agendaEventsCollectionRef = collection(db, `/artifacts/${appId}/public/data/agendaEvents`);
        const roleEventsCollectionRef = collection(db, `/artifacts/${appId}/public/data/roleEvents`);
        const roleAssignmentsCollectionRef = collection(db, `/artifacts/${appId}/public/data/roleAssignments`);

        let agendaEvents = [];
        let roleEvents = [];
        let loadedCollections = 0;
        const totalCollections = 3;

        const checkAllLoaded = () => {
            loadedCollections++;
            if (loadedCollections === totalCollections) {
                // Combine agenda and role events
                const allEvents = [...agendaEvents, ...roleEvents];
                setSchedules(allEvents);
                setLoading(false);
            }
        };

        const unsubscribeAgendaEvents = onSnapshot(agendaEventsCollectionRef, (snapshot) => {
            agendaEvents = snapshot.docs.map(doc => doc.data());
            checkAllLoaded();
        }, (err) => {
            setError("Failed to load agenda events.");
            setLoading(false);
        });

        const unsubscribeRoleEvents = onSnapshot(roleEventsCollectionRef, (snapshot) => {
            roleEvents = snapshot.docs.map(doc => doc.data());
            checkAllLoaded();
        }, (err) => {
            setError("Failed to load role events.");
            setLoading(false);
        });

        const unsubscribeRoleAssignments = onSnapshot(roleAssignmentsCollectionRef, (snapshot) => {
            const fetchedRoleAssignments = {};
            const fetchedRoleFullNames = {};
            const fetchedAllNames = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const role = data.role;
                const names = data.names || []; // Ensure names is an array

                if (role && names.length > 0) {
                    // Process names to handle the AC/CN prefix properly
                    const processedNames = names.map(name => {
                        // If the name already contains the role prefix (AC/CN), remove it
                        if (role.startsWith('AC ') && name.startsWith('AC ')) {
                            return name.replace('AC ', '');
                        } else if (role.startsWith('CN ') && name.startsWith('CN ')) {
                            return name.replace('CN ', '');
                        }
                        // If no prefix, return as-is
                        return name;
                    });

                    fetchedRoleFullNames[role] = processedNames; // Store processed full names

                    const displayNames = processedNames.map(name => {
                        return name.split(' ')[0]; // Just get first name for display
                    });
                    fetchedRoleAssignments[role] = displayNames; // Store display names

                    processedNames.forEach(fullName => {
                        const displayName = fullName.split(' ')[0];
                        fetchedAllNames.push({
                            role: role,
                            displayName: displayName,
                            fullName: fullName,
                            searchText: `${displayName} ${fullName}`.toLowerCase()
                        });
                    });
                }
            });
            
            setRoleAssignments(fetchedRoleAssignments);
            setRoleFullNames(fetchedRoleFullNames);
            setAllNames(fetchedAllNames);
            checkAllLoaded();
        }, (err) => {
            setError("Failed to load role assignment data.");
            setLoading(false);
        });

        return () => {
            unsubscribeAgendaEvents();
            unsubscribeRoleEvents();
            unsubscribeRoleAssignments();
        };
    }, [db, isAuthReady]); // Re-run when db or auth state changes

    // --- Data Preprocessing and Calendar Generation ---
    const timeToMinutes = useCallback((timeStr) => {
        if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
        const [time, period] = timeStr.split(' ');
        if (!time || !period) return null;
        let [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        if (period.toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (period.toLowerCase() === 'am' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }, []);

    const minutesToTime = useCallback((minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const period = h >= 12 && h < 24 ? 'PM' : 'AM';
        return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    }, []);

    const createMobileAbbreviation = useCallback((roleName) => {
        if (roleName === 'Agenda') return 'AG';
        const acMatch = roleName.match(/^AC (\d+)$/);
        if (acMatch) return acMatch[1];
        const cnMatch = roleName.match(/^CN ([A-Z])$/);
        if (cnMatch) return cnMatch[1];
        return roleName;
    }, []);

    const formatRoleNameWithAssignments = useCallback((roleName) => {
        const assignments = roleAssignments[roleName];
        if (assignments && assignments.length > 0) {
            const namesList = assignments.join(', ');
            return `${roleName} <span class="text-sm opacity-80">(${namesList})</span>`;
        }
        return roleName;
    }, [roleAssignments]);

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

    const getEventPriority = useCallback((eventType) => {
        const priorities = {
            'duty': 1,
            'break': 2,
            'free': 3
        };
        return priorities[eventType.toLowerCase()] || 1;
    }, []);

    const shouldReplaceActivity = useCallback((currentActivity, newActivity) => {
        if (currentActivity === null || currentActivity === 'No Duty') {
            return true;
        }

        if (typeof currentActivity === 'string') {
            return true;
        }

        if (typeof currentActivity === 'object' && typeof newActivity === 'object') {
            if (newActivity.priority < currentActivity.priority) {
                return true;
            } else if (newActivity.priority === currentActivity.priority) {
                if (newActivity.isOverlapping && !currentActivity.isOverlapping) {
                    return true;
                } else if (newActivity.isOverlapping === currentActivity.isOverlapping) {
                    const currentDuration = timeToMinutes(currentActivity.endTime) - timeToMinutes(currentActivity.startTime);
                    const newDuration = timeToMinutes(newActivity.endTime) - timeToMinutes(newActivity.startTime);
                    if (newDuration > currentDuration) {
                        return true;
                    } else if (newDuration === currentDuration) {
                        const currentStart = timeToMinutes(currentActivity.startTime);
                        const newStart = timeToMinutes(newActivity.startTime);
                        return newStart < currentStart;
                    }
                }
            }
        }
        return false;
    }, [timeToMinutes]);

    const createMergedEvents = useCallback((rawData) => {
        // Firebase events already have the correct structure, just ensure consistency
        return rawData.map(event => ({
            weekday: event.weekday,
            startTime: event.startTime,
            endTime: event.endTime || '', // Handle empty endTime
            eventName: event.eventName,
            eventAbbreviation: event.eventAbbreviation,
            eventType: event.eventType,
            eventDescription: event.eventDescription,
            assignedRoles: event.assignedRoles || (event.role ? [event.role] : [])
        }));
    }, []);

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

            const overlap = Math.max(0, Math.min(currentEndMins, eventEndMins) - Math.max(currentStartMins, eventStartMins));
            const timeDiff = Math.abs(currentStartMins - eventStartMins);

            if (overlap > 0) return true;
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

        // Specific event linking (within same event type and weekday)
        const specificLinkPatterns = [
            { name: 'Check-in', subpatterns: ['Coordinator', 'Setup', 'Set Up', 'Check-in 1', 'Check-in 2', 'Check-In 1', 'Check-In 2', 'Check In 1', 'Check In 2', 'Participant Check-in 1', 'Participant Check-in 2'] },
            { name: 'Dance', subpatterns: ['Coordinator', 'DJ', 'Accommodations', 'Support'] },
            { name: 'Games Night', subpatterns: ['Coordinator', 'Accommodations', 'Support'] },
            { name: 'Pizza Night', subpatterns: ['Coordinator', 'Support'] },
            { name: 'Class', subpatterns: ['Coordinator', 'Support', 'Meeting'], checkFn: timeProximityCheck }
        ];

        specificLinkPatterns.forEach(pattern => {
            if (currentEventName.includes(pattern.name)) {
                filterAndAddEvents(pattern.subpatterns, currentEventType.toLowerCase(), (event, currentStartMins, currentEndMins) => {
                    if (!event.eventName.includes(pattern.name)) return false;
                    if (pattern.checkFn) return pattern.checkFn(event, currentStartMins, currentEndMins);
                    return true;
                });
            }
        });

        // General Coordinator/Support patterns
        const generalPatterns = [{ coordinator: 'Coordinator', support: 'Support' }, { coordinator: 'Lead', support: 'Support' }, { coordinator: 'Lead', support: 'Assist' }];
        for (const pattern of generalPatterns) {
            const isCoordinator = currentEventName.includes(pattern.coordinator);
            const isSupport = currentEventName.includes(pattern.support);
            if (isCoordinator || isSupport) {
                const isSpecificPatternHandled = specificLinkPatterns.some(p => currentEventName.includes(p.name));
                if (isSpecificPatternHandled) continue;

                const baseEventName = currentEventName.replace(pattern.coordinator, '').replace(pattern.support, '').trim();
                filterAndAddEvents([baseEventName], currentEventType.toLowerCase(), (event) => {
                    const eventBaseName = event.eventName.replace(pattern.coordinator, '').replace(pattern.support, '').trim();
                    return eventBaseName === baseEventName && (event.eventName.includes(pattern.coordinator) || event.eventName.includes(pattern.support));
                });
            }
        }

        const uniqueLinkedEvents = linkedEvents.filter((event, index, self) =>
            index === self.findIndex(e => e.eventName === event.eventName && e.weekday === event.weekday)
        );

        return uniqueLinkedEvents;
    }, [mergedEvents, timeToMinutes]);


    useEffect(() => {
        if (schedules.length > 0) {
            const newMergedEvents = createMergedEvents(schedules);
            setMergedEvents(newMergedEvents);

            const allRolesSet = new Set();
            const newProcessedData = {};
            CONFIG.DAYS_ORDER.forEach(day => newProcessedData[day] = []);

            newMergedEvents.forEach(event => {
                event.assignedRoles.forEach(role => allRolesSet.add(role));
                const startMins = timeToMinutes(event.startTime);
                const endMins = timeToMinutes(event.endTime);
                if (event.weekday && newProcessedData[event.weekday] && startMins !== null) {
                    newProcessedData[event.weekday].push({
                        ...event,
                        startMins,
                        endMins: endMins === null ? startMins + 15 : endMins,
                    });
                }
            });

            const sortedRoles = [...allRolesSet].sort((a, b) => {
                if (a === 'Agenda') return -1;
                if (b === 'Agenda') return 1;
                return a.localeCompare(b, undefined, { numeric: true });
            });
            setRoles(sortedRoles);
            setProcessedData(newProcessedData);

            // Initialize activeFilterRoles based on all roles
            const initialFilters = sortedRoles.reduce((acc, role) => {
                acc[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
                return acc;
            }, {});
            setActiveFilterRoles(initialFilters);

            // Load preferences after initial data load
            const savedPreferences = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
            if (savedPreferences) {
                const { filters, isCardView } = JSON.parse(savedPreferences);
                if (filters) {
                    const loadedFilters = {};
                    filters.forEach(filter => {
                        loadedFilters[filter.value] = filter.checked;
                    });
                    setActiveFilterRoles(loadedFilters);
                }
                setViewMode(isCardView ? 'card' : 'table');
            }
        }
    }, [schedules, createMergedEvents, timeToMinutes]);

    // --- Swiper Initialization and Lifecycle ---
    useEffect(() => {
        if (roles.length > 0 && Object.keys(processedData).length > 0) {
            if (swiperRef.current) {
                swiperRef.current.destroy(true, true);
            }

            const swiperInstance = new Swiper('.swiper', {
                modules: [Navigation],
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                keyboard: {
                    enabled: true,
                },
                on: {
                    slideChange: function () {
                        const currentDay = this.slides[this.activeIndex]?.dataset.day;
                        if (currentDay) {
                            updateActiveDayButton(currentDay);
                        }
                    },
                    slideChangeTransitionEnd: function () {
                        const currentDay = this.slides[this.activeIndex]?.dataset.day;
                        if (currentDay) {
                            updateActiveDayButton(currentDay);
                            updateCurrentTimeIndicator(this);
                        }
                    },
                    transitionStart: function () {
                        const currentDay = this.slides[this.activeIndex]?.dataset.day;
                        if (currentDay) {
                            updateActiveDayButton(currentDay);
                        }
                    },
                },
            });
            swiperRef.current = swiperInstance;

            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const todayIndex = CONFIG.DAYS_ORDER.indexOf(today);
            if (todayIndex !== -1) {
                swiperInstance.slideTo(todayIndex, 0);
            }
            if (swiperInstance.slides.length > 0) {
                swiperInstance.emit('slideChangeTransitionEnd');
            }

            const intervalId = setInterval(() => updateCurrentTimeIndicator(swiperInstance), 60000);

            return () => {
                clearInterval(intervalId);
                if (swiperRef.current) {
                    swiperRef.current.destroy(true, true);
                    swiperRef.current = null;
                }
            };
        }
    }, [roles, processedData]); // Re-initialize swiper when roles or processedData changes

    // --- UI Update Functions ---
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

    const updateCurrentTimeIndicator = useCallback((swiperInstance) => {
        const now = new Date();
        const today = now.toLocaleDateString('en-US', { weekday: 'long' });
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        document.querySelectorAll('.current-time-indicator').forEach(el => el.remove());

        const activeSlide = swiperInstance.slides[swiperInstance.activeIndex];
        if (activeSlide && activeSlide.dataset.day === today) {
            const timeRow = activeSlide.querySelector(`tr[data-time-minutes="${currentMinutes - (currentMinutes % 5)}"]`);
            if (timeRow) {
                const indicator = document.createElement('div');
                indicator.className = 'current-time-indicator absolute left-0 right-0 h-0.5 bg-red-500 z-10 shadow-md pointer-events-none';
                indicator.style.top = `${(now.getMinutes() % 5) * (timeRow.offsetHeight / 5)}px`; // Adjust based on height of 5-min slot

                const timeCell = timeRow.querySelector('.time-col');
                if (timeCell) {
                    timeCell.style.position = 'relative';
                    timeCell.appendChild(indicator);
                }
            }
        }
    }, []);

    const updateColumnAbbreviations = useCallback(() => {
        document.querySelectorAll('.calendar').forEach(calendar => {
            const headerCols = Array.from(calendar.querySelectorAll('th.role-col[data-role]'));
            const visibleNonAgendaCols = headerCols.filter(col => {
                const isVisible = activeFilterRoles[col.dataset.role] !== false; // Check activeFilterRoles state
                const role = col.querySelector('.full-text')?.textContent;
                return isVisible && role !== 'Agenda';
            });

            if (visibleNonAgendaCols.length > 7) {
                calendar.classList.add('many-columns');
            } else {
                calendar.classList.remove('many-columns');
            }
        });
    }, [activeFilterRoles]);

    useEffect(() => {
        updateColumnAbbreviations();
    }, [activeFilterRoles, updateColumnAbbreviations]);

    // --- Name Search Logic (moved earlier for dependencies) ---
    const clearNameSearch = useCallback(() => {
        setNameSearchInput('');
        setNameSearchDropdownActive(false);
        setSelectedSearchNameData(null);

        // Reset all role filters to show all columns
        const resetFilters = {};
        roles.forEach(role => {
            resetFilters[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
        });
        setActiveFilterRoles(resetFilters);
    }, [roles]);

    // --- Filter Logic ---
    const handleFilterChange = useCallback((roleClass, isChecked) => {
        setTempFilterRoles(prev => ({ ...prev, [roleClass]: isChecked }));
    }, []);

    const applyFilters = useCallback(() => {
        setActiveFilterRoles(tempFilterRoles);
        // If name search is active, clear it when manual filter changes
        if (selectedSearchNameData) {
            clearNameSearch();
        }
        // Save preferences immediately on filter change
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({ filters: Object.entries(tempFilterRoles).map(([value, checked]) => ({ value, checked })), isCardView: viewMode === 'card' }));
    }, [tempFilterRoles, selectedSearchNameData, viewMode, clearNameSearch]);

    const handleFilterModalOpen = useCallback(() => {
        // Initialize temp filters with current active filters when opening modal
        setTempFilterRoles({...activeFilterRoles});
        setIsFilterModalOpen(true);
    }, [activeFilterRoles]);

    const handleFilterModalClose = useCallback(() => {
        // Apply the temporary filters when closing modal
        applyFilters();
        setIsFilterModalOpen(false);
    }, [applyFilters]);

    const handleFilterModalCancel = useCallback(() => {
        // Close modal without applying changes
        setIsFilterModalOpen(false);
    }, []);


    const handleFilterControl = useCallback((action) => {
        const newFilters = {};
        roles.forEach(role => {
            const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            // Always keep Agenda visible, regardless of action
            if (roleClass === 'agenda') {
                newFilters[roleClass] = true;
            } else {
                newFilters[roleClass] = action === 'select-all';
            }
        });
        setTempFilterRoles(newFilters);
    }, [roles]);

    // --- View Toggle Logic ---
    const handleViewToggle = useCallback(() => {
        const newViewMode = viewMode === 'card' ? 'table' : 'card';
        setViewMode(newViewMode);
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({ filters: Object.entries(activeFilterRoles).map(([value, checked]) => ({ value, checked })), isCardView: newViewMode === 'card' }));
    }, [viewMode, activeFilterRoles]);

    // --- Modals Logic ---
    const showRoleModal = useCallback((eventData) => {
        setSelectedEvent(eventData);
        setIsRoleModalOpen(true);
    }, []);

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

    // --- Name Search Logic ---
    // Memoize filtered search names to avoid recalculating on every render
    const filteredSearchNames = useMemo(() => {
        if (nameSearchInput.length === 0) return [];
        return allNames.filter(nameData =>
            nameData.searchText.includes(nameSearchInput.toLowerCase())
        );
    }, [allNames, nameSearchInput]);

    const handleNameSearchChange = useCallback((e) => {
        const searchTerm = e.target.value;
        setNameSearchInput(searchTerm);
        if (searchTerm.length > 0) {
            setNameSearchDropdownActive(true);
        } else {
            setNameSearchDropdownActive(false);
            clearNameSearch(); // Clear search and reset filters when input is empty
        }
    }, [clearNameSearch]);

    const selectName = useCallback((nameData) => {
        setSelectedSearchNameData(nameData);
        setNameSearchInput(`${nameData.role} - ${nameData.fullName}`);
        setNameSearchDropdownActive(false);

        // Filter to show only the selected person's role and its adjacent role + Agenda
        // Initialize all roles to false first
        const newActiveFilters = {};
        roles.forEach(role => {
            const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            newActiveFilters[roleClass] = false;
        });
        
        // Then set only the selected roles to true
        const selectedRoleClass = nameData.role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        newActiveFilters[selectedRoleClass] = true;

        const adjacentRole = getAdjacentRole(nameData.role);
        if (adjacentRole && roles.includes(adjacentRole)) {
            newActiveFilters[adjacentRole.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
        }
        newActiveFilters['agenda'] = true; // Always include Agenda
        
        setActiveFilterRoles(newActiveFilters);
    }, [allNames, roles, getAdjacentRole]);

    // Function to activate name search from modal name clicks
    const activateNameSearch = useCallback((fullName) => {
        const nameData = allNames.find(n => n.fullName === fullName);
        if (!nameData) return;

        setIsRoleModalOpen(false); // Close the current modal

        // Use setTimeout to ensure the modal closes before proceeding
        setTimeout(() => {
            selectName(nameData);
        }, 100);
    }, [allNames, selectName]);


    // --- Render Functions (mimicking components) ---
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
                const isRoleVisible = activeFilterRoles[roleClass] !== false; // Check filter state

                if (eventAtTime?.isStart) {
                    const rowspan = Math.max(1, Math.floor(eventAtTime.duration / 5));
                    const eventKey = `${eventAtTime.weekday}-${eventAtTime.startTime}-${eventAtTime.endTime}-${eventAtTime.eventName}-${eventAtTime.eventType}`;
                    const colors = getActivityColor(eventAtTime);
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
                                    <span className="event-full hidden md:block"><strong>{eventAtTime.eventAbbreviation}</strong> - {eventAtTime.eventName}</span>
                                    <span className="event-abbr-only block md:hidden text-xs"><strong>{eventAtTime.eventAbbreviation}</strong></span>
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

        const manyColumnsClass = roles.filter(role => activeFilterRoles[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] !== false && role !== 'Agenda').length > 7 ? 'many-columns' : '';

        return (
            <div className="overflow-y-auto overflow-x-hidden h-full">
                <table className={`w-full border-collapse table-fixed ${manyColumnsClass}`}>
                    <thead>
                        <tr>
                            <th className="time-col sticky left-0 top-0 bg-gray-200 p-1 font-bold border-b-2 border-gray-300 border-r border-gray-400 z-50 text-xs text-center" style={{width: '70px'}}>Time</th>
                            {roles.map(r => {
                                const roleClass = r.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                                const mobileAbbr = createMobileAbbreviation(r);
                                const isRoleVisible = activeFilterRoles[roleClass] !== false;
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
    }, [processedData, roles, timeToMinutes, minutesToTime, createMobileAbbreviation, getActivityColor, showRoleModal, mergedEvents, activeFilterRoles]);

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

        // Handle role title click for name search
        const handleRoleTitleClick = (e) => {
            e.stopPropagation(); // Prevent triggering the modal
            const assignments = roleAssignments[role];
            if (assignments && assignments.length > 0) {
                // Find the first person assigned to this role
                const nameData = allNames.find(n => n.role === role);
                if (nameData) {
                    selectName(nameData);
                }
            }
        };

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
                    className="font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors duration-200" 
                    dangerouslySetInnerHTML={{ __html: roleNameWithAssignments }}
                    onClick={handleRoleTitleClick}
                ></div>
                <div className={`text-sm ${colors.textColor}`}>{displayText}{timeIndicator}</div>
            </div>
        );
    }, [getActivityColor, formatRoleNameForCard, showRoleModal, processedData, mergedEvents, roleAssignments, allNames, selectName]);

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
                    if (roleActivities.hasOwnProperty(role)) {
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
                if (roles.includes(pairedCnRole) && rolesWithAssignments.has(pairedCnRole) && !roleActivities.hasOwnProperty(pairedCnRole)) {
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
                if (roles.includes(pairedAcRole) && rolesWithAssignments.has(pairedAcRole) && !roleActivities.hasOwnProperty(pairedAcRole)) {
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
    }, [processedData, getRoleActivitiesForAgendaEvent, generateRoleAssignmentHTML, roles, activeFilterRoles]);


    const populateFilters = useCallback(() => {
        const allRoles = roles.filter(role => role !== 'Agenda');
        const acRoles = allRoles.filter(role => role.startsWith('AC '));
        const cnRoles = allRoles.filter(role => role.startsWith('CN '));
        const otherRoles = allRoles.filter(role => !role.startsWith('AC ') && !role.startsWith('CN '));

        acRoles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        cnRoles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        const acRoleMap = new Map();
        const cnRoleMap = new Map();

        acRoles.forEach(role => {
            const match = role.match(/^AC (\d+)$/);
            if (match) acRoleMap.set(parseInt(match[1]), role);
        });

        cnRoles.forEach(role => {
            const match = role.match(/^CN ([A-Z])$/);
            if (match) {
                const letterNumber = match[1].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
                cnRoleMap.set(letterNumber, role);
            }
        });

        let roleOptions = [];
        const maxAcNumber = Math.max(...[...acRoleMap.keys(), ...cnRoleMap.keys()], 0);

        // Group roles into pairs for better layout
        const pairedRoles = [];
        for (let acNumber = 1; acNumber <= maxAcNumber; acNumber++) {
            const acRole = acRoleMap.get(acNumber);
            const cnRole = cnRoleMap.get(acNumber);
            
            const pairElements = [];
            
            if (acRole) {
                const roleClass = acRole.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const assignments = roleAssignments[acRole];
                const displayName = assignments && assignments.length > 0 ? `${acRole} (${assignments[0]})` : acRole;
                pairElements.push(
                    <div key={roleClass} className="w-1/2 px-1">
                        <input
                            type="checkbox"
                            id={`dd-role-${roleClass}`}
                            value={roleClass}
                            checked={tempFilterRoles[roleClass] !== false}
                            onChange={(e) => handleFilterChange(roleClass, e.target.checked)}
                            className="hidden"
                        />
                        <label
                            htmlFor={`dd-role-${roleClass}`}
                            className={`block p-2 rounded-md bg-gray-100 text-gray-800 cursor-pointer transition-all duration-200 border border-gray-300 select-none text-center text-sm w-full box-border ${tempFilterRoles[roleClass] !== false ? 'bg-green-600 text-white border-green-600' : ''}`}
                        >
                            {displayName}
                        </label>
                    </div>
                );
            } else {
                pairElements.push(<div key={`empty-ac-${acNumber}`} className="w-1/2 px-1"></div>);
            }
            
            if (cnRole) {
                const roleClass = cnRole.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                // CN roles don't show names in parentheses - only display the role name
                pairElements.push(
                    <div key={roleClass} className="w-1/2 px-1">
                        <input
                            type="checkbox"
                            id={`dd-role-${roleClass}`}
                            value={roleClass}
                            checked={tempFilterRoles[roleClass] !== false}
                            onChange={(e) => handleFilterChange(roleClass, e.target.checked)}
                            className="hidden"
                        />
                        <label
                            htmlFor={`dd-role-${roleClass}`}
                            className={`block p-2 rounded-md bg-gray-100 text-gray-800 cursor-pointer transition-all duration-200 border border-gray-300 select-none text-center text-sm w-full box-border ${tempFilterRoles[roleClass] !== false ? 'bg-blue-600 text-white border-blue-600' : ''}`}
                        >
                            {cnRole}
                        </label>
                    </div>
                );
            } else {
                pairElements.push(<div key={`empty-cn-${acNumber}`} className="w-1/2 px-1"></div>);
            }
            
            if (pairElements.length > 0) {
                pairedRoles.push(
                    <div key={`pair-${acNumber}`} className="flex w-full mb-2">
                        {pairElements}
                    </div>
                );
            }
        }

        // Handle other roles (Agenda, etc.)
        const otherRoleElements = [];
        otherRoles.forEach(role => {
            const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            const assignments = roleAssignments[role];
            const displayName = assignments && assignments.length > 0 ? `${role} (${assignments[0]})` : role;
            otherRoleElements.push(
                <div key={roleClass} className="w-full mb-2">
                    <input
                        type="checkbox"
                        id={`dd-role-${roleClass}`}
                        value={roleClass}
                        checked={tempFilterRoles[roleClass] !== false}
                        onChange={(e) => handleFilterChange(roleClass, e.target.checked)}
                        className="hidden"
                    />
                    <label
                        htmlFor={`dd-role-${roleClass}`}
                        className={`block p-2 rounded-md bg-gray-100 text-gray-800 cursor-pointer transition-all duration-200 border border-gray-300 select-none text-center text-sm w-full box-border ${tempFilterRoles[roleClass] !== false ? 'bg-purple-600 text-white border-purple-600' : ''}`}
                    >
                        {displayName}
                    </label>
                </div>
            );
        });

        return (
            <>
                <div className="flex gap-2 mb-4 justify-center">
                    <button onClick={() => handleFilterControl('select-all')} className="px-3 py-1 border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 whitespace-nowrap">Select All</button>
                    <button onClick={() => handleFilterControl('deselect-all')} className="px-3 py-1 border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 whitespace-nowrap">Deselect All</button>
                </div>
                <div className="w-full">
                    {pairedRoles}
                    {otherRoleElements}
                </div>
            </>
        );
    }, [roles, roleAssignments, tempFilterRoles, handleFilterChange, handleFilterControl]);


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


    
    // Determine which dutiesData to use based on number of AC roles (memoized)
    const acRolesCount = useMemo(() => roles.filter(role => role.startsWith('AC ')).length, [roles]);
    const dutiesData = useMemo(() => {
        return acRolesCount === 10 ? dutiesData10 : (acRolesCount === 8 ? dutiesData8 : {});
    }, [acRolesCount, dutiesData10, dutiesData8]);

    // Memoize day navigation buttons for better performance
    const dayButtons = useMemo(() => CONFIG.DAYS_ORDER.map(day => (
        <button
            key={day}
            data-day={day}
            onClick={() => swiperRef.current?.slideTo(CONFIG.DAYS_ORDER.indexOf(day))}
            className="quick-nav-btn flex-grow px-2 py-2 border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 text-sm text-center whitespace-nowrap hover:bg-blue-600 hover:text-white hover:border-blue-600"
        >
            {day.substring(0, 3)}
        </button>
    )), []);

    // Memoize swiper slides for better performance
    const swiperSlides = useMemo(() => CONFIG.DAYS_ORDER.map(day => (
        <div key={day} className="swiper-slide" data-day={day}>
            <div className={`h-full ${viewMode === 'table' ? 'block' : 'hidden'}`}>
                {renderCalendarForDay(day)}
            </div>
            <div className={`h-full ${viewMode === 'card' ? 'flex' : 'hidden'}`}>
                {generateCardViewForDay(day)}
            </div>
        </div>
    )), [viewMode, renderCalendarForDay, generateCardViewForDay]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 text-gray-700">
                <p>Loading calendar data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-red-100 text-red-800 p-4 rounded-md">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div id="calendar-container" className="fixed inset-0 w-screen h-screen box-border flex flex-col font-sans text-gray-800 bg-gray-100">
            <header className="sticky top-0 z-50 bg-gray-100 border-b border-gray-300 px-3 pt-2 pb-1 shadow-sm">
                <section className="mb-2">
                    <div className="relative w-full max-w-xl mx-auto">
                        <input
                            type="text"
                            id="name-search-input"
                            className="w-full p-2 text-sm border-2 border-gray-300 bg-white rounded-lg outline-none transition-all duration-200 focus:border-blue-600 focus:shadow-outline-blue cursor-pointer"
                            placeholder="Search names..."
                            autoComplete="off"
                            value={nameSearchInput}
                            onChange={handleNameSearchChange}
                            onClick={() => {
                                if (nameSearchInput) {
                                    clearNameSearch();
                                }
                            }}
                            onFocus={() => nameSearchInput.length > 0 && setNameSearchDropdownActive(true)}
                            onBlur={() => setTimeout(() => setNameSearchDropdownActive(false), 200)}
                        />
                        {nameSearchDropdownActive && filteredSearchNames.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 border-t-0 rounded-b-md shadow-md max-h-52 overflow-y-auto z-50">
                                {filteredSearchNames.map((nameData, index) => (
                                    <div
                                        key={index}
                                        className="p-2 cursor-pointer border-b border-gray-100 transition-colors duration-200 hover:bg-gray-100 text-sm last:border-b-0"
                                        onMouseDown={() => selectName(nameData)} // Use onMouseDown to prevent blur from closing dropdown
                                    >
                                        <span className="font-bold text-gray-800">{nameData.role}</span>
                                        <span className="text-gray-600 ml-2 text-xs">{nameData.fullName}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="flex justify-center gap-2 mb-1 items-center flex-wrap">
                    <div className="flex-1 min-w-0 flex justify-center">
                        <button onClick={() => setIsDutiesSummaryModalOpen(true)} className="px-3 py-1 text-sm border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-xs hover:bg-blue-600 hover:text-white hover:border-blue-600">
                            Summary
                        </button>
                    </div>
                    <div className="flex-1 min-w-0 flex justify-center">
                        <button onClick={handleFilterModalOpen} className="px-3 py-1 text-sm border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-xs hover:bg-blue-600 hover:text-white hover:border-blue-600">
                            Filter Roles
                        </button>
                    </div>
                    <div className="flex-1 min-w-0 flex justify-center">
                        <button onClick={handleViewToggle} className="px-3 py-1 text-sm border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-xs hover:bg-gray-200 hover:text-gray-800 hover:border-gray-300">
                            {viewMode === 'card' ? 'Table View' : 'Card View'}
                        </button>
                    </div>
                </section>

                <section className="flex justify-center items-center flex-wrap gap-x-4 gap-y-1 mb-2">
                    <div className="flex items-center text-xs text-gray-700"><span className="w-3 h-3 rounded-sm mr-1.5 inline-block bg-blue-100"></span>Main Agenda</div>
                    <div className="flex items-center text-xs text-gray-700"><span className="w-3 h-3 rounded-sm mr-1.5 inline-block bg-green-100"></span>Duty</div>
                    <div className="flex items-center text-xs text-gray-700"><span className="w-3 h-3 rounded-sm mr-1.5 inline-block bg-cyan-100"></span>Meeting</div>
                    <div className="flex items-center text-xs text-gray-700"><span className="w-3 h-3 rounded-sm mr-1.5 inline-block bg-yellow-100"></span>Break/Off</div>
                    <div className="flex items-center text-xs text-gray-700"><span className="w-3 h-3 rounded-sm mr-1.5 inline-block bg-gray-50 border border-gray-300"></span>Free</div>
                </section>

                <nav className="flex justify-center items-center gap-2 mt-2">
                    <button className="swiper-button-prev relative w-auto h-auto text-blue-600 after:text-lg after:font-bold"></button>
                    <div className="flex flex-grow justify-center gap-1.5">
                        {dayButtons}
                    </div>
                    <button className="swiper-button-next relative w-auto h-auto text-blue-600 after:text-lg after:font-bold"></button>
                </nav>
            </header>

            <main className="flex-grow min-h-0 relative">
                <div className="swiper h-full">
                    <div className="swiper-wrapper">
                        {swiperSlides}
                    </div>
                </div>
            </main>

            <footer className="flex-shrink-0 bg-gray-100 border-t border-gray-300">
                <div className="h-3"></div>
            </footer>

            {/* Filter Modal */}
            {isFilterModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex justify-center items-center p-2 box-border" onClick={handleFilterModalCancel}>
                    <div className="bg-white rounded-lg p-4 max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-xl relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={handleFilterModalCancel} className="absolute top-2 right-2 bg-transparent border-none text-gray-600 text-xl cursor-pointer w-6 h-6 flex items-center justify-center rounded-full transition-colors duration-200 hover:bg-gray-100">&times;</button>
                        <div className="mb-3 pr-6">
                            <h2 className="text-xl font-bold text-gray-800 m-0">Filter Roles</h2>
                        </div>
                        <div className="mb-4">
                            {populateFilters()}
                        </div>
                        <div className="flex gap-2 justify-end pt-3 border-t border-gray-200">
                            <button onClick={handleFilterModalCancel} className="px-4 py-2 border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 text-sm hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400">
                                Cancel
                            </button>
                            <button onClick={handleFilterModalClose} className="px-4 py-2 border border-blue-600 bg-blue-600 text-white rounded-md cursor-pointer transition-all duration-200 text-sm hover:bg-blue-700 hover:border-blue-700">
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Role Details Modal */}
            {isRoleModalOpen && selectedEvent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex justify-center items-center p-2 box-border" onClick={() => setIsRoleModalOpen(false)}>
                    <div className="bg-white rounded-lg p-4 max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-xl relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setIsRoleModalOpen(false)} className="absolute top-2 right-2 bg-transparent border-none text-gray-600 text-xl cursor-pointer w-6 h-6 flex items-center justify-center rounded-full transition-colors duration-200 hover:bg-gray-100">&times;</button>
                        <div className="mb-3 pr-6">
                            <h2 className="text-xl font-bold text-gray-800 m-0 mb-2">{selectedEvent.activity}</h2>
                            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full inline-block">{selectedEvent.eventTime}</div>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-base font-bold text-gray-800 mb-2 border-b-2 border-blue-600 pb-1">Assigned Staff</h3>
                            <div className="flex flex-col gap-2">
                                {(() => {
                                    if (selectedEvent.mergedEvent && selectedEvent.mergedEvent.assignedRoles.length > 0) {
                                        const roleElements = [];
                                        selectedEvent.mergedEvent.assignedRoles.forEach(role => {
                                            const staff = roleFullNames[role] || [];
                                            
                                            if (staff.length > 0) {
                                                const isAcRole = role.startsWith('AC ');
                                                const acRoleClass = isAcRole ? 'text-green-600' : 'text-gray-700';
                                                roleElements.push(
                                                    <div key={role} className="flex flex-col gap-1">
                                                        <div className={`font-semibold text-sm border-b border-gray-200 pb-1 ${acRoleClass}`}>{role}</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {staff.map(name => (
                                                                <span
                                                                    key={name}
                                                                    className={`bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-md ${isAcRole ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-blue-700'}`}
                                                                    onClick={(e) => { e.stopPropagation(); activateNameSearch(name); }}
                                                                >
                                                                    {name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        });
                                        return roleElements.length > 0 ? roleElements : (
                                            <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                                                No staff assigned (roles: {selectedEvent.mergedEvent.assignedRoles.join(', ')})
                                            </span>
                                        );
                                    } else {
                                        return (
                                            <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                                                No staff assigned (no roles found)
                                            </span>
                                        );
                                    }
                                })()}
                            </div>
                        </div>

                        {selectedEvent.description && selectedEvent.description.trim() && (
                            <div className="mb-4">
                                <h3 className="text-base font-bold text-gray-800 mb-2 border-b-2 border-blue-600 pb-1">Activity Description</h3>
                                <div className="text-gray-700 leading-relaxed text-sm">{selectedEvent.description}</div>
                            </div>
                        )}

                        {selectedEvent.mergedEvent && findLinkedEvents(selectedEvent.mergedEvent).length > 0 && (
                            <div className="mt-4 pt-3 border-t border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 before:content-['🔗'] before:text-sm">Related Events</h3>
                                <div className="flex flex-col gap-2">
                                    {findLinkedEvents(selectedEvent.mergedEvent).map((linkedEvent, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-gray-50 border border-gray-300 rounded-md p-2 cursor-pointer transition-colors duration-200 hover:bg-gray-100"
                                            onClick={() => showRoleModal({
                                                eventKey: `${linkedEvent.weekday}-${linkedEvent.startTime}-${linkedEvent.endTime}-${linkedEvent.eventName}-${linkedEvent.eventType}`,
                                                activity: `${linkedEvent.eventAbbreviation} - ${linkedEvent.eventName}`,
                                                description: linkedEvent.eventDescription,
                                                eventTime: `${linkedEvent.startTime} - ${linkedEvent.endTime}`,
                                                eventName: linkedEvent.eventName,
                                                eventType: linkedEvent.eventType,
                                                mergedEvent: linkedEvent
                                            })}
                                        >
                                            <div className="font-semibold text-gray-700 mb-1 text-sm">{linkedEvent.eventName}</div>
                                            <div className="text-xs text-gray-600 mb-1">{linkedEvent.startTime} - {linkedEvent.endTime}</div>
                                            <div className="flex flex-wrap gap-1">
                                                {linkedEvent.assignedRoles.map(role => {
                                                    const staff = roleFullNames[role] || [];
                                                    if (staff.length > 0) {
                                                        const isAcRole = role.startsWith('AC ');
                                                        // Show all staff members for each role
                                                        return staff.map(staffName => (
                                                            <span key={`${role}-${staffName}`} className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${isAcRole ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
                                                                {staffName}
                                                            </span>
                                                        ));
                                                    }
                                                    return null;
                                                }).flat()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Duties Summary Modal */}

            {isDutiesSummaryModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex justify-center items-center p-2 box-border" onClick={() => setIsDutiesSummaryModalOpen(false)}>
                    <div className="bg-white rounded-lg p-4 max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-xl relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setIsDutiesSummaryModalOpen(false)} className="absolute top-2 right-2 bg-transparent border-none text-gray-600 text-xl cursor-pointer w-6 h-6 flex items-center justify-center rounded-full transition-colors duration-200 hover:bg-gray-100">&times;</button>
                        <div className="mb-3 pr-6">
                            <h2 className="text-xl font-bold text-gray-800 m-0">AC Role Duties Summary</h2>
                        </div>
                        <div className="flex flex-col gap-2 mt-2">
                            {/* Flexible AC role pairing layout */}
                            {(() => {
                                // Get all AC role keys and sort numerically
                                const acRoleKeys = Object.keys(dutiesData)
                                    .filter(key => key.startsWith('AC '))
                                    .sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));
                                const pairs = [];
                                for (let i = 0; i < acRoleKeys.length; i += 2) {
                                    const role1 = acRoleKeys[i];
                                    const role2 = acRoleKeys[i + 1];
                                    const duties1 = dutiesData[role1] || [];
                                    const duties2 = role2 ? dutiesData[role2] || [] : [];
                                    const assignments1 = roleAssignments[role1];
                                    const assignments2 = role2 ? roleAssignments[role2] : undefined;
                                    const assignedName1 = assignments1 && assignments1.length > 0 ? ` (${assignments1[0]})` : '';
                                    const assignedName2 = assignments2 && assignments2.length > 0 ? ` (${assignments2[0]})` : '';
                                    pairs.push(
                                        <div key={`pair-${role1}`} className="grid grid-cols-2 gap-2">
                                            {/* First AC role */}
                                            <div className="bg-gray-100 rounded-md p-2 border-l-4 border-gray-300">
                                                <h3 
                                                    className="text-sm font-bold text-white bg-green-600 p-1.5 rounded-md text-center mb-2 cursor-pointer hover:bg-green-700 transition-colors duration-200"
                                                    onClick={() => {
                                                        const nameData = allNames.find(n => n.role === role1);
                                                        if (nameData) {
                                                            setIsDutiesSummaryModalOpen(false);
                                                            setTimeout(() => selectName(nameData), 100);
                                                        }
                                                    }}
                                                >{role1}{assignedName1}</h3>
                                                <ul className="list-none p-0 m-0">
                                                    {duties1.map((duty, idx) => (
                                                        <li key={idx} className="py-0.5 border-b border-gray-200 text-xs text-gray-800 last:border-b-0 before:content-['•_'] before:font-bold before:text-gray-800 before:mr-1">{duty}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            {/* Second AC role */}
                                            {role2 ? (
                                                <div className="bg-gray-100 rounded-md p-2 border-l-4 border-gray-300">
                                                    <h3 
                                                        className="text-sm font-bold text-white bg-green-600 p-1.5 rounded-md text-center mb-2 cursor-pointer hover:bg-green-700 transition-colors duration-200"
                                                        onClick={() => {
                                                            const nameData = allNames.find(n => n.role === role2);
                                                            if (nameData) {
                                                                setIsDutiesSummaryModalOpen(false);
                                                                setTimeout(() => selectName(nameData), 100);
                                                            }
                                                        }}
                                                    >{role2}{assignedName2}</h3>
                                                    <ul className="list-none p-0 m-0">
                                                        {duties2.map((duty, idx) => (
                                                            <li key={idx} className="py-0.5 border-b border-gray-200 text-xs text-gray-800 last:border-b-0 before:content-['•_'] before:font-bold before:text-gray-800 before:mr-1">{duty}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : (
                                                <div></div>
                                            )}
                                        </div>
                                    );
                                }
                                return pairs;
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
