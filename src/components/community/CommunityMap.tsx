```tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Map, Marker, Popup, NavigationControl, GeolocateControl, ScaleControl } from 'react-map-gl';
import { MapPin, Users, Calendar, Briefcase, Search, Filter, Settings, Eye, EyeOff, MapIcon, Navigation, Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Toggle } from '@/components/ui/toggle';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CommunityMapProps {
  mapboxToken: string;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  members?: CommunityMember[];
  groups?: CommunityGroup[];
  events?: CommunityEvent[];
  projects?: CommunityProject[];
  onLocationShare?: (location: GeolocationCoordinates, privacyLevel: PrivacyLevel) => void;
  onMemberConnect?: (memberId: string) => void;
  onGroupJoin?: (groupId: string) => void;
  onEventAttend?: (eventId: string) => void;
  onProjectCollaborate?: (projectId: string) => void;
  onGeospatialSearch?: (query: GeospatialSearchQuery) => Promise<SearchResults>;
  className?: string;
}

interface CommunityMember {
  id: string;
  name: string;
  avatar?: string;
  location: {
    longitude: number;
    latitude: number;
  };
  privacyLevel: PrivacyLevel;
  skills: string[];
  interests: string[];
  lastActive: Date;
  isOnline: boolean;
  bio?: string;
  projects: string[];
  groups: string[];
}

interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  location: {
    longitude: number;
    latitude: number;
  };
  memberCount: number;
  category: string;
  isPublic: boolean;
  tags: string[];
  meetingSchedule?: string;
  nextEvent?: Date;
}

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  location: {
    longitude: number;
    latitude: number;
  };
  startDate: Date;
  endDate: Date;
  attendeeCount: number;
  maxAttendees?: number;
  category: string;
  isVirtual: boolean;
  organizer: string;
  tags: string[];
}

interface CommunityProject {
  id: string;
  title: string;
  description: string;
  location?: {
    longitude: number;
    latitude: number;
  };
  collaboratorCount: number;
  status: 'planning' | 'active' | 'completed';
  skills: string[];
  category: string;
  deadline?: Date;
  owner: string;
  tags: string[];
}

type PrivacyLevel = 'public' | 'community' | 'connections' | 'private';

interface GeospatialSearchQuery {
  query: string;
  location: {
    longitude: number;
    latitude: number;
  };
  radius: number;
  filters: {
    members: boolean;
    groups: boolean;
    events: boolean;
    projects: boolean;
  };
}

interface SearchResults {
  members: CommunityMember[];
  groups: CommunityGroup[];
  events: CommunityEvent[];
  projects: CommunityProject[];
}

interface MapFilters {
  members: boolean;
  groups: boolean;
  events: boolean;
  projects: boolean;
  radiusKm: number;
  categories: string[];
  skills: string[];
}

interface UserLocation {
  longitude: number;
  latitude: number;
  privacyLevel: PrivacyLevel;
  lastUpdated: Date;
}

const CommunityMap: React.FC<CommunityMapProps> = ({
  mapboxToken,
  initialViewState = {
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 10
  },
  members = [],
  groups = [],
  events = [],
  projects = [],
  onLocationShare,
  onMemberConnect,
  onGroupJoin,
  onEventAttend,
  onProjectCollaborate,
  onGeospatialSearch,
  className = ""
}) => {
  const mapRef = useRef<any>(null);
  
  // State management
  const [viewState, setViewState] = useState(initialViewState);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [filters, setFilters] = useState<MapFilters>({
    members: true,
    groups: true,
    events: true,
    projects: true,
    radiusKm: 5,
    categories: [],
    skills: []
  });
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showNearbyPanel, setShowNearbyPanel] = useState(false);
  const [nearbyItems, setNearbyItems] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);

  // Request location permission on mount
  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setHasLocationPermission(false);
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setHasLocationPermission(permission.state === 'granted');
      
      if (permission.state === 'prompt') {
        setShowLocationDialog(true);
      }
    } catch (error) {
      setShowLocationDialog(true);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) return;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      const newLocation: UserLocation = {
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        privacyLevel: 'community',
        lastUpdated: new Date()
      };

      setUserLocation(newLocation);
      setViewState(prev => ({
        ...prev,
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        zoom: 12
      }));

      if (onLocationShare) {
        onLocationShare(position.coords, 'community');
      }

      setShowLocationDialog(false);
      setHasLocationPermission(true);
    } catch (error) {
      console.error('Location request failed:', error);
    }
  }, [onLocationShare]);

  // Search functionality
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !userLocation || !onGeospatialSearch) return;

    setIsSearching(true);
    try {
      const searchQuery: GeospatialSearchQuery = {
        query: query.trim(),
        location: userLocation,
        radius: filters.radiusKm * 1000, // Convert to meters
        filters: {
          members: filters.members,
          groups: filters.groups,
          events: filters.events,
          projects: filters.projects
        }
      };

      const results = await onGeospatialSearch(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [userLocation, filters, onGeospatialSearch]);

  // Filter data based on current filters and user location
  const filteredData = useMemo(() => {
    const filterByDistance = (item: any) => {
      if (!userLocation || !item.location) return true;
      
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        item.location.latitude,
        item.location.longitude
      );
      
      return distance <= filters.radiusKm;
    };

    return {
      members: filters.members ? members.filter(filterByDistance) : [],
      groups: filters.groups ? groups.filter(filterByDistance) : [],
      events: filters.events ? events.filter(filterByDistance) : [],
      projects: filters.projects ? projects.filter(filterByDistance) : []
    };
  }, [members, groups, events, projects, filters, userLocation]);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

  // Find nearby items
  useEffect(() => {
    if (!userLocation) return;

    const nearby = [
      ...filteredData.members.map(m => ({ ...m, type: 'member', distance: calculateDistance(userLocation.latitude, userLocation.longitude, m.location.latitude, m.location.longitude) })),
      ...filteredData.groups.map(g => ({ ...g, type: 'group', distance: calculateDistance(userLocation.latitude, userLocation.longitude, g.location.latitude, g.location.longitude) })),
      ...filteredData.events.map(e => ({ ...e, type: 'event', distance: calculateDistance(userLocation.latitude, userLocation.longitude, e.location.latitude, e.location.longitude) })),
      ...filteredData.projects.map(p => p.location ? ({ ...p, type: 'project', distance: calculateDistance(userLocation.latitude, userLocation.longitude, p.location.latitude, p.location.longitude) }) : null).filter(Boolean)
    ].sort((a, b) => (a?.distance || 0) - (b?.distance || 0));

    setNearbyItems(nearby);
  }, [userLocation, filteredData, calculateDistance]);

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'member': return MapPin;
      case 'group': return Users;
      case 'event': return Calendar;
      case 'project': return Briefcase;
      default: return MapPin;
    }
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'member': return 'bg-blue-500';
      case 'group': return 'bg-green-500';
      case 'event': return 'bg-purple-500';
      case 'project': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const updatePrivacyLevel = (level: PrivacyLevel) => {
    if (userLocation) {
      const updatedLocation = { ...userLocation, privacyLevel: level };
      setUserLocation(updatedLocation);
      if (onLocationShare && userLocation) {
        onLocationShare({
          longitude: userLocation.longitude,
          latitude: userLocation.latitude
        } as GeolocationCoordinates, level);
      }
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Location Permission Dialog */}
      <AlertDialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Enable Location Services
            </AlertDialogTitle>
            <AlertDialogDescription>
              To connect with nearby community members and discover local groups, events, and projects, 
              we need access to your location. Your privacy is protected with granular sharing controls.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Maybe Later</AlertDialogCancel>
            <AlertDialogAction onClick={requestLocation}>
              Enable Location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search community members, groups, events, projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
            className="pl-10 bg-background/80 backdrop-blur-sm"
            disabled={!userLocation}
          />
        </div>
        <Button 
          onClick={() => handleSearch(searchQuery)}
          disabled={isSearching || !userLocation}
          size="default"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {/* Map Controls */}
      <div className="absolute top-20 right-4 z-10 flex flex-col gap-2">
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm" className="bg-background/80 backdrop-blur-sm">
              <Filter className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Map Filters</SheetTitle>
              <SheetDescription>
                Customize what you see on the community map
              </SheetDescription>
            </SheetHeader>
            
            <div className="space-y-6 mt-6">
              <div>
                <Label className="text-sm font-medium">Show on Map</Label>
                <div className="space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="members-toggle" className="text-sm">Community Members</Label>
                    <Switch
                      id="members-toggle"
                      checked={filters.members}
                      onCheckedChange={(checked) => setFilters(prev => ({ ...prev, members: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="groups-toggle" className="text-sm">Local Groups</Label>
                    <Switch
                      id="groups-toggle"
                      checked={filters.groups}
                      onCheckedChange={(checked) => setFilters(prev => ({ ...prev, groups: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="events-toggle" className="text-sm">Events</Label>
                    <Switch
                      id="events-toggle"
                      checked={filters.events}
                      onCheckedChange={(checked) => setFilters(prev => ({ ...prev, events: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="projects-toggle" className="text-sm">Projects</Label>
                    <Switch
                      id="projects-toggle"
                      checked={filters.projects}
                      onCheckedChange={(checked) => setFilters(prev => ({ ...prev, projects: checked }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium">Search Radius: {filters.radiusKm}km</Label>
                <Slider
                  value={[filters.radiusKm]}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, radiusKm: value[0] }))}
                  max={50}
                  min={1}
                  step={1}
                  className="mt-3"
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={showNearbyPanel} onOpenChange={setShowNearbyPanel}>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm" className="bg-background/80 backdrop-blur-sm">
              <MapIcon className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Nearby Activity</SheetTitle>
              <SheetDescription>
                Community members, groups, events, and projects near you
              </SheetDescription>
            </SheetHeader>
            
            <ScrollArea className="h-[calc(100vh-200px)] mt-6">
              <div className="space-y-4">
                {nearbyItems.map((item, index) => {
                  const Icon = getMarkerIcon(item.type);
                  return (
                    <Card key={`${item.type}-${item.id}`} className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-full ${getMarkerColor(item.type)}`}>
                              <Icon className="w-3 h-3 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-sm">{item.name || item.title}</CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                {item.distance?.toFixed(1)}km away
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description || item.bio}
                        </p>
                        {item.type === 'member' && (
                          <div className="flex gap-1 mt-2">
                            {item.skills?.slice(0, 2).map((skill: string) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="bg-background/80 backdrop-blur-sm">
              <Settings className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Privacy Controls</DialogTitle>
              <DialogDescription>
                Control who can see your location and connect with you
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Location Sharing</Label>
                <div className="space-y-3 mt-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="public"
                      name="privacy"
                      checked={userLocation?.privacyLevel === 'public'}
                      onChange={() => updatePrivacyLevel('public')}
                      className="w-4 h-4"
                    />
                    <div>
                      <Label htmlFor="public" className="text-sm font-medium">Public</Label>
                      <p className="text-xs text-muted-foreground">Visible to everyone in the community</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="community"
                      name="privacy"
                      checked={userLocation?.privacyLevel === 'community'}
                      onChange={() => updatePrivacyLevel('community')}
                      className="w-4 h-4"
                    />
                    <div>
                      <Label htmlFor="community" className="text-sm font-medium">Community Members</Label>
                      <p className="text-xs text-muted-foreground">Visible to verified community members only</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="connections"
                      name="privacy"
                      checked={userLocation?.privacyLevel === 'connections'}
                      onChange={() => updatePrivacyLevel('connections')}
                      className="w-4