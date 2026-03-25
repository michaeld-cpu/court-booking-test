export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  price: number;
}

export interface Court {
  purpose?: string;
  isCovered?: string;
  id: string;
  name: string;
  type: string;
  operatorId: string;
  operatorName: string;
  location: string;
  city: string;
  image: string;
  amenities: string[];
  rating: number;
  pricePerHour: number;
  availableSlotCount?: number;
  availableSlots: TimeSlot[];
}

export interface Operator {
  id: string;
  name: string;
  location: string;
  city: string;
  isCovered?: string;
  description: string;
  amenities: string[];
  rating: number;
  phone: string;
  email: string;
  operatingHours: string;
  websiteUrl?: string;
  image: string;
  profileImage?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

export interface Booking {
  id: string;
  courtId: string;
  courtName: string;
  courtType: string;
  status?: string;
  guestName?: string;
  contactNumber?: string;
  venueContactNumber?: string;
  venueWebsiteUrl?: string;
  venueFacebookLink?: string;
  image?: string;
  bookingCourts?: Array<{
    id: number | string;
    court: {
      id: number | string;
      number?: number | string;
      is_covered?: string;
      booking_price?: string | number;
      purpose?: string;
      type?: string;
    };
    slot_count?: number;
    subtotal_amount?: string | number;
    slots?: Array<{
      id: number | string;
      date?: string;
      start_time?: string;
      end_time?: string;
      price?: string | number;
      is_available?: boolean;
    }>;
  }>;
  date: string;
  expiresAfterTs?: string;
  timeSlotFrom: string;
  timeSlotTo: string;
  price: number;
  operatorId: string;
  operatorName: string;
  location: string;
  city: string;
}

export interface CartItem {
  id: string;
  courtId: string;
  courtName: string;
  courtType: string;
  date: Date;
  timeSlotFrom: string;
  timeSlotTo: string;
  timeSlots: string[]; // Array of individual time slot labels (e.g., ["9:00 AM - 10:00 AM", "10:00 AM - 11:00 AM"])
  price: number;
  operatorId: string;
  operatorName: string;
}
