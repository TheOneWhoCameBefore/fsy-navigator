import React, { useCallback, memo } from 'react';
import Linkify from 'linkify-react';

// Helper function to handle location clicks
const handleLocationClick = (location) => {
  // Return early if the location is invalid or a non-specific entry
  if (!location || location === 'None' || location === 'Travel') {
    return;
  }
  
  // --- IMPORTANT ---
  // Your Google My Map ID (from the sharing URL)
  const myMapId = '18Y8R67StmyY90vh3Jq4Ysb-OAzEhQ_U'; 
  const baseMapUrl = `https://www.google.com/maps/d/viewer?mid=$${myMapId}`;
  
  // For general areas that don't have specific pins, just open the map
  const generalAreas = [
    'Residence Halls', 'Company Spots', 'Classrooms'
  ];
  
  // Check if the location is a general area (case-insensitive)
  const isGeneralArea = generalAreas.some(area => 
    location.toLowerCase().includes(area.toLowerCase())
  );
  
  if (isGeneralArea) {
    // Just open the base map view for general areas
    window.open(baseMapUrl, '_blank', 'noopener,noreferrer');
  } else {
    // For specific pins, append the 'q' parameter to search for the location name
    const searchUrl = `${baseMapUrl}&q=${encodeURIComponent(location)}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  }
};

const Modals = ({
    isRoleModalOpen,
    closeRoleModal,
    selectedEvent,
    findLinkedEvents,
    roleFullNames,
    isFilterModalOpen,
    closeFilterModal,
    handleFilterChange,
    tempFilterRoles,
    roles,
    roleAssignments,
    isDutiesSummaryModalOpen,
    closeDutiesSummaryModal,
    showRoleModal,
    dutiesData,
    allNames,
    selectNameAndFilter
}) => {

    // A helper function for rendering the filter checkboxes
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

        const maxAcNumber = Math.max(...[...acRoleMap.keys(), ...cnRoleMap.keys()], 0);

        // Group roles into pairs for better layout
        const pairedRoles = [];
        
        // Add "All ACs" and "All CNs" header buttons
        if (acRoles.length > 0 || cnRoles.length > 0) {
            const headerElements = [];
            
            if (acRoles.length > 0) {
                // Check if all AC roles are currently selected
                const allAcSelected = acRoles.every(role => {
                    const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                    return tempFilterRoles[roleClass] !== false;
                });
                
                headerElements.push(
                    <div key="all-acs" className="w-1/2 px-1">
                        <button 
                            onClick={() => {
                                const updates = {};
                                acRoles.forEach(role => {
                                    const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                                    updates[roleClass] = !allAcSelected; // Toggle: deselect if all selected, select if any unselected
                                });
                                Object.keys(updates).forEach(roleClass => {
                                    handleFilterChange(roleClass, updates[roleClass]);
                                });
                            }}
                            className={`block p-2 rounded-md cursor-pointer transition-all duration-200 border select-none text-center text-sm w-full box-border ${
                                allAcSelected 
                                    ? 'bg-green-600 text-white border-green-600 hover:bg-green-700 hover:border-green-700'
                                    : 'bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600'
                            }`}
                        >
                            {allAcSelected ? 'Deselect All ACs' : 'All ACs'}
                        </button>
                    </div>
                );
            } else {
                headerElements.push(<div key="empty-all-acs" className="w-1/2 px-1"></div>);
            }
            
            if (cnRoles.length > 0) {
                // Check if all CN roles are currently selected
                const allCnSelected = cnRoles.every(role => {
                    const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                    return tempFilterRoles[roleClass] !== false;
                });
                
                headerElements.push(
                    <div key="all-cns" className="w-1/2 px-1">
                        <button 
                            onClick={() => {
                                const updates = {};
                                cnRoles.forEach(role => {
                                    const roleClass = role.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                                    updates[roleClass] = !allCnSelected; // Toggle: deselect if all selected, select if any unselected
                                });
                                Object.keys(updates).forEach(roleClass => {
                                    handleFilterChange(roleClass, updates[roleClass]);
                                });
                            }}
                            className={`block p-2 rounded-md cursor-pointer transition-all duration-200 border select-none text-center text-sm w-full box-border ${
                                allCnSelected 
                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700'
                                    : 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 hover:border-blue-600'
                            }`}
                        >
                            {allCnSelected ? 'Deselect All CNs' : 'All CNs'}
                        </button>
                    </div>
                );
            } else {
                headerElements.push(<div key="empty-all-cns" className="w-1/2 px-1"></div>);
            }
            
            pairedRoles.push(
                <div key="header-buttons" className="flex w-full mb-4">
                    {headerElements}
                </div>
            );
        }
        
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
                            className={`block p-2 rounded-md cursor-pointer transition-all duration-200 select-none text-center text-sm w-full box-border ${
                                tempFilterRoles[roleClass] !== false 
                                    ? 'bg-green-600 text-white border-green-600' 
                                    : 'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}
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
                            className={`block p-2 rounded-md cursor-pointer transition-all duration-200 select-none text-center text-sm w-full box-border ${
                                tempFilterRoles[roleClass] !== false 
                                    ? 'bg-blue-600 text-white border-blue-600' 
                                    : 'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}
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
                        className={
                            tempFilterRoles[roleClass] !== false
                                ? 'block p-2 rounded-md bg-purple-600 text-white cursor-pointer transition-all duration-200 border border-purple-600 select-none text-center text-sm w-full box-border'
                                : 'block p-2 rounded-md bg-gray-100 text-gray-800 cursor-pointer transition-all duration-200 border border-gray-300 select-none text-center text-sm w-full box-border'
                        }
                    >
                        {displayName}
                    </label>
                </div>
            );
        });

        return (
            <>
                <div className="w-full">
                    {pairedRoles}
                    {otherRoleElements}
                </div>
            </>
        );
    }, [roles, roleAssignments, tempFilterRoles, handleFilterChange]);

    return (
        <>
            {/* --- Role Details Modal --- */}
            {isRoleModalOpen && selectedEvent && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-start justify-center p-2 sm:p-4 overflow-y-auto" 
                    onClick={(e) => e.target === e.currentTarget && closeRoleModal()}
                >
                    <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden">
                        <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-gray-50">
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-gray-800 m-0 mb-2">{selectedEvent.activity}</h2>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full inline-block">{selectedEvent.eventTime}</div>
                                    {selectedEvent.mergedEvent?.location && (
                                        <button
                                            onClick={() => handleLocationClick(selectedEvent.mergedEvent.location)}
                                            className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full inline-block hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer"
                                            title={`Open ${selectedEvent.mergedEvent.location} on map`}
                                        >
                                            📍 {selectedEvent.mergedEvent.location}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={closeRoleModal} 
                                className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded ml-4"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
                            {/* Assigned Staff Section */}
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
                                                                    onClick={(e) => { 
                                                                        e.stopPropagation(); 
                                                                        const nameData = allNames.find(n => n.fullName === name);
                                                                        if (nameData) {
                                                                            closeRoleModal();
                                                                            setTimeout(() => selectNameAndFilter(nameData), 100);
                                                                        }
                                                                    }}
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

                            {/* Description Section */}
                            {selectedEvent.description && (
                                <div className="mb-4">
                                    <h3 className="text-base font-bold text-gray-800 mb-2 border-b-2 border-blue-600 pb-1">Description</h3>
                                    <p className="break-words">
                                        <Linkify
                                            options={{
                                                target: '_blank',
                                                rel: 'noopener noreferrer',
                                                className: 'text-blue-600 hover:underline break-all'
                                            }}
                                        >
                                            {selectedEvent.description}
                                        </Linkify>
                                    </p>
                                </div>
                            )}

                            {/* Related Events Section */}
                                                        {selectedEvent.mergedEvent && findLinkedEvents(selectedEvent.mergedEvent).length > 0 && (
                                <div className="mt-4 pt-3 border-t border-gray-200">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 before:content-[''] before:text-sm">Related Events</h3>
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
                </div>
            )}

            {/* --- Filter Modal --- */}
            {isFilterModalOpen && (
                 <div 
                     className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-start justify-center p-2 sm:p-4 overflow-y-auto" 
                     onClick={(e) => e.target === e.currentTarget && closeFilterModal()}
                 >
                     <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden">
                         <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-gray-50">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800 m-0">Filter Roles</h2>
                            <button 
                                onClick={closeFilterModal} 
                                className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded"
                            >
                                ×
                            </button>
                         </div>
                         <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
                            {populateFilters()}
                         </div>
                     </div>
                 </div>
            )}

            {/* --- Duties Summary Modal --- */}
            {isDutiesSummaryModalOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-start justify-center p-2 sm:p-4 overflow-y-auto" 
                    onClick={(e) => e.target === e.currentTarget && closeDutiesSummaryModal()}
                >
                    <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden">
                        <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-gray-50">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800 m-0">AC Role Duties Summary</h2>
                            <button 
                                onClick={closeDutiesSummaryModal} 
                                className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
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
                                                            closeDutiesSummaryModal();
                                                            setTimeout(() => selectNameAndFilter(nameData), 100);
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
                                                                closeDutiesSummaryModal();
                                                                setTimeout(() => selectNameAndFilter(nameData), 100);
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
                </div>
            )}
        </>
    );
};

export default memo(Modals);