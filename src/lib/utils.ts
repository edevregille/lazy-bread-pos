import { Product, Cart } from "@/app/types";

// Function to calculate the total amount
export const calculateCartTotal = (products: Product[], cart: Cart) => {
  const total = products.reduce(
    (total, product) => total + product.unitCost * cart[product.id],
    0,
  );
  return total + (cart.additionalCharges ? cart.additionalCharges : 0);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};


export const fetchReaders = async () => {
    const response = await fetch('/api/readers', {
        method:'GET'
    });
    return await response.json();
}


export const pay = async (cart: Cart, email: string | null, reader_id: string) => {
    const response = await fetch('/api/payment', {
        method:'POST',
        body: JSON.stringify({
            cart, email, reader_id,
        }),
    });
    return await response.json();
}


export const retrievePaymentStatus = async (paymentId: string) => {
    const response = await fetch('/api/status', {
        method:'POST',
        body: JSON.stringify({
            paymentId,
        }),
    });
    return await response.json();
}