# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a **court booking application** built with React, TypeScript, Vite, and Tailwind CSS v4. The app allows users to browse sports facilities (operators), view available courts (basketball, pickleball, badminton, tennis, volleyball), book time slots, and manage their bookings. The application uses mock data and localStorage for authentication (no backend currently).

## Development Commands

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```
The development server runs on `http://localhost:5173` (default Vite port).

### Production Build
```bash
npm run build
```
Build output goes to the `dist/` directory.

### Preview Production Build
```bash
npx vite preview
```

## Code Architecture

### Application Structure

```
src/
├── main.tsx                    # Application entry point
├── app/
│   ├── App.tsx                # Root component with routing and global state
│   ├── types.ts               # TypeScript interfaces for core domain models
│   ├── contexts/
│   │   └── AuthContext.tsx    # Authentication context using localStorage
│   ├── data/
│   │   └── mockData.ts        # Mock data for operators and courts
│   ├── pages/                 # Route-level page components
│   │   ├── HomePage.tsx
│   │   ├── OperatorPage.tsx
│   │   ├── MyBookings.tsx
│   │   ├── MyBookmarks.tsx
│   │   ├── ContactUs.tsx
│   │   ├── TermsPage.tsx
│   │   └── PrivacyPage.tsx
│   └── components/            # Reusable components
│       ├── ui/                # shadcn/ui components
│       ├── figma/             # Figma-exported components
│       ├── Cart.tsx
│       ├── LoginModal.tsx
│       ├── BookingModal.tsx
│       ├── ProtectedRoute.tsx
│       ├── Header.tsx
│       ├── Footer.tsx
│       └── ...
└── styles/                    # Global CSS files
    ├── index.css             # Main CSS entry (imports fonts, tailwind, theme)
    ├── fonts.css
    ├── tailwind.css
    └── theme.css
```

### State Management

The application uses **React Context** for authentication state and **component-level state** (useState) for everything else:

- **AuthContext** (`src/app/contexts/AuthContext.tsx`): Manages user authentication state using localStorage
  - Stores mobile number and timestamp
  - Session expires after 30 days
  - Provides `isAuthenticated`, `mobileNumber`, `login()`, `logout()` to consuming components

- **App.tsx Global State**: The main `App.tsx` component manages application-wide state:
  - `bookings`: Array of user bookings
  - `bookmarkedOperatorIds`: Array of bookmarked operator IDs
  - `cart`: Array of cart items
  - State flows down via props to child components
  - Callback functions (e.g., `onAddToCart`, `onPayNow`, `onToggleBookmark`) flow down for state updates

### Routing

React Router v7 is used with the following routes:

- `/` - HomePage: Browse all operators and courts
- `/operator/:operatorId` - OperatorPage: View specific operator with their courts
- `/bookings` - MyBookings: User's booking history (protected)
- `/bookmarks` - MyBookmarks: User's bookmarked operators (protected)
- `/contact-us` - ContactUs: Contact form
- `/terms` - TermsPage: Terms of service
- `/privacy` - PrivacyPage: Privacy policy

**Protected Routes**: `/bookings` and `/bookmarks` use the `ProtectedRoute` component, which displays a login prompt if the user is not authenticated.

### Data Flow & Booking Process

1. **Browse**: Users browse courts on HomePage or OperatorPage
2. **Select**: Clicking "Book" opens a `BookingModal` where users select time slots
3. **Cart or Pay Now**:
   - **Add to Cart**: Adds item to cart state, can continue browsing
   - **Pay Now**: Immediately creates a booking and adds to bookings array
4. **Checkout**: Users can checkout from Cart (sheet component from the right), which converts all cart items to bookings

### Authentication Flow

- User clicks login → `LoginModal` opens
- User enters mobile number → stored in localStorage and AuthContext
- Protected routes check `isAuthenticated` from context
- If not authenticated, user sees a login prompt (not redirected)
- After login, any pending action (e.g., add to cart) is executed

### Key Domain Models

Defined in `src/app/types.ts`:

- **TimeSlot**: Individual time slot with id, time, availability, and price
- **Court**: A bookable court with type (basketball, pickleball, etc.), operator info, and available time slots
- **Operator**: Sports facility/venue with courts, amenities, contact info, and location
- **Booking**: Confirmed booking with court, time, date, and price information
- **CartItem**: Pending booking item in the cart

### Mock Data

- Located in `src/app/data/mockData.ts`
- Includes 6 operators across different cities (Dumaguete, Cebu, Manila, Davao)
- Multiple courts per operator with different sports types
- Each court has hourly time slots with varying prices and availability
- This is the single source of truth for all court and operator data

### Styling Approach

- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **shadcn/ui components** in `src/app/components/ui/`
- Utility-first approach with Tailwind classes
- Component variants using `class-variance-authority`
- `cn()` utility function in `src/app/components/ui/utils.ts` for merging Tailwind classes
- Custom theme variables in `src/styles/theme.css`
- Import path alias: `@/` maps to `src/` (configured in `vite.config.ts`)

### UI Component Library

Uses shadcn/ui components (in `src/app/components/ui/`):
- Dialog, Sheet, Card, Button, Badge
- Form components: Input, Select, Checkbox, Switch
- Data display: Table, Tabs, Accordion
- Feedback: Toast (sonner), Alert
- And many more...

Use these existing components rather than creating new ones when possible.

## Development Patterns

### Component Composition

- **Pages** are route-level components that receive props from App.tsx
- **Components** are reusable UI pieces that receive data and callbacks via props
- **Modals/Dialogs** receive `isOpen` and `onClose` props for controlled open/close state
- State is lifted to the nearest common ancestor when shared between components

### Prop Drilling

This app uses prop drilling from App.tsx to child components. When adding new features:
- Add state to App.tsx if it needs to be shared across routes
- Pass state and callbacks down through props
- Consider extracting to context only if the prop drilling becomes very deep (4+ levels)

### Working with Time Slots

Time slots are 1-hour intervals. When booking:
- Users select one or more contiguous time slots
- `timeSlotFrom` is the start time (e.g., "09:00 AM")
- `timeSlotTo` is the end time (e.g., "11:00 AM")
- Price is calculated by summing individual slot prices in the range
- The booking logic is in App.tsx: `handleAddToCart` and `handlePayNow`

### Toast Notifications

Uses `sonner` for toast notifications:
```typescript
import { toast } from 'sonner';
toast.success('Booking confirmed!', {
  description: 'Optional description'
});
```

## File Conventions

- **React components**: `.tsx` extension
- **TypeScript utilities**: `.ts` extension
- **CSS files**: `.css` extension
- **Component naming**: PascalCase (e.g., `BookingModal.tsx`)
- **Utility naming**: camelCase (e.g., `utils.ts`)

## Path Alias

Import from `src/` using the `@/` alias:
```typescript
import { Button } from '@/app/components/ui/button';
import { Court } from '@/app/types';
```

## Important Notes

### No Backend

This app uses **mock data only** and localStorage for persistence. There are no API calls, no database, and no real authentication. Keep this in mind when extending functionality.

### Authentication

The authentication system is intentionally simple (mobile number only, no OTP, stored in localStorage). It's meant for prototyping, not production use.

### Image Handling

- Images use Unsplash URLs in mock data
- The `ImageWithFallback` component (`src/app/components/figma/ImageWithFallback.tsx`) handles image loading with fallbacks

### Date Handling

Uses `date-fns` library for date formatting and manipulation:
```typescript
import { format } from 'date-fns';
format(new Date(), 'PPP'); // e.g., "April 29th, 2023"
```

### Protected Routes

When working with protected functionality:
1. Check if user is authenticated using `useAuth()` hook
2. For components, use the `requireAuth()` pattern (see App.tsx)
3. For route-level protection, wrap in `<ProtectedRoute>` component
