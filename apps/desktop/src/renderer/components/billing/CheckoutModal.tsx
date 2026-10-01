import React, { useEffect, useState } from 'react';
import { X, Loader2, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
// The "/pure" entry, deliberately. Importing '@stripe/stripe-js' has a side
// effect: it injects Stripe.js into the page the moment this module is loaded,
// i.e. at app start, because this modal is part of the main bundle. Stripe.js
// then opens two hidden cross-origin iframes (controller + fraud telemetry) and
// Chromium gives each its own renderer process: measured Sep 2026 at 78 MB +
// 94 MB sitting idle, with background beacons, for a checkout nobody opened.
// "/pure" loads nothing until loadStripe() is actually called.
import { loadStripe } from '@stripe/stripe-js/pure';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import api from '../../lib/api';

// const stripePromise = loadStripe('pk_test_51TEHWMFMuc1gePc3kkaRjapGaVdwJQTYPfgUTnr10nKDkwGYnO5azBaLTGojxQI1HeBd134j3lsPnLuzoLtI4tFR00Xd2GT2r8');

const CheckoutForm: React.FC<{ plan: string, price: string, onClose: () => void, onSuccess: () => void }> = ({ plan, price, onClose, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const displayPrice = price.startsWith('$') || /custom/i.test(price) ? price : `$${price}/mo`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setLoading(true);
    setError(null);

    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (pmError) throw new Error(pmError.message);

      const { data } = await api.post(`/api/billing/subscribe`, {
        plan, // Already uppercase ID from SnowBilling
        paymentMethodId: paymentMethod.id,
      });

      if (data.requiresAction) {
        const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret);
        if (confirmError) throw new Error(confirmError.message);
        // The bank approved it in the browser; have the server check with
        // Stripe and switch the plan now. 402 = Stripe has not marked the
        // subscription paid yet, so ask again shortly. Any other failure
        // (an older server without this route) is left to the webhook.
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await api.post('/api/billing/subscribe/confirm');
            break;
          } catch (confirmErr: any) {
            if (confirmErr?.response?.status !== 402) break;
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Subscription error:', err);
      // The server's message (a declined card, an unpaid invoice) beats axios's
      // generic "Request failed with status code 402".
      setError(err?.response?.data?.error || err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex justify-between items-end mb-1">
          <span className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Selected Plan</span>
          <span className="text-xs font-bold text-[#3b82f6] bg-blue-50 px-2 py-0.5 rounded-md">Recurring Monthly</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-[rgba(28,28,28,0.02)] rounded-2xl border border-[rgba(28,28,28,0.06)]">
          <span className="text-lg font-bold text-[#1C1C1C]">{plan}</span>
          <span className="text-xl font-black text-[#1C1C1C]">{displayPrice}</span>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest mb-2 block">Card Details</label>
        <div className="p-4 bg-white border border-[rgba(28,28,28,0.1)] rounded-2xl focus-within:border-[#1C1C1C] transition-colors shadow-sm">
          <CardElement options={{
            style: {
              base: {
                fontSize: '14px',
                color: '#1c1c1c',
                fontFamily: 'Mona Sans, system-ui, sans-serif',
                '::placeholder': { color: '#9ca3af' },
              },
            },
          }} />
        </div>
        <div className="flex items-center gap-2 mt-3 px-1">
          <Lock size={12} className="text-[rgba(28,28,28,0.3)]" />
          <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">Your payment info is encrypted and never stored on our servers.</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-medium animate-in fade-in zoom-in-95">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 py-3 text-xs font-bold text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-[2] py-3 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-black/10"
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> Processing…</>
          ) : (
            <><ShieldCheck size={14} /> Pay & Subscribe</>
          )}
        </button>
      </div>
    </form>
  );
};

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  plan: string;
  price: string;
  publishableKey?: string;
  onSuccess?: () => void | Promise<void>;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ open, onClose, plan, price, publishableKey, onSuccess }) => {
  const stripePromise = React.useMemo(() => {
    // Only once the checkout is really on screen.
    return open && publishableKey ? loadStripe(publishableKey) : null;
  }, [open, publishableKey]);

  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) setSuccess(false);
  }, [open, plan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8">

          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-[#1C1C1C] mb-3 tracking-tight">Subscription Successful!</h3>
              <p className="text-sm text-[rgba(28,28,28,0.6)] font-medium mb-8 max-w-[280px]">
                You have successfully upgraded to your new plan. Your new features are unlocked.
              </p>
              <button
                onClick={async () => {
                  await onSuccess?.();
                  onClose();
                }}
                className="w-full py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-xs font-bold hover:bg-black transition-all shadow-lg shadow-black/10"
              >
                Continue To Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-[#1C1C1C] tracking-tight">Upgrade Workspace</h2>
                <button onClick={onClose} className="p-2 hover:bg-[rgba(28,28,28,0.04)] rounded-full transition-colors">
                  <X size={20} className="text-[rgba(28,28,28,0.2)]" />
                </button>
              </div>

              <Elements stripe={stripePromise}>
                <CheckoutForm plan={plan} price={price} onClose={onClose} onSuccess={() => setSuccess(true)} />
              </Elements>

              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] leading-5 text-blue-700">
                <strong>Stripe Test Card:</strong> 4242 4242 4242 4242, any future expiry, any CVC and postal code.
              </div>
            </>
          )}

        </div>

        {!success && (
          <div className="bg-[rgba(28,28,28,0.02)] p-4 border-t border-[rgba(28,28,28,0.04)] flex items-center justify-center gap-4">
            <div className="opacity-20 grayscale flex gap-4">
              <span className="text-[10px] font-black italic">STRIPE</span>
              <span className="text-[10px] font-black italic">VISA</span>
              <span className="text-[10px] font-black italic">MASTERCARD</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
