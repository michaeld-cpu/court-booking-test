import { Court, Operator } from '../types';

export const operators: Operator[] = [
  {
    id: 'op1',
    name: 'Dumaguete Sports Hub',
    location: 'Rizal Boulevard',
    city: 'Dumaguete City',
    description: 'Premier sports facility in Dumaguete offering basketball, pickleball, and badminton courts. We provide top-notch facilities with excellent amenities for athletes and sports enthusiasts.',
    amenities: ['Parking', 'Restrooms', 'Water Station', 'Covered Courts', 'Equipment Rental', 'LED Lighting', 'Scoreboard', 'Locker Rooms'],
    rating: 4.8,
    phone: '+63 935 123 4567',
    email: 'info@dumaguesportshub.com',
    operatingHours: '8:00 AM - 10:00 PM',
    image: 'https://images.unsplash.com/photo-1759352642316-25f20e12bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcG9ydHMlMjBmYWNpbGl0eSUyMGJ1aWxkaW5nfGVufDF8fHx8MTc2NjExMTYwNXww&ixlib=rb-4.1.0&q=60&w=640&utm_source=figma&utm_medium=referral',
    profileImage: 'https://images.unsplash.com/photo-1629507208649-70919ca33793?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMHBvcnRyYWl0fGVufDF8fHx8MTc2NjM2NjQwOXww&ixlib=rb-4.1.0&q=60&w=256&utm_source=figma&utm_medium=referral',
    coordinates: {
      lat: 9.3068,
      lng: 123.3054
    },
    socialMedia: {
      facebook: 'https://facebook.com/dumaguesportshub',
      instagram: 'https://instagram.com/dumaguesportshub',
      twitter: 'https://twitter.com/dumaguesportshub'
    }
  }
];

export const mockCourts: Court[] = [

  {
    id: '3',
    name: 'Court A',
    type: 'pickleball',
    operatorId: 'op1',
    operatorName: 'Dumaguete Sports Hub',
    location: 'Rizal Boulevard',
    city: 'Dumaguete City',
    image: 'pickleball court',
    amenities: ['Parking', 'Restrooms', 'Equipment Rental', 'Outdoor'],
    rating: 4.9,
    pricePerHour: 250,
    availableSlots: [
      { id: 's1', time: '08:00 AM', available: true, price: 250 },
      { id: 's2', time: '09:00 AM', available: true, price: 250 },
      { id: 's3', time: '10:00 AM', available: true, price: 250 },
      { id: 's4', time: '11:00 AM', available: true, price: 250 },
      { id: 's5', time: '12:00 PM', available: true, price: 300 },
      { id: 's6', time: '01:00 PM', available: false, price: 300 },
      { id: 's7', time: '02:00 PM', available: true, price: 300 },
      { id: 's8', time: '03:00 PM', available: true, price: 300 },
      { id: 's9', time: '04:00 PM', available: true, price: 350 },
      { id: 's10', time: '05:00 PM', available: true, price: 350 },
      { id: 's11', time: '06:00 PM', available: true, price: 350 },
      { id: 's12', time: '07:00 PM', available: true, price: 350 },
    ],
  },
  {
    id: '3b',
    name: 'Court B',
    type: 'pickleball',
    operatorId: 'op1',
    operatorName: 'Dumaguete Sports Hub',
    location: 'Rizal Boulevard',
    city: 'Dumaguete City',
    image: 'pickleball court',
    amenities: ['Parking', 'Restrooms', 'Equipment Rental', 'Covered Court'],
    rating: 4.8,
    pricePerHour: 250,
    availableSlots: [
      { id: 's1', time: '08:00 AM', available: true, price: 250 },
      { id: 's2', time: '09:00 AM', available: false, price: 250 },
      { id: 's3', time: '10:00 AM', available: true, price: 250 },
      { id: 's4', time: '11:00 AM', available: true, price: 250 },
      { id: 's5', time: '12:00 PM', available: true, price: 300 },
      { id: 's6', time: '01:00 PM', available: true, price: 300 },
      { id: 's7', time: '02:00 PM', available: true, price: 300 },
      { id: 's8', time: '03:00 PM', available: false, price: 300 },
      { id: 's9', time: '04:00 PM', available: true, price: 350 },
      { id: 's10', time: '05:00 PM', available: true, price: 350 },
      { id: 's11', time: '06:00 PM', available: true, price: 350 },
      { id: 's12', time: '07:00 PM', available: true, price: 350 },
    ],
  }
];

export const cities = ['Dumaguete City'];