import React, { useMemo, useState, useCallback, memo } from 'react';

const Header = ({
    roles,
    allNames,
    viewMode,
    nameSearchInput,
    setNameSearchInput,
    setSelectedSearchNameData,
    setActiveFilterRoles,
    onFilterModalOpen,
    onViewToggle,
    onDutiesSummaryClick,
    onNameSelect,
    goToDay
}) => {
    const [nameSearchDropdownActive, setNameSearchDropdownActive] = useState(false);

    // Create the updateActiveDayButton function using DOM manipulation like the original
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

    // Memoize filtered search results to avoid recalculating on every render
    const filteredSearchNames = useMemo(() => {
        if (nameSearchInput.length === 0) return [];
        return allNames.filter(nameData =>
            nameData.searchText.includes(nameSearchInput.toLowerCase())
        );
    }, [allNames, nameSearchInput]);
    
    const clearNameSearch = () => {
        setNameSearchInput('');
        setNameSearchDropdownActive(false);
        setSelectedSearchNameData(null);

        // Reset all role filters to show all columns
        const resetFilters = {};
        roles.forEach(role => {
            resetFilters[role.replace(/[^a-z0-9]/gi, '-').toLowerCase()] = true;
        });
        setActiveFilterRoles(resetFilters);
    };

    const handleNameSearchChange = (e) => {
        const searchTerm = e.target.value;
        setNameSearchInput(searchTerm);
        if (searchTerm.length > 0) {
            setNameSearchDropdownActive(true);
        } else {
            clearNameSearch();
        }
    };
    
    const selectName = (nameData) => {
        onNameSelect(nameData);
        setNameSearchDropdownActive(false);
    };

    const dayButtons = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
        const fullDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index];
        return (
            <button
                key={day}
                data-day={fullDayName}
                onClick={() => {
                    goToDay(fullDayName);
                    // Call the DOM manipulation function immediately after navigation
                    setTimeout(() => updateActiveDayButton(fullDayName), 0);
                }}
                className="quick-nav-btn flex-grow px-2 py-2 border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 text-sm text-center whitespace-nowrap hover:bg-blue-600 hover:text-white hover:border-blue-600"
            >
                {day}
            </button>
        );
    }), [goToDay, updateActiveDayButton]); // Ensure re-render when updateActiveDayButton changes

    return (
        <header className="sticky top-0 z-50 bg-gray-100 border-b border-gray-300 px-3 pt-2 pb-1 shadow-sm">
            <section className="mb-2">
                <div className="relative w-full max-w-xl mx-auto">
                    <input
                        type="text"
                        className="w-full p-2 text-sm border-2 border-gray-300 bg-white rounded-lg outline-none"
                        placeholder="Search names..."
                        value={nameSearchInput}
                        onChange={handleNameSearchChange}
                        onClick={() => { if (nameSearchInput) clearNameSearch(); }}
                        onFocus={() => nameSearchInput.length > 0 && setNameSearchDropdownActive(true)}
                        onBlur={() => setTimeout(() => setNameSearchDropdownActive(false), 200)}
                    />
                    {nameSearchDropdownActive && filteredSearchNames.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-md max-h-52 overflow-y-auto z-50">
                            {filteredSearchNames.map((nameData, index) => (
                                <div
                                    key={index}
                                    className="p-2 cursor-pointer hover:bg-gray-100"
                                    onMouseDown={() => selectName(nameData)}
                                >
                                    <span className="font-bold">{nameData.role}</span>
                                    <span className="text-gray-600 ml-2 text-xs">{nameData.fullName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="flex justify-center gap-2 mb-1 items-center flex-wrap">
                <div className="flex-1 min-w-0 flex justify-center">
                    <button onClick={onDutiesSummaryClick} className="px-3 py-1 text-sm border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-xs hover:bg-blue-600 hover:text-white hover:border-blue-600">
                        Summary
                    </button>
                </div>
                <div className="flex-1 min-w-0 flex justify-center">
                    <button onClick={onFilterModalOpen} className="px-3 py-1 text-sm border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-xs hover:bg-blue-600 hover:text-white hover:border-blue-600">
                        Filter Roles
                    </button>
                </div>
                <div className="flex-1 min-w-0 flex justify-center">
                    <button onClick={onViewToggle} className="px-3 py-1 text-sm border border-gray-300 bg-white rounded-md cursor-pointer transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-xs hover:bg-gray-200 hover:text-gray-800 hover:border-gray-300">
                        {viewMode === 'card' ? 'Table View' : 'Card View'}
                    </button>
                </div>
            </section>

            <section className="flex justify-center items-center flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-gray-700">
                <div className="flex items-center"><span className="w-3 h-3 rounded-sm mr-1.5 bg-blue-100"></span>Main Agenda</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-sm mr-1.5 bg-green-100"></span>Duty</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-sm mr-1.5 bg-cyan-100"></span>Meeting</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-sm mr-1.5 bg-yellow-100"></span>Break/Off</div>
            </section>

            <nav className="flex justify-center items-center gap-2 mt-2">
                <div className="flex flex-grow justify-center gap-1.5">
                    {dayButtons}
                </div>
            </nav>
        </header>
    );
};

export default memo(Header);