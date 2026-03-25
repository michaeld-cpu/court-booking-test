import React from 'react';

interface DynamicClockProps {
  time: string; // e.g., "7:00 AM" or "14:00"
  className?: string;
}

export function DynamicClock({ time, className = "size-4" }: DynamicClockProps) {
  // Parse time string to get hours and minutes
  const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    // Remove any whitespace and convert to uppercase
    const cleanTime = timeStr.trim().toUpperCase();
    
    // Check if it's in 12-hour format (has AM/PM)
    const has12HourFormat = cleanTime.includes('AM') || cleanTime.includes('PM');
    const isPM = cleanTime.includes('PM');
    
    // Extract the time part (remove AM/PM)
    const timePart = cleanTime.replace(/AM|PM/g, '').trim();
    
    // Split by colon
    const [hourStr, minuteStr] = timePart.split(':');
    let hours = parseInt(hourStr, 10);
    const minutes = parseInt(minuteStr || '0', 10);
    
    // Convert to 24-hour format if needed
    if (has12HourFormat) {
      if (isPM && hours !== 12) {
        hours += 12;
      } else if (!isPM && hours === 12) {
        hours = 0;
      }
    }
    
    // Convert to 12-hour for display (0-11)
    hours = hours % 12;
    
    return { hours, minutes };
  };

  const { hours, minutes } = parseTime(time);
  
  // Calculate angles
  // Hour hand: 30 degrees per hour + 0.5 degrees per minute
  const hourAngle = (hours * 30) + (minutes * 0.5);
  
  // Minute hand: 6 degrees per minute
  const minuteAngle = minutes * 6;
  
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Clock circle */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      
      {/* Center dot */}
      <circle
        cx="12"
        cy="12"
        r="1"
        fill="currentColor"
      />
      
      {/* Hour hand (shorter, thicker) */}
      <line
        x1="12"
        y1="12"
        x2="12"
        y2="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        transform={`rotate(${hourAngle} 12 12)`}
      />
      
      {/* Minute hand (longer, thinner) */}
      <line
        x1="12"
        y1="12"
        x2="12"
        y2="4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${minuteAngle} 12 12)`}
      />
    </svg>
  );
}
