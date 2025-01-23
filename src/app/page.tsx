'use client'
import { useState, useEffect, ChangeEvent } from 'react';
import {Reader} from '@/components/reader';
import { Input } from '@/components/input';
import { processPayment, fetchReader, checkStatus } from '../../actions/stripe';
import { StatusMessage, } from '@/components/statusMessage';
import Header from '@/components/Header'
import { useSession,  } from 'next-auth/react';
import {Reader as ReaderType
} from '@stripe/terminal-js';
import { Product, Cart, LogLevel} from './types';

const products: Product[] = [
  {
    id: 'small_soup',
    name: 'Small Soup',
    unitCost: 5,
  },
  {
    id: 'large_soup',
    name: 'Large Soup',
    unitCost: 8,
  },
  {
    id: 'small_bread',
    name: 'Small Bread',
    unitCost: 4,
  },
  {
    id: 'large_bread',
    name: 'Large Bread',
    unitCost: 8,
  },
];


// initialize a cart
const initQty: Cart = {
  additionalCharges: 0
};
products.map((el: Product) => el.id)
  .forEach((el:string) => initQty[el] = 0 ) 

export default function Home() {
  const { data: session } = useSession();
  const [quantities, setQuantities] = useState<Cart>(initQty);
  const [reader, setReader] = useState<ReaderType | null>(null);
  const [statusMsg, setStatusMsg] = useState<{level:LogLevel, message:string}>({level:"info", message: ""});
  const [paymentId, setPaymentId] = useState<string|undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);

  console.log(session)
  
  useEffect( () => {
    (async () => {
      const readers: ReaderType[] = await fetchReader();
      setReader(readers[0]);
    })()
  } , [])

  // Function to handle quantity change
  const handleQuantityChange = (productId: string, action: 'increment' | 'decrement') => {
    setQuantities((prev: Cart ) => {
      const newQuantity = action === 'increment' ? prev[productId] + 1 : prev[productId] - 1;
      if (newQuantity >= 0) {
        return { ...prev, [productId]: newQuantity };
      }
      return prev;
    });
  };

  // Function to calculate the total amount
  const calculateTotal = () => {
    const total = products.reduce(
      (total, product) => total + product.unitCost * quantities[product.id],
      0
    )
    return total + quantities.additionalCharges;
  };

  //
  const handleAdditionalCharge = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLButtonElement;
    setQuantities({ 
      ... quantities,
      additionalCharges:Number(target.value) 
    })
  }

  // Handle checkout
  const handleCheckout = async () => {
    setIsProcessing(true);
    const totalAmount = calculateTotal();
    if(totalAmount > 0.5 && reader && reader.status === "online"){
      const resp = await processPayment(totalAmount, reader.id);
      if(resp.error) setStatusMsg({level: "error", message:resp.message});
      else {
        setPaymentId(resp.payment_intent);
        setStatusMsg({level:"info", message: "payment processing - check terminal"});
      }
    }
    else {
      setStatusMsg({ level: "error", message:"The reader needs to be online and the amount should be > $0.5"})
    } 
  };

  const checkPaymentStatus = async ()=> {
    if(paymentId) {
      const response = await checkStatus(paymentId);
      setStatusMsg({level: response.status === "succeeded" ? "success" : "info", message: response.status});
    }
  }

  return (
    <div className="font-sans bg-gray-100 min-h-screen p-6">
      <Header />
      { session && <>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white p-6 rounded-lg shadow-md text-center"
            >
              <h2 className="text-xl font-semibold mb-4 text-black">{product.name}</h2>
              <p className="text-gray-500 mb-4">Unit Cost: ${product.unitCost}</p>

              <div className="flex justify-center items-center gap-4 mb-6">
                <button
                  onClick={() => handleQuantityChange(product.id, 'decrement')}
                  className="bg-gray-300 text-lg p-2 rounded-full hover:bg-gray-400 text-black"
                >
                  -
                </button>
                <span className="text-xl text-black">{quantities[product.id]}</span>
                <button
                  onClick={() => handleQuantityChange(product.id, 'increment')}
                  className="bg-gray-300 text-lg p-2 rounded-full hover:bg-gray-400 text-black"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <br />
        <div className="grid grid-cols-1 sm:grid-cols-1 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <Input 
              label={"Additional Charges"} 
              handleAdditionalCharge={handleAdditionalCharge}
            />
          </div>
        </div>
        

        <div className="mt-8 text-center">
          <h3 className="text-2xl font-bold mb-4 text-black">Total Amount: ${calculateTotal()}</h3>
          
          {!isProcessing &&<button
            onClick={handleCheckout}
            className="bg-green-500 text-white py-2 px-6 rounded-lg shadow-md hover:bg-green-600"
          >
            Checkout
          </button>}
          {isProcessing && statusMsg.level !== "error" && <button
            onClick={checkPaymentStatus}
            className="bg-green-500 text-white py-2 px-6 rounded-lg shadow-md hover:bg-green-600"
          >
            Check Payment Status
          </button>
          }
          <br /><br />
          {isProcessing && <StatusMessage text={statusMsg?.message || ""} level={statusMsg?.level || "info" } />}
        
        </div>
        <br/>
        <Reader 
          reader={reader}
        />
      </>}
    </div>
  );
}