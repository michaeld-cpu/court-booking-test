import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/app/lib/toast';

export function PaymentSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.success('Payment successful', {
      description: 'Your booking has been paid successfully.',
    });
    navigate('/bookings', { replace: true });
  }, [navigate]);

  return null;
}
