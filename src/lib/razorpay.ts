import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Razorpay Key ID from environment
//const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_ID = "rzp_test_S6VSjQt222ctmL";

export interface RazorpayPlan {
  name: string;
  priceINR: number;
  priceUSD: number;
  period: 'monthly' | 'yearly';
}

export interface SubscriptionData {
  planName: string;
  amount: number;
  currency: string;
  paymentId: string;
  orderId?: string;
  signature?: string;
  status: 'pending' | 'success' | 'failed';
  createdAt: any;
  userId?: string;
  organizationId?: string;
  email?: string;
}

// Plan prices in INR (convert from USD approximately)
export const planPrices: Record<string, RazorpayPlan> = {
  Starter: {
    name: 'Starter',
    priceINR: 4099, // ~$49
    priceUSD: 49,
    period: 'monthly',
  },
  Professional: {
    name: 'Professional',
    priceINR: 8299, // ~$99
    priceUSD: 99,
    period: 'monthly',
  },
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Load Razorpay script dynamically
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface PaymentOptions {
  planName: string;
  amount: number;
  currency?: string;
  email?: string;
  contact?: string;
  name?: string;
  userId?: string;
  organizationId?: string;
  onSuccess?: (response: any, subscriptionId: string) => void;
  onError?: (error: any) => void;
}

// Initialize payment with Razorpay
export const initiatePayment = async ({
  planName,
  amount,
  currency = 'INR',
  email,
  contact,
  name,
  userId,
  organizationId,
  onSuccess,
  onError,
}: PaymentOptions): Promise<void> => {
  const isLoaded = await loadRazorpayScript();
  
  if (!isLoaded) {
    onError?.({ message: 'Failed to load Razorpay SDK' });
    return;
  }

  if (!RAZORPAY_KEY_ID) {
    onError?.({ message: 'Razorpay Key ID not configured' });
    return;
  }

  // Create pending subscription in Firebase
  const subscriptionRef = await addDoc(collection(db, 'subscriptions'), {
    planName,
    amount,
    currency,
    status: 'pending',
    createdAt: serverTimestamp(),
    userId: userId || null,
    organizationId: organizationId || null,
    email: email || null,
  });

  const options = {
    key: RAZORPAY_KEY_ID,
    amount: amount * 100, // Razorpay expects amount in paise
    currency,
    name: 'HR Management System',
    description: `${planName} Plan Subscription`,
    image: '/favicon.ico',
    prefill: {
      name: name || '',
      email: email || '',
      contact: contact || '',
    },
    notes: {
      planName,
      subscriptionId: subscriptionRef.id,
    },
    theme: {
      color: '#7c3aed', // Primary purple color
    },
    handler: async (response: any) => {
      try {
        // Update subscription status in Firebase
        await updateDoc(doc(db, 'subscriptions', subscriptionRef.id), {
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id || null,
          signature: response.razorpay_signature || null,
          status: 'success',
          completedAt: serverTimestamp(),
        });
        
        onSuccess?.(response, subscriptionRef.id);
      } catch (error) {
        console.error('Error updating subscription:', error);
        onError?.(error);
      }
    },
    modal: {
      ondismiss: async () => {
        // Update status to failed if modal is closed without payment
        await updateDoc(doc(db, 'subscriptions', subscriptionRef.id), {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
        });
      },
    },
  };

  const razorpay = new window.Razorpay(options);
  
  razorpay.on('payment.failed', async (response: any) => {
    await updateDoc(doc(db, 'subscriptions', subscriptionRef.id), {
      status: 'failed',
      errorCode: response.error.code,
      errorDescription: response.error.description,
      errorSource: response.error.source,
      errorReason: response.error.reason,
      failedAt: serverTimestamp(),
    });
    
    onError?.(response.error);
  });

  razorpay.open();
};
