export interface Result {
  success: boolean;
  error?: string;
  paymentIntentStatus?: string;
}

export interface AdjustedItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PaymentAdjustment {
  originalAmount: number;
  reason?: string;
  items?: AdjustedItem[];
}

export const formatDeliveryDate = (dateString: string): string => {
  // Convert the ISO date string to a PST date
  const pstDate = new Date(dateString + 'T00:00:00-08:00'); // Force PST timezone  
  // Format the date in PST timezone
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: 'America/Los_Angeles'
  };
  
  return pstDate.toLocaleDateString('en-US', options) + ' (PST)';
};

export const markOrderAsDelivered = async (orderId: string): Promise<Result> => {
  
    try {
      const statusResponse = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, status: 'delivered' }),
      });

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json();
        throw new Error(`Status update failed: ${errorData.error}`);
      }

      const statusResult = await statusResponse.json();
      if (statusResult.success) {
        return {
          success: true
        };
      } else {
        throw new Error('Status update was not successful');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update order status'
      };
    }
}; 

export const capturePayment = async (
  paymentIntentId: string | undefined,
  customerId: string,
  paymentMethodId: string | undefined,
  amount: number,
  orderId: string,
  adjustment?: PaymentAdjustment
): Promise<Result> => {
    
    try {
        const captureResponse = await fetch('/api/stripe/capture-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              paymentIntentId,
              customerId,
              paymentMethodId,
              amount,
              orderId,
              originalAmount: adjustment?.originalAmount,
              adjustmentReason: adjustment?.reason,
              adjustedItems: adjustment?.items,
            }),
        });

        if (!captureResponse.ok) {
            const errorData = await captureResponse.json();
            throw new Error(`Payment capture failed: ${errorData.error || errorData.message}`);
        }

        const captureResult = await captureResponse.json();
        if (captureResult.success) {
            return {
                success: true,
                paymentIntentStatus: captureResult.paymentIntent.status,
            };
        } else {
            throw new Error('Payment capture was not successful');
        }
    } catch (error) {
        console.error('Error capturing payment:', error);
        return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture payment'
        };
    }
      
};  
