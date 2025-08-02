import React, { useState, Suspense } from 'react';
import useFirebase from './hooks/useFirebase';
import CalendarView from './components/CalendarView';
import { firebaseConfig, appId, initialAuthToken } from './firebase-config';

const SelectionDashboard = React.lazy(() => import('./components/SelectionDashboard'));

const App = () => {
    const [currentPage, setCurrentPage] = useState('calendar');
    const {
        db,
        loading,
        error,
        schedules,
        roleAssignments,
        roleFullNames,
        allNames,
        roles,
    } = useFirebase(firebaseConfig, appId, initialAuthToken);

    console.log('🏠 App render - loading:', loading, 'schedules:', schedules?.length, 'roles:', roles?.length);

    if (loading) {
        console.log('⏳ App showing loading state');
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 text-gray-700">
                <p>Loading calendar data...</p>
            </div>
        );
    }

    if (error) {
        console.log('❌ App showing error state:', error);
        return (
            <div className="flex items-center justify-center h-screen bg-red-100 text-red-800 p-4 rounded-md">
                <p>Error: {error}</p>
            </div>
        );
    }

    console.log('✅ App rendering main content');

    return (
        <div id="calendar-container" className="fixed inset-0 w-screen h-screen box-border flex flex-col font-sans text-gray-800 bg-gray-100">
            <nav className="bg-white shadow-md border-b border-gray-300 px-4 py-1 transition-all duration-300 z-50">
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <h1 className="text-lg font-bold text-gray-800">FSY Navigator</h1>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setCurrentPage('calendar')}
                            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                                currentPage === 'calendar'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            Calendar
                        </button>
                        <button
                            onClick={() => setCurrentPage('selection')}
                            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                                currentPage === 'selection'
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            Spots
                        </button>
                    </div>
                </div>
            </nav>

            {currentPage === 'calendar' ? (
                <CalendarView
                    schedules={schedules}
                    roles={roles}
                    roleAssignments={roleAssignments}
                    roleFullNames={roleFullNames}
                    allNames={allNames}
                />
            ) : (
                <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
                    <SelectionDashboard db={db} />
                </Suspense>
            )}
        </div>
    );
};

export default App;