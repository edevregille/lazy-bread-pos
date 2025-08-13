export interface Result {
  success: boolean;
  error?: string;
  paymentIntentStatus?: string;
}

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

export const capturePayment = async (paymentIntentId: string): Promise<Result> => {
    
    try {
        const captureResponse = await fetch('/api/stripe/capture-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentIntentId }),
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

export const getPaymentIntentStatus = async (paymentIntentId: string): Promise<string> => {
  const response = await fetch('/api/stripe/status-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentIntentId }),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch payment intent status');
  }
  const data = await response.json();
  return data.paymentIntent.status;
};  