import React, { useState, useEffect, useRef } from 'react';
import { onSnapshot, collection, runTransaction, doc } from 'firebase/firestore';

// Import appId for role assignments collection path
import { appId } from '../firebase-config';

// We'll conditionally import Leaflet to avoid server-side issues
let L = null;
if (typeof window !== 'undefined') {
  import('leaflet').then((leaflet) => {
    L = leaflet.default;
    
    // Fix for default Leaflet markers in React
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    // Import Leaflet CSS
    import('leaflet/dist/leaflet.css');
  });
}

const SelectionDashboard = ({ db }) => {
  // State for the three collections
  const [outdoorLocations, setOutdoorLocations] = useState([]);
  const [indoorLocations, setIndoorLocations] = useState([]);
  const [companyNames, setCompanyNames] = useState([]);
  const [cnRoles, setCnRoles] = useState([]); // CN counselors from roleAssignments
  
  // State for user's current selections
  const [selection, setSelection] = useState({
    outdoor: null,
    indoor: null,
    company: null,
    cnCounselors: [] // Array of selected CN names
  });

  // State for modal dropdowns
  const [modals, setModals] = useState({
    company: false,
    cnCounselors: false,
    indoor: false,
    outdoor: false
  });

  // State for management view
  const [showManagement, setShowManagement] = useState(false);
  const [claimedSpots, setClaimedSpots] = useState([]);

  // State for UI feedback
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Leaflet map references
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());

  // Set up real-time listeners for all three collections
  useEffect(() => {
    if (!db) {
      setError('Database connection not available');
      setIsLoading(false);
      return;
    }
    
    const unsubscribers = [];

    // Listen to outdoor locations
    const outdoorUnsubscribe = onSnapshot(
      collection(db, 'outdoor_locations'),
      (snapshot) => {
        const locations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort locations naturally (so Spot 1, Spot 2, ... Spot 10, Spot 11)
        locations.sort((a, b) => {
          return a.name.localeCompare(b.name, undefined, { 
            numeric: true, 
            sensitivity: 'base' 
          });
        });
        
        setOutdoorLocations(locations);
        if (L && mapInstanceRef.current) {
          // Add a small delay to prevent rapid successive updates
          setTimeout(() => {
            console.log('Updating markers from data change');
            updateMapMarkers(locations);
          }, 200);
        }
      },
      (error) => {
        console.error('Error fetching outdoor locations:', error);
        setError('Failed to load outdoor locations. Make sure you have the outdoor_locations collection in Firestore.');
      }
    );
    unsubscribers.push(outdoorUnsubscribe);

    // Listen to indoor locations
    const indoorUnsubscribe = onSnapshot(
      collection(db, 'indoor_locations'),
      (snapshot) => {
        const locations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort locations naturally by name
        locations.sort((a, b) => {
          return a.name.localeCompare(b.name, undefined, { 
            numeric: true, 
            sensitivity: 'base' 
          });
        });
        
        setIndoorLocations(locations);
      },
      (error) => {
        console.error('Error fetching indoor locations:', error);
        setError('Failed to load indoor locations. Make sure you have the indoor_locations collection in Firestore.');
      }
    );
    unsubscribers.push(indoorUnsubscribe);

    // Listen to company names
    const namesUnsubscribe = onSnapshot(
      collection(db, 'company_names'),
      (snapshot) => {
        const names = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort company names alphabetically
        names.sort((a, b) => {
          return a.name.localeCompare(b.name, undefined, { 
            numeric: true, 
            sensitivity: 'base' 
          });
        });
        
        setCompanyNames(names);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching company names:', error);
        setError('Failed to load company names. Make sure you have the company_names collection in Firestore.');
        setIsLoading(false);
      }
    );
    unsubscribers.push(namesUnsubscribe);

    // Listen to role assignments for CN counselors
    const roleAssignmentsCollectionPath = `artifacts/${appId}/public/data/roleAssignments`;
    const roleAssignmentsUnsubscribe = onSnapshot(
      collection(db, roleAssignmentsCollectionPath),
      (snapshot) => {
        console.log(' Loading role assignments from:', roleAssignmentsCollectionPath);
        console.log(' Found', snapshot.docs.length, 'documents');
        const cnNames = new Set(); // Use Set to avoid duplicates
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const role = data.role || doc.id;
          console.log(' Checking role:', role, 'with data:', data);
          
          // More flexible CN role matching - check for CN, Counselor, or contains CN
          const isCnRole = role && (
            role.startsWith('CN ') || 
            role.startsWith('CN') ||
            role.toLowerCase().includes('cn') || 
            role.toLowerCase().includes('counselor')
          );
          
          if (isCnRole && data.names && data.names.length > 0) {
            console.log(' Found CN role:', role, 'with names:', data.names);
            data.names.forEach(name => cnNames.add(name));
          }
        });
        
        const cnArray = Array.from(cnNames).sort();
        console.log(' Final CN names:', cnArray);
        setCnRoles(cnArray); // Convert to sorted array
      },
      (error) => {
        console.error('Error fetching role assignments:', error);
        setError('Failed to load counselor assignments. Make sure you have the roleAssignments collection in Firestore.');
      }
    );
    unsubscribers.push(roleAssignmentsUnsubscribe);

    // Cleanup all listeners
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [db]);

  // Load claimed spots for management view
  useEffect(() => {
    if (!showManagement || !db) return;

    const loadClaimedSpots = () => {
      const claimed = [];
      
      // Combine all claimed locations
      [...outdoorLocations, ...indoorLocations].forEach(location => {
        if (location.status === 'claimed') {
          claimed.push({
            type: outdoorLocations.includes(location) ? 'outdoor' : 'indoor',
            location: location,
            company: companyNames.find(c => c.name === location.claimedBy),
            cnCounselors: location.cnCounselors || []
          });
        }
      });

      setClaimedSpots(claimed);
    };

    loadClaimedSpots();
  }, [showManagement, outdoorLocations, indoorLocations, companyNames]);

  // Initialize map when Leaflet is loaded
  useEffect(() => {
    const initMap = () => {
      if (L && mapRef.current && !mapInstanceRef.current && !showManagement) {
        console.log('Initializing map...');
        // Initialize map centered on a default location (you can adjust coordinates)
        mapInstanceRef.current = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          dragging: true,
          touchZoom: true
        }).setView([51.051, -114.078], 13);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstanceRef.current);
        
        // Wait for map to be fully initialized before adding markers
        mapInstanceRef.current.whenReady(() => {
          console.log('Map is ready, checking for data...');
          if (outdoorLocations.length > 0) {
            console.log('Adding markers on map ready');
            updateMapMarkers(outdoorLocations);
          }
        });
      }
    };

    // Clean up map when switching to management view
    if (showManagement && mapInstanceRef.current) {
      console.log('Cleaning up map for management view...');
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize or re-initialize map when not in management view
    if (!showManagement) {
      if (L) {
        initMap();
      } else {
        // Retry initialization after a short delay if Leaflet isn't loaded yet
        const timer = setTimeout(initMap, 1000);
        return () => clearTimeout(timer);
      }
    }

    // Cleanup map on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [L, outdoorLocations, showManagement]);

  // Create custom icons (only when L is available)
  const createIcons = () => {
    if (!L) return { availableIcon: null, claimedIcon: null };
    
    // Larger icons for better mobile touch targets
    const iconSize = [30, 45]; // Slightly larger than default
    const iconAnchor = [15, 45];
    const popupAnchor = [1, -34];
    
    const availableIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: iconSize,
      iconAnchor: iconAnchor,
      popupAnchor: popupAnchor,
      shadowSize: [41, 41]
    });

    const claimedIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: iconSize,
      iconAnchor: iconAnchor,
      popupAnchor: popupAnchor,
      shadowSize: [41, 41]
    });

    return { availableIcon, claimedIcon };
  };

  // Update map markers when outdoor locations change
  const updateMapMarkers = (locations) => {
    if (!L || !mapInstanceRef.current) {
      console.log('Map not ready for markers:', { L: !!L, map: !!mapInstanceRef.current });
      return;
    }

    const { availableIcon, claimedIcon } = createIcons();
    if (!availableIcon || !claimedIcon) {
      console.log('Icons not ready');
      return;
    }

    console.log('Updating map markers with', locations.length, 'locations');

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current.clear();

    // Add new markers
    const validLocations = locations.filter(location => location.lat && location.lon);
    
    validLocations.forEach(location => {
      const icon = location.status === 'available' ? availableIcon : claimedIcon;
      const marker = L.marker([location.lat, location.lon], { icon })
        .addTo(mapInstanceRef.current);

      // Create popup content
      const popupContent = `
        <div>
          <h3>${location.name}</h3>
          <p>${location.description || 'No description available'}</p>
          <p><strong>Status:</strong> ${location.status}</p>
          ${location.claimedBy ? `
            <p><strong>Claimed by:</strong> ${location.claimedBy}</p>
            ${location.cnCounselors && location.cnCounselors.length > 0 ? 
              `<p><strong>CN Counselors:</strong> ${location.cnCounselors.map(cn => cn.name).join(', ')}</p>` : ''
            }
          ` : ''}
        </div>
      `;
      marker.bindPopup(popupContent);

      // Handle marker click for selection - ensure this is properly bound
      marker.on('click', (e) => {
        console.log('Marker clicked!', location.name, 'Status:', location.status);
        e.originalEvent?.stopPropagation(); // Prevent event bubbling
        if (location.status === 'available') {
          console.log('Handling selection for:', location.name);
          handleOutdoorSelection(location);
        } else {
          console.log('Location not available:', location.name, location.status);
        }
      });

      markersRef.current.set(location.id, marker);
    });

    // Center map on all markers if we have locations
    if (validLocations.length > 0) {
      // Add a small delay to ensure markers are fully added before centering
      setTimeout(() => {
        if (validLocations.length === 1) {
          // If only one location, center on it with a reasonable zoom
          const location = validLocations[0];
          mapInstanceRef.current.setView([location.lat, location.lon], 16);
        } else {
          // If multiple locations, calculate center point and use fixed zoom
          const avgLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length;
          const avgLon = validLocations.reduce((sum, loc) => sum + loc.lon, 0) / validLocations.length;
          mapInstanceRef.current.setView([avgLat, avgLon], 15); // Fixed zoom level for campus view
        }
      }, 100);
    }
  };

  // Modal helper functions
  const openModal = (type) => {
    setModals(prev => ({ ...prev, [type]: true }));
  };

  const closeModal = (type) => {
    setModals(prev => ({ ...prev, [type]: false }));
  };

  const closeAllModals = () => {
    setModals({ company: false, cnCounselors: false, indoor: false, outdoor: false });
  };

  // Handle outdoor location selection
  const handleOutdoorSelection = (location) => {
    if (location.status !== 'available') return;
    
    setSelection(prev => ({ ...prev, outdoor: location }));
    closeModal('outdoor');
    
    // Pan map to selected location and open popup without changing zoom
    if (mapInstanceRef.current && location.lat && location.lon) {
      mapInstanceRef.current.panTo([location.lat, location.lon]);
      const marker = markersRef.current.get(location.id);
      if (marker) {
        marker.openPopup();
      }
    }
  };

  // Handle indoor location selection
  const handleIndoorSelection = (location) => {
    if (location.status !== 'available') return;
    setSelection(prev => ({ ...prev, indoor: location }));
    closeModal('indoor');
  };

  // Handle company name selection
  const handleCompanySelection = (company) => {
    if (company.status !== 'available') return;
    setSelection(prev => ({ ...prev, company: company }));
    closeModal('company');
  };

  // Handle CN counselor selection (toggle selection)
  const handleCnSelection = (counselorName) => {
    setSelection(prev => {
      const isSelected = prev.cnCounselors.some(cn => cn.name === counselorName);
      
      if (isSelected) {
        // Remove counselor
        return {
          ...prev,
          cnCounselors: prev.cnCounselors.filter(cn => cn.name !== counselorName)
        };
      } else {
        // Add counselor
        return {
          ...prev,
          cnCounselors: [...prev.cnCounselors, { name: counselorName }]
        };
      }
    });
  };

  // Check if all selections are made and available for claiming
  const canClaim = () => {
    return selection.outdoor && 
           selection.indoor && 
           selection.company &&
           selection.cnCounselors.length >= 2 &&
           selection.outdoor.status === 'available' &&
           selection.indoor.status === 'available' &&
           selection.company.status === 'available';
  };

  // Handle claiming selections with Firebase transaction
  const handleClaimSelections = async () => {
    if (!canClaim()) return;

    setIsClaiming(true);
    setError('');
    setSuccessMessage('');

    try {
      await runTransaction(db, async (transaction) => {
        // Read all three selected documents
        const outdoorDocRef = doc(db, 'outdoor_locations', selection.outdoor.id);
        const indoorDocRef = doc(db, 'indoor_locations', selection.indoor.id);
        const companyDocRef = doc(db, 'company_names', selection.company.id);

        const outdoorDoc = await transaction.get(outdoorDocRef);
        const indoorDoc = await transaction.get(indoorDocRef);
        const companyDoc = await transaction.get(companyDocRef);

        // Verify all documents exist and are still available
        if (!outdoorDoc.exists() || !indoorDoc.exists() || !companyDoc.exists()) {
          throw new Error('One or more selected items no longer exist');
        }

        const outdoorData = outdoorDoc.data();
        const indoorData = indoorDoc.data();
        const companyData = companyDoc.data();

        if (outdoorData.status !== 'available' || 
            indoorData.status !== 'available' || 
            companyData.status !== 'available') {
          throw new Error('One or more selected items have been claimed by another company');
        }

        // All items are available, claim them atomically
        const companyName = selection.company.name;
        const cnCounselorNames = selection.cnCounselors.map(cn => cn.name);
        
        transaction.update(outdoorDocRef, {
          status: 'claimed',
          claimedBy: companyName,
          cnCounselors: selection.cnCounselors,
          claimedAt: new Date().toISOString()
        });

        transaction.update(indoorDocRef, {
          status: 'claimed',
          claimedBy: companyName,
          cnCounselors: selection.cnCounselors,
          claimedAt: new Date().toISOString()
        });

        transaction.update(companyDocRef, {
          status: 'claimed',
          claimedBy: cnCounselorNames.join(', '),
          cnCounselors: selection.cnCounselors,
          companyName: companyName,
          claimedAt: new Date().toISOString()
        });
      });

      // Success! Reset selections and show success message
      setSelection({ outdoor: null, indoor: null, company: null, cnCounselors: [] });
      setSuccessMessage(`Successfully claimed all selections for ${selection.company.name} with counselors: ${selection.cnCounselors.map(cn => cn.name).join(', ')}!`);
      
    } catch (error) {
      console.error('Transaction failed:', error);
      setError(error.message || 'Failed to claim selections. Please try again.');
      
      // Reset selections so user can re-pick
      setSelection({ outdoor: null, indoor: null, company: null, cnCounselors: [] });
    } finally {
      setIsClaiming(false);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg">Loading Company Spot Selections...</p>
        </div>
      </div>
    );
  }

  // Management view
  if (showManagement) {
    return (
      <div className="flex-1 bg-gray-50 overflow-auto">
        <div className="p-4 max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Claimed Company Spots Overview
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowManagement(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium"
              >
                ← Back to Selection
              </button>
            </div>
          </div>

          {claimedSpots.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500">No spots have been claimed yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Group by company */}
              {Object.entries(
                claimedSpots.reduce((acc, spot) => {
                  const companyName = spot.company?.name || 'Unknown';
                  if (!acc[companyName]) {
                    acc[companyName] = { company: spot.company, spots: [] };
                  }
                  acc[companyName].spots.push(spot);
                  return acc;
                }, {})
              ).map(([companyName, data]) => (
                <div key={companyName} className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-bold text-lg mb-2 text-blue-600">{companyName}</h3>
                  
                  {/* CN Counselors */}
                  <div className="mb-3">
                    <span className="font-medium text-sm text-gray-700">CN Counselors:</span>
                    <div className="text-sm text-gray-600">
                      {data.spots[0]?.cnCounselors?.map(cn => cn.name).join(', ') || 'None assigned'}
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="space-y-2">
                    {data.spots.map((spot, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">
                          {spot.type === 'outdoor' ? '️ Outdoor:' : ' Indoor:'}
                        </span>
                        <span className="ml-2">{spot.location.name}</span>
                        {spot.location.description && (
                          <div className="text-xs text-gray-500 ml-6">
                            {spot.location.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Claimed time */}
                  <div className="text-xs text-gray-400 mt-3">
                    Claimed: {new Date(data.spots[0]?.location?.claimedAt || '').toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 overflow-auto">
      <div className="p-3 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Company Spot Dashboard
          </h2>
          <button
            onClick={() => setShowManagement(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
          >
            View Claimed Spots
          </button>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Modal-based Selection Buttons */}
          <div className="space-y-4">
            {/* Combined Selections and Claim Card */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Make Your Selections
              </h3>
              
              {/* Selection Buttons Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Company Name Button */}
                <button
                  onClick={() => openModal('company')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selection.company
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-700">Company Name</div>
                  <div className={`text-sm mt-1 ${selection.company ? 'text-blue-700' : 'text-gray-500'}`}>
                    {selection.company?.name || 'Click to select'}
                  </div>
                  {selection.company?.scripture_reference && (
                    <div className="text-xs text-gray-500 mt-1">
                      {selection.company.scripture_reference}
                    </div>
                  )}
                </button>

                {/* CN Counselors Button */}
                <button
                  onClick={() => openModal('cnCounselors')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selection.cnCounselors.length > 0
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-700">CN Counselors</div>
                  <div className={`text-sm mt-1 ${
                    selection.cnCounselors.length > 0 
                      ? 'text-green-700' 
                      : 'text-gray-500' 
                  }`}>
                    {selection.cnCounselors.length > 0 
                      ? `${selection.cnCounselors.length} selected`
                      : 'Click to select' 
                    }
                  </div>
                </button>

                {/* Indoor Location Button */}
                <button
                  onClick={() => openModal('indoor')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selection.indoor
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-700">Indoor Location</div>
                  <div className={`text-sm mt-1 ${selection.indoor ? 'text-purple-700' : 'text-gray-500'}`}>
                    {selection.indoor?.name || 'Click to select'}
                  </div>
                </button>

                {/* Outdoor Location Button */}
                <button
                  onClick={() => openModal('outdoor')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selection.outdoor
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-300 hover:border-orange-300 hover:bg-orange-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-700">Outdoor Location</div>
                  <div className={`text-sm mt-1 ${selection.outdoor ? 'text-orange-700' : 'text-gray-500'}`}>
                    {selection.outdoor?.name || 'Click to select'}
                  </div>
                </button>
              </div>

              {/* Claim Button */}
              <button
                onClick={handleClaimSelections}
                disabled={!canClaim() || isClaiming}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                  canClaim() && !isClaiming
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isClaiming ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500 mr-2"></div>
                    Claiming Selections...
                  </span>
                ) : (
                  ' Claim My Selections'
                )}
              </button>

              {!canClaim() && !isClaiming && (
                <p className="text-sm text-gray-500 text-center mt-3">
                  Complete all selections (minimum 2 CN counselors) to claim your spots
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Map */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  Outdoor Locations Map
                </h3>
              </div>
              <div 
                ref={mapRef}
                className="w-full h-[500px] rounded-lg border border-gray-300 bg-gray-100"
                style={{ zIndex: 1, position: 'relative' }}
              ></div>
              <div className="mt-3 flex items-center justify-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  Available - Click to select
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                  Claimed
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Components */}
        {/* Company Name Modal */}
        {modals.company && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto"
            onClick={(e) => e.target === e.currentTarget && closeModal('company')}
          >
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden">
              <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-gray-50">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Choose Company Name</h3>
                <button
                  onClick={() => closeModal('company')}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded"
                >
                  ×
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
                {companyNames.length === 0 ? (
                  <p className="text-gray-500 text-center">No company names available.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {companyNames.map(company => (
                      <button
                        key={company.id}
                        onClick={() => handleCompanySelection(company)}
                        disabled={company.status === 'claimed'}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selection.company?.id === company.id
                            ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                            : company.status === 'claimed'
                            ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
                        }`}
                      >
                        <div className="font-medium text-sm">{company.name}</div>
                        {company.scripture_reference && (
                          <div className="text-xs text-gray-500 mt-1">{company.scripture_reference}</div>
                        )}
                        {company.status === 'claimed' && (
                          <div className="text-xs mt-1 text-gray-500">
                            Claimed by {company.claimedBy}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CN Counselors Modal */}
        {modals.cnCounselors && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto"
            onClick={(e) => e.target === e.currentTarget && closeModal('cnCounselors')}
          >
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden">
              <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-gray-50">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
                  Select CN Counselors
                </h3>
                <button
                  onClick={() => closeModal('cnCounselors')}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded"
                >
                  ×
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
                {cnRoles.length === 0 ? (
                  <p className="text-gray-500 text-center">No CN counselors available.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {cnRoles.map((counselor, index) => {
                      const isSelected = selection.cnCounselors.some(cn => cn.name === counselor);
                      return (
                        <button
                          key={index}
                          onClick={() => handleCnSelection(counselor)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200'
                              : 'border-gray-300 hover:border-green-300 hover:bg-green-50 hover:shadow-md'
                          }`}
                        >
                          <div className="font-medium text-sm">{counselor}</div>
                          {isSelected && (
                            <div className="text-xs mt-1 text-green-600 font-medium"> Selected</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-800">
                    <strong>Selected:</strong> {selection.cnCounselors.length > 0 
                      ? selection.cnCounselors.map(cn => cn.name).join(', ')
                      : 'None'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Indoor Locations Modal */}
        {modals.indoor && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto"
            onClick={(e) => e.target === e.currentTarget && closeModal('indoor')}
          >
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden">
              <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-gray-50">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Choose Indoor Location</h3>
                <button
                  onClick={() => closeModal('indoor')}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded"
                >
                  ×
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
                {indoorLocations.length === 0 ? (
                  <p className="text-gray-500 text-center">No indoor locations available.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {indoorLocations.map(location => (
                      <button
                        key={location.id}
                        onClick={() => handleIndoorSelection(location)}
                        disabled={location.status === 'claimed'}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          selection.indoor?.id === location.id
                            ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200'
                            : location.status === 'claimed'
                            ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50 hover:shadow-md'
                        }`}
                      >
                        <div className="font-semibold text-gray-800">{location.name}</div>
                        {location.description && (
                          <div className="text-sm text-gray-600 mt-1 leading-relaxed">{location.description}</div>
                        )}
                        {location.status === 'claimed' && (
                          <div className="text-sm mt-2 text-gray-500">
                            Claimed by {location.claimedBy}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Outdoor Locations Modal */}
        {modals.outdoor && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto"
            onClick={(e) => e.target === e.currentTarget && closeModal('outdoor')}
          >
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden">
              <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-gray-50">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Choose Outdoor Location</h3>
                <button
                  onClick={() => closeModal('outdoor')}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1 hover:bg-gray-200 rounded"
                >
                  ×
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
                {outdoorLocations.length === 0 ? (
                  <p className="text-gray-500 text-center">No outdoor locations available.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {outdoorLocations.map(location => (
                      <button
                        key={location.id}
                        onClick={() => handleOutdoorSelection(location)}
                        disabled={location.status === 'claimed'}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          selection.outdoor?.id === location.id
                            ? 'border-orange-500 bg-orange-50 shadow-md ring-2 ring-orange-200'
                            : location.status === 'claimed'
                            ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md'
                        }`}
                      >
                        <div className="font-semibold text-gray-800">{location.name}</div>
                        {location.description && (
                          <div className="text-sm text-gray-600 mt-2">{location.description}</div>
                        )}
                        {location.lat && location.lon && (
                          <div className="text-xs text-gray-500 mt-1">
                             {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                          </div>
                        )}
                        {location.status === 'claimed' && (
                          <div className="text-sm mt-2 text-gray-500">
                            Claimed by {location.claimedBy}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectionDashboard;
