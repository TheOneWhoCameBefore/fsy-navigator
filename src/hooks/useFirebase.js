import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

const useFirebase = (firebaseConfig, appId, initialAuthToken) => {
    const [db, setDb] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [schedules, setSchedules] = useState([]);
    const [roleAssignments, setRoleAssignments] = useState({});
    const [roleFullNames, setRoleFullNames] = useState({});
    const [allNames, setAllNames] = useState([]);
    const [roles, setRoles] = useState([]);

    useEffect(() => {
        if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
            setError("Firebase configuration is missing or invalid.");
            setLoading(false);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);

            onAuthStateChanged(firebaseAuth, async (user) => {
                if (!user) {
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    } catch (authError) {
                        setError("Authentication failed.");
                    }
                }
            });

            const agendaEventsRef = collection(firestoreDb, `/artifacts/${appId}/public/data/agendaEvents`);
            const roleEventsRef = collection(firestoreDb, `/artifacts/${appId}/public/data/roleEvents`);
            const roleAssignmentsRef = collection(firestoreDb, `/artifacts/${appId}/public/data/roleAssignments`);

            let agendaEvents = [];
            let roleEvents = [];
            let loadedCollections = 0;
            const totalCollections = 3;

            const checkAllLoaded = () => {
                loadedCollections++;
                if (loadedCollections === totalCollections) {
                    // Combine agenda and role events
                    const allEvents = [...agendaEvents, ...roleEvents];
                    
                    // Build roles from all events (like the original App.jsx)
                    const allRolesSet = new Set();
                    
                    // Always add Agenda role first
                    allRolesSet.add('Agenda');
                    
                    // Add roles from all events
                    allEvents.forEach(event => {
                        if (event.assignedRoles) {
                            event.assignedRoles.forEach(role => allRolesSet.add(role));
                        }
                    });
                    
                    // Sort roles with Agenda first
                    const sortedRoles = [...allRolesSet].sort((a, b) => {
                        if (a === 'Agenda') return -1;
                        if (b === 'Agenda') return 1;
                        return a.localeCompare(b, undefined, { numeric: true });
                    });
                    
                    setSchedules(allEvents);
                    setRoles(sortedRoles);
                    setLoading(false);
                }
            };

            const unsubAgenda = onSnapshot(agendaEventsRef, (snapshot) => {
                agendaEvents = snapshot.docs.map(doc => doc.data());
                checkAllLoaded();
            }, () => setError("Failed to load agenda events."));

            const unsubRoles = onSnapshot(roleEventsRef, (snapshot) => {
                roleEvents = snapshot.docs.map(doc => doc.data());
                checkAllLoaded();
            }, () => setError("Failed to load role events."));
            
            const unsubAssignments = onSnapshot(roleAssignmentsRef, (snapshot) => {
                const assignments = {};
                const fullNames = {};
                const names = [];
                const roleSet = new Set();

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const role = data.role;
                    const nameList = data.names || [];

                    if (role && nameList.length > 0) {
                        const processedNames = nameList.map(name => {
                            if (role.startsWith('AC ') && name.startsWith('AC ')) return name.replace('AC ', '');
                            if (role.startsWith('CN ') && name.startsWith('CN ')) return name.replace('CN ', '');
                            return name;
                        });

                        fullNames[role] = processedNames;
                        assignments[role] = processedNames.map(name => name.split(' ')[0]);

                        processedNames.forEach(fullName => {
                            const displayName = fullName.split(' ')[0];
                            names.push({
                                role: role,
                                displayName: displayName,
                                fullName: fullName,
                                searchText: `${displayName} ${fullName}`.toLowerCase()
                            });
                        });
                    }
                    roleSet.add(role);
                });
                
                setRoleAssignments(assignments);
                setRoleFullNames(fullNames);
                setAllNames(names);
                checkAllLoaded();
            }, () => setError("Failed to load role assignments."));

            return () => {
                unsubAgenda();
                unsubRoles();
                unsubAssignments();
            };
        } catch (e) {
            setError("Failed to initialize Firebase.");
            setLoading(false);
        }
    }, [firebaseConfig, appId, initialAuthToken]);

    return { db, loading, error, schedules, roleAssignments, roleFullNames, allNames, roles };
};

export default useFirebase;