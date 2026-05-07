import { create } from 'zustand';
import api from '@/services/api';
import { getSocket, rejoinDriverRoom } from '@/services/socket';
import { GeocodeService, RoutingService } from '@/services/driver.mock';

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  name: string;
}

export interface TripRecord {
  id: string;
  passengerName: string;
  pickup: string;
  destination: string;
  fare: number;
  distanceKm: number;
  completedAt: Date;
}

export interface RideRequest {
  id: string;
  bookingId?: string;
  passenger: { name: string; rating: string; avatar?: string };
  pickup: GeocodeResult;
  destination: GeocodeResult;
  distanceKm: number;
  etaMinutes: number;
  fare: number;
}

export type RideStatus =
  | 'IDLE'
  | 'REQUESTED'
  | 'ACCEPTED'        // Driver heading to pickup
  | 'ARRIVED_PICKUP'  // Driver at pickup, waiting for passenger to board
  | 'IN_PROGRESS'     // Passenger on board, driving to destination
  | 'COMPLETED'       // Trip done, showing summary
  | 'CANCELLED';      // Trip cancelled by driver or passenger

interface DriverState {
  // Online/Offline toggle
  isOnline: boolean;
  setIsOnline: (val: boolean) => void;

  // Ride state machine
  rideStatus: RideStatus;
  setRideStatus: (status: RideStatus) => void;

  // Current active ride request
  currentRide: RideRequest | null;
  setCurrentRide: (ride: RideRequest | null) => void;

  // Driver's own GPS location
  driverLocation: { lat: number; lng: number } | null;
  setDriverLocation: (coords: { lat: number; lng: number } | null) => void;

  // Route polyline (driver→pickup or pickup→dest)
  routeCoordinates: [number, number][] | null;
  setRouteCoordinates: (coords: [number, number][] | null) => void;

  cardNumber: string;
  setCardNumber: (num: string) => void;

  // Earnings data
  todayEarnings: number;
  tripHistory: TripRecord[];
  addTripRecord: (trip: TripRecord) => void;

  // Actions
  acceptRide: () => Promise<void>;
  rejectRide: () => void;
  moveToLocation: (lat: number, lng: number) => Promise<void>; // Smooth move to any target
  arrivedAtPickup: () => Promise<void>;
  passengerBoarded: () => Promise<void>;    // ARRIVED_PICKUP → IN_PROGRESS
  completeTrip: () => Promise<void>;        // IN_PROGRESS → COMPLETED
  cancelRide: () => Promise<void>;          // Any active → CANCELLED
  reset: () => void;               // COMPLETED / CANCELLED → IDLE

  // Driver profile
  driverProfile: {
    id: string;
    name: string;
    phone: string;
    plate: string;
    vehicle: string;
    rating: string;
    photoId: string;
  };
  setDriverProfile: (profile: any) => void;
  fetchDriverProfile: () => Promise<void>;
  updateDriverProfile: (data: { name?: string; phone?: string; vehicle?: string; plate?: string }) => Promise<void>;
  fetchRideHistory: () => Promise<void>;
  initializeSocketListeners: (driverId: string) => void;
  boostMatching: () => Promise<void>;
}

// Helper for local simulation (Frontend-only)
let simulationInterval: ReturnType<typeof setInterval> | null = null;

const stopSimulation = () => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
};

export const useDriverStore = create<DriverState>((set, get) => ({
  isOnline: false,
  setIsOnline: async (val) => {
    try {
      // First sync status
      await api.patch('/drivers/status', { status: val ? 'AVAILABLE' : 'OFFLINE' });

      if (val) {
        // Snap driver to real GPS position when going Online
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              set({ driverLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
            },
            () => { /* GPS unavailable, keep current */ },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
        // Refresh profile and sync status
        const res = await api.get('/drivers/me');
        if (res.data.data) {
          const dbDriver = res.data.data;
          const cleanName = typeof dbDriver.name === 'string' && !/^\d+$/.test(dbDriver.name) ? dbDriver.name : get().driverProfile.name;
          set({
            driverProfile: { ...get().driverProfile, ...dbDriver, name: cleanName },
            isOnline: true
          });
          rejoinDriverRoom(dbDriver.id);
        }
      } else {
        set({ isOnline: false });
      }
    } catch (err) {
      console.error('Failed to update driver status', err);
      set({ isOnline: val });
    }
  },

  rideStatus: 'IDLE',
  setRideStatus: (status) => set({ rideStatus: status }),

  currentRide: null,
  setCurrentRide: (ride) => set({ currentRide: ride }),

  driverLocation: null,
  setDriverLocation: (coords) => {
    set({ driverLocation: coords });
    const { currentRide, driverProfile } = get();
    if (coords && driverProfile.id) {
      const socket = getSocket();
      // Emit to backend so both driver map and passenger map stay in sync
      socket.emit('driver-location-update', {
        driverId: driverProfile.id,
        lat: coords.lat,
        lng: coords.lng,
        isAvailable: !currentRide,
        rideId: currentRide?.id
      });
      // Throttled DB sync
      api.put(`/drivers/${driverProfile.id}/location`, { location: `${coords.lat},${coords.lng}` })
        .catch(() => {});
    }
  },

  routeCoordinates: null,
  setRouteCoordinates: (coords) => set({ routeCoordinates: coords }),

  cardNumber: typeof window !== 'undefined' ? localStorage.getItem('driverCardNumber') || '' : '',
  setCardNumber: (num) => {
    if (typeof window !== 'undefined') localStorage.setItem('driverCardNumber', num);
    set({ cardNumber: num });
  },

  todayEarnings: 0,
  tripHistory: [],
  addTripRecord: (trip) =>
    set((state) => ({
      tripHistory: [trip, ...state.tripHistory],
      todayEarnings: Math.round(state.todayEarnings + trip.fare),
    })),

  acceptRide: async () => {
    const { currentRide, driverLocation } = get();
    if (!currentRide || !driverLocation) return;

    try {
      const response = await api.post(`/rides/booking/${currentRide.bookingId}/accept`);
      const ride = response.data.data;
      set({ rideStatus: 'ACCEPTED', currentRide: { ...currentRide, id: ride.id }, routeCoordinates: null });

      // PHASE 1 Simulation: Driver → Pickup
      // FOR DEMO: Snap driver to a position near the pickup point
      const pickupLat = currentRide.pickup.lat;
      const pickupLng = currentRide.pickup.lng;
      const nearbyOffset = 0.003; // ~300m offset
      const snapLat = pickupLat + (Math.random() - 0.5) * nearbyOffset;
      const snapLng = pickupLng + (Math.random() - 0.5) * nearbyOffset;
      set({ driverLocation: { lat: snapLat, lng: snapLng } });

      // PHASE 1 Simulation: Driver -> Pickup (~15-20s realistic speed)
      stopSimulation();
      const route = await RoutingService.getRoute(
        { lat: snapLat, lng: snapLng, address: '', name: 'Driver' },
        currentRide.pickup
      );

      if (route && route.length > 0) {
        set({ routeCoordinates: route });

        // Emit exact route to passenger so both sides sync perfectly
        const socket = getSocket();
        const rideId = get().currentRide?.id;
        if (rideId) {
          socket.emit('driver-route-update', { rideId, phase: 'pickup', route });
        }

        let step = 0;
        const TARGET_DURATION_MS = 3500; // ~3.5s to reach pickup
        const INTERVAL_MS = 100;         // smoother at 100ms
        const totalSteps = TARGET_DURATION_MS / INTERVAL_MS;
        const stepsPerTick = Math.max(1, Math.floor(route.length / totalSteps));

        simulationInterval = setInterval(() => {
          if (step >= route.length) {
            stopSimulation();
            return;
          }
          const [lat, lng] = route[step];
          get().setDriverLocation({ lat, lng });
          step += stepsPerTick;
        }, INTERVAL_MS);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept ride');
      set({ rideStatus: 'IDLE', currentRide: null });
    }
  },

  rejectRide: () =>
    set({ rideStatus: 'IDLE', currentRide: null, routeCoordinates: null }),

  arrivedAtPickup: async () => {
    const { currentRide } = get();
    if (!currentRide) return;
    try {
      stopSimulation();
      // Snap driver instantly to pickup location
      get().setDriverLocation({ lat: currentRide.pickup.lat, lng: currentRide.pickup.lng });
      await api.post(`/rides/${currentRide.id}/arrive`);
      set({ rideStatus: 'ARRIVED_PICKUP', routeCoordinates: null });
    } catch (err) {
      console.error('Failed to arrive at pickup', err);
    }
  },

  passengerBoarded: async () => {
    const { currentRide } = get();
    if (!currentRide) return;
    try {
      await api.post(`/rides/${currentRide.id}/start`);
      // Ensure driver starts from exact pickup before animating to destination
      get().setDriverLocation({ lat: currentRide.pickup.lat, lng: currentRide.pickup.lng });
      set({ rideStatus: 'IN_PROGRESS' });

      // PHASE 2 Simulation: Pickup -> Destination
      stopSimulation();
      const route = await RoutingService.getRoute(
        currentRide.pickup, 
        currentRide.destination
      );
      if (route && route.length > 0) {
        set({ routeCoordinates: route });

        // Emit exact destination route to passenger for sync
        const socket = getSocket();
        const rideId = get().currentRide?.id;
        if (rideId) {
          socket.emit('driver-route-update', { rideId, phase: 'destination', route });
        }

        let step = 0;
        const TARGET_DURATION_MS = 8000; // 8s for the full trip
        const INTERVAL_MS = 100;         // smooth movement
        const totalSteps = TARGET_DURATION_MS / INTERVAL_MS;
        const stepsPerTick = Math.max(1, Math.floor(route.length / totalSteps));

        simulationInterval = setInterval(() => {
          if (step >= route.length) {
            stopSimulation();
            return;
          }
          const [lat, lng] = route[step];
          get().setDriverLocation({ lat, lng });
          step += stepsPerTick;
        }, INTERVAL_MS);
      }
    } catch (err) {
      console.error('Failed to start ride', err);
    }
  },

  cancelRide: async () => {
    const { currentRide } = get();
    if (!currentRide) return;
    try {
      stopSimulation();
      await api.post(`/rides/${currentRide.id}/cancel`);
      set({ rideStatus: 'CANCELLED', routeCoordinates: null });
    } catch (err) {
      console.error('Failed to cancel ride', err);
    }
  },

  completeTrip: async () => {
    const { currentRide } = get();
    if (!currentRide) return;
    try {
      stopSimulation();
      // Snap driver instantly to destination
      get().setDriverLocation({ lat: currentRide.destination.lat, lng: currentRide.destination.lng });
      await api.post(`/rides/${currentRide.id}/complete`);
      const record: TripRecord = {
        id: currentRide.id || `trip-${Date.now()}`,
        passengerName: currentRide.passenger?.name || 'Khách hàng',
        pickup: currentRide.pickup.name || currentRide.pickup.address,
        destination: currentRide.destination.name || currentRide.destination.address,
        fare: currentRide.fare,
        distanceKm: currentRide.distanceKm,
        completedAt: new Date(),
      };
      get().addTripRecord(record);
      set({ rideStatus: 'COMPLETED' });
      
      // Auto-reset to IDLE after 3 seconds to return to real GPS
      setTimeout(() => {
        if (get().rideStatus === 'COMPLETED') {
          get().reset();
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to complete ride', err);
    }
  },

  reset: () => {
    stopSimulation();
    set({
      rideStatus: 'IDLE',
      currentRide: null,
      routeCoordinates: null
    });
  },

  moveToLocation: async (lat, lng) => {
    const loc = get().driverLocation;
    if (!loc) return;
    
    stopSimulation();
    try {
      const route = await RoutingService.getRoute(
        { lat: loc.lat, lng: loc.lng, address: '', name: 'Driver' },
        { lat, lng, address: '', name: 'Target' }
      );
      
      if (route.length > 0) {
        set({ routeCoordinates: route });
        let step = 0;
        simulationInterval = setInterval(() => {
          if (step >= route.length) {
            stopSimulation();
            set({ routeCoordinates: null });
            return;
          }
          const [sLat, sLng] = route[step];
          get().setDriverLocation({ lat: sLat, lng: sLng });
          step += Math.max(1, Math.floor(route.length / 40)); // Move across map in ~12s
        }, 300);
      }
    } catch (err) {
      console.error('Failed to move to location', err);
    }
  },

  driverProfile: {
    id: '',
    name: 'User',
    phone: '',
    plate: '51F-888.99',
    vehicle: 'Toyota Vios – Black',
    rating: '5.00',
    photoId: 'D-001',
  },

  setDriverProfile: (profile) => set({ driverProfile: { ...get().driverProfile, ...profile } }),

  fetchDriverProfile: async () => {
    try {
      const calls = [
        api.get('/drivers/me').catch(() => null),
        api.get('/users/profile').catch(() => null)
      ];
      const [driverRes, userRes] = await Promise.all(calls);

      const newProfile = { ...get().driverProfile };
      if (driverRes?.data?.data) {
        const dbDriver = driverRes.data.data;
        // Use driver's internal db name unless it's just an digits string
        const cleanName = typeof dbDriver.name === 'string' && !/^\d+$/.test(dbDriver.name) ? dbDriver.name : newProfile.name;
        Object.assign(newProfile, { ...dbDriver, name: cleanName });
      }
      if (userRes?.data?.data) {
        if (userRes.data.data.phone) newProfile.phone = userRes.data.data.phone;
        // Use user_db name as fallback if driver_db name is empty or numeric
        if (userRes.data.data.name && (!newProfile.name || /^\\d+$/.test(newProfile.name))) {
          newProfile.name = userRes.data.data.name;
        }
      }
      set({ driverProfile: newProfile });
    } catch (err) {
      console.error('Failed to fetch driver profile', err);
    }
  },

  updateDriverProfile: async (data) => {
    const { driverProfile } = get();
    try {
      const calls: Promise<any>[] = [];
      // name, vehicle, plate → driver-service
      if (driverProfile.id) {
        calls.push(api.patch(`/drivers/${driverProfile.id}/profile`, {
          name: data.name,
          vehicle: data.vehicle,
          plate: data.plate
        }));
      }
      // phone → user-service
      if (data.phone) {
        calls.push(api.patch('/users/profile', { phone: data.phone }));
      }
      await Promise.all(calls);
      set({ driverProfile: { ...driverProfile, ...data } });
      // Sync name to localStorage
      const userStr = localStorage.getItem('user');
      if (userStr && data.name) {
        const user = JSON.parse(userStr);
        user.name = data.name;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (err) {
      console.error('Failed to update driver profile', err);
    }
  },

  fetchRideHistory: async () => {
    const { driverProfile } = get();
    if (!driverProfile.id) return;
    try {
      // Fetch real earnings from driver record + completed rides in parallel
      const [driverRes, ridesRes] = await Promise.all([
        api.get('/drivers/me').catch(() => null),
        api.get(`/rides?driverId=${driverProfile.id}&status=COMPLETED`).catch(() => null),
      ]);

      // Update profile in case rating or other fields changed
      if (driverRes?.data?.data) {
        get().setDriverProfile(driverRes.data.data);
      }

      const rides = ridesRes?.data?.data || ridesRes?.data || [];
      if (Array.isArray(rides) && rides.length > 0) {
        const history: TripRecord[] = rides.map((r: any, i: number) => ({
          id: r.id || `ride-${i}`,
          passengerName: r.userName || r.passengerName || 'Khách hàng',
          pickup: r.pickupAddress || r.pickup || 'Điểm đón',
          destination: r.destinationAddress || r.destination || 'Điểm đến',
          fare: parseFloat(r.price || r.fare || '0'),
          distanceKm: parseFloat(r.distance || '0'),
          completedAt: new Date(r.completedAt || r.updatedAt || Date.now()),
        }));

        // Use DB totalEarnings if available & > 0, else fall back to sum from history
        const dbTotal = parseFloat(driverRes?.data?.data?.totalEarnings || '0');
        const historyTotal = history.reduce((sum, r) => sum + r.fare, 0);
        const finalTotal = Math.round(dbTotal > 0 ? dbTotal : historyTotal);

        set({ tripHistory: history, todayEarnings: finalTotal });

      } else {
        // No rides — still try DB total
        const dbTotal = parseFloat(driverRes?.data?.data?.totalEarnings || '0');
        if (dbTotal > 0) set({ todayEarnings: Math.round(dbTotal) });
      }
    } catch (err) {
      console.error('Failed to fetch ride history', err);
    }
  },


  initializeSocketListeners: (userId: string) => {
    const socket = getSocket();

    // Real-time passenger pickup pin sync — snap driver nearby when pin moves
    socket.on('passenger-location-preview', (coords: { lat: number; lng: number }) => {
      const { rideStatus } = get();
      if (rideStatus !== 'IDLE') return; // Don't interfere during active ride
      const offset = 0.002;
      get().setDriverLocation({
        lat: coords.lat + (Math.random() - 0.5) * offset,
        lng: coords.lng + (Math.random() - 0.5) * offset,
      });
    });

    socket.on('ride-status-updated', async (data) => {
      const { status, bookingId, rideId, pickup, destination, price, driverName, driverId, passengerName, userName, passengerRating } = data;
      console.log(`[Socket] Driver received ride update: ${status}. Assigned to Driver: ${driverId}. Me: ${get().driverProfile.id}`);
      console.log(`[Socket] Event data:`, { rideId, bookingId, passengerName, userName, passengerRating });

      // GUARD: Ignore assignments intended for other drivers
      if (status === 'DRIVER_ASSIGNED' && String(driverId) !== String(get().driverProfile.id)) {
        console.log('[Socket] Assignment ignored: Not for me.');
        return;
      }

      if (status === 'DRIVER_ASSIGNED') {
        // New ride request incoming!
        if (get().isOnline && !get().currentRide) {
          const [pLat, pLng] = pickup.split(',').map(parseFloat);
          const [dLat, dLng] = destination.split(',').map(parseFloat);

          // Geocode coordinates into real addresses
          const [pGeo, dGeo] = await Promise.all([
            GeocodeService.reverseGeocode(pLat, pLng),
            GeocodeService.reverseGeocode(dLat, dLng)
          ]);

          // Use enriched data from ride-service socket event — real names/ratings
          const pName = data.passengerName || 'Khách hàng';
          const pRating = data.passengerRating || '5.0';
          const tripDistanceKm = data.distanceKm || 0;

          console.log(`[Store] Passenger: ${pName}, rating: ${pRating}, distance: ${tripDistanceKm}km`);

          // Snap driver to a position near the pickup point
          const pickupLat = pLat + (Math.random() - 0.5) * 0.003;
          const pickupLng = pLng + (Math.random() - 0.5) * 0.003;
          get().setDriverLocation({ lat: pickupLat, lng: pickupLng });

          set({
            rideStatus: 'REQUESTED',
            currentRide: {
              id: rideId || `ride-${Date.now()}`,
              bookingId: bookingId,
              passenger: { name: pName, rating: pRating },
              pickup: pGeo || { lat: pLat, lng: pLng, name: 'Pickup Point', address: pickup },
              destination: dGeo || { lat: dLat, lng: dLng, name: 'Destination Point', address: destination },
              distanceKm: tripDistanceKm,
              etaMinutes: 5,
              fare: price || 0
            }
          });
        }
      } else if (status === 'CANCELLED') {
        // Ride was cancelled
        if (get().currentRide?.id === rideId || get().currentRide?.bookingId === bookingId) {
          set({ rideStatus: 'CANCELLED', currentRide: null, routeCoordinates: null });
          alert('Ride was cancelled');
        }
      } else {
        // Other status updates (ACCEPTED, STARTED, etc.)
        // Usually the driver is the one initiating these, but we sync anyway
        if (status === 'STARTED') set({ rideStatus: 'IN_PROGRESS' });
        if (status === 'COMPLETED') set({ rideStatus: 'COMPLETED' });
      }
    });
  },

  boostMatching: async () => {
    const { driverProfile, isOnline, driverLocation } = get();
    if (!isOnline || !driverProfile.id || !driverLocation) {
      alert('Cannot boost: GPS location not yet detected. Please wait a moment and try again.');
      return;
    }

    try {
      console.log(`[Boost] Syncing current GPS (${driverLocation.lat}, ${driverLocation.lng}) for priority matching...`);

      const socket = getSocket();
      socket.emit('driver-location-update', {
        driverId: driverProfile.id,
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        isAvailable: true
      });

      await api.put(`/drivers/${driverProfile.id}/location`, {
        location: `${driverLocation.lat},${driverLocation.lng}`
      });
      alert('Match Boost Activated: Your location is now synced for optimal matching!');
    } catch (err) {
      console.error('Boost failed', err);
    }
  }
}));
