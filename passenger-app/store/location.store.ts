import { create } from 'zustand';
import { GeocodeResult } from '@/services/geocode.service';
import api from '@/services/api';
import { getSocket } from '@/services/socket';
import { RoutingService } from '@/services/routing.service';

// Module-level simulation interval for driver movement on passenger side
let driverSimInterval: ReturnType<typeof setInterval> | null = null;
const stopDriverSim = () => { if (driverSimInterval) { clearInterval(driverSimInterval); driverSimInterval = null; } };

export type AppState = 'map' | 'search' | 'confirm' | 'finding_driver' | 'driver_on_way' | 'driver_arrived' | 'riding' | 'arrived' | 'payment' | 'payment_done' | 'reviewed';

export type PaymentMethod = 'cash' | 'card';
export type VehicleType = 'bike' | 'economy' | 'premium';

interface DriverDetails {
  id?: number | string;
  name: string;
  plate: string;
  vehicle: string;
  rating: string;
  eta: number;
}

export interface UserProfile {
  name: string;
  phone: string;
  email: string;
}

interface LocationState {
  uiState: AppState;
  setUiState: (state: AppState) => void;

  pickup: GeocodeResult | null;
  destination: GeocodeResult | null;
  setPickup: (location: GeocodeResult) => void;
  setDestination: (location: GeocodeResult | null) => void;

  mapCenter: { lat: number; lng: number } | null;
  setMapCenter: (coords: { lat: number; lng: number }) => void;

  isReverseGeocoding: boolean;
  setIsReverseGeocoding: (loading: boolean) => void;

  routeCoordinates: [number, number][] | null;
  setRouteCoordinates: (coords: [number, number][] | null) => void;

  driverApproachCoords: [number, number][] | null; // Driver's route to pickup
  setDriverApproachCoords: (coords: [number, number][] | null) => void;

  activeBookingId: string | null;
  setActiveBookingId: (id: string | null) => void;

  currentRideId: string | null; // For joining the ride socket room

  driverDetails: DriverDetails | null;
  setDriverDetails: (driver: DriverDetails | null) => void;
  driverLocation: { lat: number; lng: number } | null;
  setDriverLocation: (coords: { lat: number; lng: number } | null) => void;

  vehicleType: VehicleType;
  setVehicleType: (type: VehicleType) => void;
  distanceKm: number;
  setDistanceKm: (km: number) => void;

  fare: number;
  setFare: (amount: number) => void;
  selectedPaymentMethod: PaymentMethod;
  setSelectedPaymentMethod: (method: PaymentMethod) => void;

  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile) => void;
  fetchUserProfile: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string; cardNumber?: string }) => Promise<void>;
  cardNumber: string;
  setCardNumber: (num: string) => void;

  searchType: 'pickup' | 'destination';
  setSearchType: (type: 'pickup' | 'destination') => void;

  createBooking: () => Promise<void>;
  initializeSocketListeners: (userId: string) => void;
  clearPaymentData: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  uiState: 'map',
  setUiState: (state) => set({ uiState: state }),

  pickup: null,
  destination: null,
  setPickup: (location) => {
    set({ pickup: location });
    // Broadcast pickup to driver app via socket (cross-origin real-time sync)
    try {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('passenger-location-preview', { lat: location.lat, lng: location.lng });
      }
    } catch { /* socket not ready */ }
  },
  setDestination: (location) => set({ destination: location }),

  mapCenter: null,
  setMapCenter: (coords) => {
    set({ mapCenter: coords });
    // Also broadcast map center drags via socket
    try {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('passenger-location-preview', coords);
      }
    } catch { /* socket not ready */ }
  },

  isReverseGeocoding: false,
  setIsReverseGeocoding: (loading) => set({ isReverseGeocoding: loading }),

  routeCoordinates: null,
  setRouteCoordinates: (coords) => set({ routeCoordinates: coords }),

  driverApproachCoords: null,
  setDriverApproachCoords: (coords) => set({ driverApproachCoords: coords }),

  activeBookingId: null,
  setActiveBookingId: (id) => set({ activeBookingId: id }),

  currentRideId: null,

  driverDetails: null,
  setDriverDetails: (driver) => set({ driverDetails: driver }),

  driverLocation: null,
  setDriverLocation: (coords) => set({ driverLocation: coords }),

  vehicleType: 'economy' as VehicleType,
  setVehicleType: (type) => set({ vehicleType: type }),
  distanceKm: 0,
  setDistanceKm: (km) => set({ distanceKm: km }),

  fare: 0,
  setFare: (amount) => set({ fare: amount }),
  selectedPaymentMethod: (typeof window !== 'undefined' ? localStorage.getItem('selectedPaymentMethod') || 'cash' : 'cash') as PaymentMethod,
  setSelectedPaymentMethod: (method) => {
    if (typeof window !== 'undefined') localStorage.setItem('selectedPaymentMethod', method);
    set({ selectedPaymentMethod: method });
  },

  cardNumber: typeof window !== 'undefined' ? localStorage.getItem('cardNumber') || '' : '',
  setCardNumber: (num) => {
    if (typeof window !== 'undefined') localStorage.setItem('cardNumber', num);
    set({ cardNumber: num });
  },

  userProfile: {
    name: '',
    phone: '',
    email: '',
  },
  setUserProfile: (profile) => set({ userProfile: profile }),
  fetchUserProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      if (response.data?.data) {
        set({
          userProfile: {
            name: response.data.data.name || '',
            phone: response.data.data.phone || '',
            email: response.data.data.email || ''
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch user profile', err);
    }
  },
  updateProfile: async (data) => {
    try {
      const response = await api.patch('/users/profile', data);
      if (response.data?.data) {
        set({ userProfile: response.data.data });
        // Sync name to localStorage
        const userStr = localStorage.getItem('user');
        if (userStr && data.name) {
          const user = JSON.parse(userStr);
          user.name = data.name;
          localStorage.setItem('user', JSON.stringify(user));
        }
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  },

  searchType: 'destination',
  setSearchType: (type) => set({ searchType: type }),

  createBooking: async () => {
    const { pickup, destination, fare, distanceKm, vehicleType, routeCoordinates } = get();
    if (!pickup || !destination) return;

    set({ uiState: 'finding_driver' });

    try {
      const response = await api.post('/bookings', {
        pickup: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        price: fare || 30000,
        distance: distanceKm || 2.5,
        vehicleType,
        routeData: routeCoordinates
      });

      const booking = response.data.data;
      if (booking) {
        set({ activeBookingId: booking.id });
      } else if (response.data.message === 'No drivers available') {
        alert('No drivers available at the moment. Please try again later.');
        set({ uiState: 'confirm' });
      }
    } catch (err) {
      console.error('Failed to create booking', err);
      set({ uiState: 'confirm' });
    }
  },

  initializeSocketListeners: (userId: string) => {
    const socket = getSocket();

    socket.on('ride-status-updated', (data) => {
      const { status, driverName, driverVehicle, driverPlate, plate, driverRating, rideId, bookingId, driverId } = data;
      const currentBookingId = get().activeBookingId;

      if (!currentBookingId || String(bookingId) !== String(currentBookingId)) {
        return;
      }

      switch (status) {
        case 'DRIVER_ASSIGNED':
          // Store driver info when first assigned — will be used in ACCEPTED state
          set({
            uiState: 'finding_driver',
            driverDetails: driverName ? {
              id: driverId,
              name: driverName,
              plate: driverPlate || plate || '...',
              vehicle: driverVehicle || 'Sedan',
              rating: driverRating || '5.0',
              eta: 5
            } : null
          });
          break;
        case 'ACCEPTED': {
          const { pickup } = get();
          const socket = getSocket();

          // CRITICAL: Join the ride room so we receive real driver-location-updated events
          if (rideId) {
            socket.emit('join-ride', rideId);
            set({ currentRideId: rideId });
          }

          // Place driver near pickup
          if (pickup) {
            const offset = 0.003; // ~300m nearby — large enough route to see
            const startLat = pickup.lat + (Math.random() > 0.5 ? 1 : -1) * (offset * 0.5 + Math.random() * offset);
            const startLng = pickup.lng + (Math.random() > 0.5 ? 1 : -1) * (offset * 0.5 + Math.random() * offset);
            set({ driverLocation: { lat: startLat, lng: startLng } });

            // Fetch approach route for display (green dashed line)
            RoutingService.getRoute(
              { lat: startLat, lng: startLng, address: '', name: 'Driver' } as GeocodeResult,
              pickup
            ).then(({ coords }) => {
              if (!coords.length) return;
              set({ driverApproachCoords: coords });
              // Animate driver along this route (fallback if socket relay fails)
              stopDriverSim();
              let step = 0;
              const stepsPerTick = Math.max(1, Math.floor(coords.length / (3500 / 100)));
              driverSimInterval = setInterval(() => {
                if (step >= coords.length) { stopDriverSim(); return; }
                set({ driverLocation: { lat: coords[step][0], lng: coords[step][1] } });
                step += stepsPerTick;
              }, 100);
            });
          }
          set({
            uiState: 'driver_on_way',
            driverDetails: {
              id: driverId || get().driverDetails?.id,
              name: driverName || get().driverDetails?.name || 'Driver',
              plate: driverPlate || plate || get().driverDetails?.plate || '...',
              vehicle: driverVehicle || get().driverDetails?.vehicle || 'Sedan',
              rating: driverRating || get().driverDetails?.rating || '5.0',
              eta: 5
            }
          });
          break;
        }
        case 'ARRIVED':
          stopDriverSim();
          // Snap driver exactly to pickup when arrived
          if (get().pickup) set({ driverLocation: { lat: get().pickup!.lat, lng: get().pickup!.lng } });
          set({
            uiState: 'driver_arrived',
            driverDetails: {
              id: driverId || get().driverDetails?.id,
              name: driverName || get().driverDetails?.name || 'Driver',
              plate: driverPlate || plate || get().driverDetails?.plate || '...',
              vehicle: driverVehicle || get().driverDetails?.vehicle || 'Sedan',
              rating: driverRating || get().driverDetails?.rating || '5.0',
              eta: 0
            }
          });
          break;
        case 'STARTED': {
          const { pickup, destination } = get();
          set({ uiState: 'riding', driverApproachCoords: null }); // Clear approach route

          // Show pickup→destination route (routeCoordinates from booking)
          // If not already set, fetch it now
          if (pickup && destination && !get().routeCoordinates) {
            RoutingService.getRoute(pickup, destination).then(({ coords }) => {
              if (coords.length) set({ routeCoordinates: coords });
            });
          }

          // Animate driver from pickup → destination (fallback simulation)
          if (pickup && destination) {
            set({ driverLocation: { lat: pickup.lat, lng: pickup.lng } });
            RoutingService.getRoute(pickup, destination).then(({ coords }) => {
              if (!coords.length) return;
              stopDriverSim();
              let step = 0;
              const stepsPerTick = Math.max(1, Math.floor(coords.length / (8000 / 100)));
              driverSimInterval = setInterval(() => {
                if (step >= coords.length) { stopDriverSim(); return; }
                set({ driverLocation: { lat: coords[step][0], lng: coords[step][1] } });
                step += stepsPerTick;
              }, 100);
            });
          }
          break;
        }
        case 'COMPLETED': {
          stopDriverSim();
          // Snap driver to destination (where passenger completed trip)
          const dest = get().destination;
          if (dest) set({ driverLocation: { lat: dest.lat, lng: dest.lng } });
          set({ uiState: 'arrived' });
          setTimeout(() => {
            if (get().uiState === 'arrived') set({ uiState: 'payment' });
          }, 2500);
          break;
        }
        case 'CANCELLED':
        case 'NO_DRIVER_FOUND':
          set({
            uiState: 'confirm',
            activeBookingId: null,
            driverDetails: null,
            driverLocation: null
          });
          if (status === 'NO_DRIVER_FOUND') {
            alert('Could not find a driver near you. Please try again.');
          }
          break;
      }
    });

    socket.on('driver-location-updated', (data) => {
      if (data.location) {
        const lat = Array.isArray(data.location) ? data.location[0] : data.location.lat;
        const lng = Array.isArray(data.location) ? data.location[1] : data.location.lng;
        set({ driverLocation: { lat, lng } });
      }
    });

    socket.on('driverLocationUpdate', (location) => {
      if (location) {
        const lat = Array.isArray(location) ? location[0] : location.lat;
        const lng = Array.isArray(location) ? location[1] : location.lng;
        set({ driverLocation: { lat, lng } });
      }
    });

    // Receives exact OSRM route from driver for pixel-perfect sync
    socket.on('driver-route-update', (data: { phase: 'pickup' | 'destination'; route: [number, number][] }) => {
      if (!data?.route?.length) return;
      stopDriverSim(); // Stop local fallback simulation — real data has arrived

      if (data.phase === 'pickup') {
        // Show driver's real approach route as green dashed line
        set({ driverApproachCoords: data.route });
        // Set driver at the START of the route (exact same start as driver app)
        set({ driverLocation: { lat: data.route[0][0], lng: data.route[0][1] } });
      } else if (data.phase === 'destination') {
        // Show full pickup→destination route as blue line
        set({ routeCoordinates: data.route, driverApproachCoords: null });
        // Set driver at pickup (start of destination route)
        set({ driverLocation: { lat: data.route[0][0], lng: data.route[0][1] } });
      }
    });
  },

  clearPaymentData: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cardNumber');
      localStorage.removeItem('selectedPaymentMethod');
    }
    set({
      cardNumber: '',
      selectedPaymentMethod: 'cash'
    });
  }
}));
