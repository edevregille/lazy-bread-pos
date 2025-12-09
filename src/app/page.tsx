"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { Reader } from "@/components/reader";
import { Input } from "@/components/input";
import { StatusMessage } from "@/components/statusMessage";
import Header from "@/components/Header";
import OrdersList from "@/components/OrdersList";
import { useSession } from "next-auth/react";
import { Reader as ReaderType } from "@stripe/terminal-js";
import { Product, Cart, LogLevel } from "./types";
import { products } from "@/config/config";
import { calculateCartTotal, isValidEmail, fetchReaders, pay, retrievePaymentStatus } from "@/lib/utils";
import Receipt from "@/components/receipt";
import SubscriptionsList from "@/components/SubscriptionsList";
import CustomersList from "@/components/CustomersList";

const initQty: Cart = {
  additionalCharges: 0,
};

products.map((el: Product) => el.id).forEach((el: string) => (initQty[el] = 0));

export default function Home() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'pos' | 'orders' | 'subscriptions' | 'customers'>('pos');
  const [cart, setCart] = useState<Cart>(initQty);
  const [reader, setReader] = useState<ReaderType | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    level: LogLevel;
    message: string;
  }>({ level: "info", message: "" });
  const [paymentId, setPaymentId] = useState<string | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalReceiptOpen, setIsModalReceiptOpen] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      if(session) {
        const result = await fetchReaders();
        console.log('result', result)
        if (result.success && result.readers.length > 0) {
          setReader(result.readers[0]);
        } else if (!result.success) {
          setStatusMsg({
            level: "error",
            message: `Failed to connect to Stripe Terminal: ${result.error}`,
          });
        } else {
          setStatusMsg({
            level: "error",
            message: "No Stripe Terminal readers found. Please check your terminal connection.",
          });
        }
      }
    })();
  }, [session]);

  // Function to handle quantity change
  const handleQuantityChange = (
    productId: string,
    action: "increment" | "decrement",
  ) => {
    setCart((prev: Cart) => {
      const newQuantity =
        action === "increment" ? prev[productId] + 1 : prev[productId] - 1;
      if (newQuantity >= 0) {
        return { ...prev, [productId]: newQuantity };
      }
      return prev;
    });
  };

  const handleAdditionalCharge = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLButtonElement;
    setCart({
      ...cart,
      additionalCharges: Number(target.value),
    });
  };

  const handleReset = () => {
    setCart(initQty);
    if (isProcessing) setIsProcessing(false);
  };

  // Handle checkout
  const handleCheckout = async () => {
    const totalAmount = calculateCartTotal(products, cart);
    
    if (totalAmount <= 0.5) {
      setStatusMsg({
        level: "error",
        message: "Total amount must be greater than $0.50",
      });
      return;
    }
    
    if (!reader) {
      setStatusMsg({
        level: "error",
        message: "No Stripe Terminal reader available. Please check your terminal connection.",
      });
      return;
    }
    
    if (reader.status !== "online") {
      setStatusMsg({
        level: "error",
        message: `Stripe Terminal reader is ${reader.status}. Please ensure the reader is connected and online.`,
      });
      return;
    }
    
    setIsModalReceiptOpen(true);
  };

  // process payment
  const processFinalPayment = async (email: string | null) => {
    setIsProcessing(true);
    setIsModalReceiptOpen(false);
    
    if (!reader || !reader.id) {
      setStatusMsg({ 
        level: "error", 
        message: "No Stripe Terminal reader available. Please check your terminal connection." 
      });
      setIsProcessing(false);
      return;
    }
    
    try {
      const resp = await pay(
        cart,
        email && isValidEmail(email) ? email : null,
        reader.id,
      );
      
      if (resp.error) {
        setStatusMsg({ level: "error", message: resp.message });
      } else {
        setPaymentId(resp.id);
        setStatusMsg({
          level: "info",
          message: "Payment processing - check terminal",
        });
      }
    } catch {
      setStatusMsg({ 
        level: "error", 
        message: "Failed to process payment. Please try again." 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (paymentId) {
      const response = await retrievePaymentStatus(paymentId);
      setStatusMsg({
        level: response.status === "succeeded" ? "success" : "info",
        message: response.status,
      });
    }
  };

  return (
    <div className="font-sans bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 min-h-screen p-3 sm:p-4 md:p-6">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      {session && (
        <>

          {/* POS Tab Content */}
          {activeTab === 'pos' && (
            <div className="space-y-6 sm:space-y-8">
              <Reader reader={reader} />
              
              {/* Products Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                {products.map((product) => {
                  const quantity = cart[product.id];
                  const isSelected = quantity > 0;
                  return (
                    <div
                      key={product.id}
                      className={`group bg-white/90 backdrop-blur-sm p-5 sm:p-6 rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
                        isSelected
                          ? 'border-blue-500 shadow-blue-500/20 bg-gradient-to-br from-blue-50/50 to-white'
                          : 'border-transparent hover:border-gray-200'
                      }`}
                    >
                      <div className="text-center">
                        <h2 className="text-lg sm:text-xl font-bold mb-2 text-gray-900 group-hover:text-blue-600 transition-colors">
                          {product.name}
                        </h2>
                        <div className="mb-4 sm:mb-5">
                          <span className="text-2xl sm:text-3xl font-bold text-blue-600">
                            ${product.unitCost}
                          </span>
                          <span className="text-sm text-gray-500 ml-1">each</span>
                        </div>

                        <div className="flex justify-center items-center gap-3 sm:gap-4 mb-3">
                          <button
                            onClick={() =>
                              handleQuantityChange(product.id, "decrement")
                            }
                            disabled={quantity === 0}
                            className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 text-gray-700 text-lg sm:text-xl font-semibold p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md"
                            aria-label={`Decrease ${product.name} quantity`}
                          >
                            −
                          </button>
                          <div className="relative">
                            <span className={`text-2xl sm:text-3xl font-bold min-w-[40px] inline-block transition-all duration-200 ${
                              isSelected ? 'text-blue-600 scale-110' : 'text-gray-700'
                            }`}>
                              {quantity}
                            </span>
                            {isSelected && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              handleQuantityChange(product.id, "increment")
                            }
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-lg sm:text-xl font-semibold p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg shadow-blue-500/30"
                            aria-label={`Increase ${product.name} quantity`}
                          >
                            +
                          </button>
                        </div>
                        {isSelected && (
                          <div className="mt-2 text-sm font-medium text-blue-600">
                            ${(product.unitCost * quantity).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isModalReceiptOpen && (
                <Receipt processFinalPayment={processFinalPayment} />
              )}

              {/* Additional Charges */}
              <div className="bg-white/90 backdrop-blur-sm p-5 sm:p-6 rounded-2xl shadow-lg border border-gray-200/50">
                <Input
                  label={"Additional Charges"}
                  value={cart.additionalCharges}
                  handleAdditionalCharge={handleAdditionalCharge}
                />
              </div>

              {/* Cart Summary & Actions */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 sm:p-8 rounded-2xl shadow-2xl text-white">
                <div className="text-center mb-6">
                  <p className="text-sm sm:text-base text-blue-100 mb-2 font-medium">
                    Total Amount
                  </p>
                  <h3 className="text-4xl sm:text-5xl font-bold mb-1">
                    ${calculateCartTotal(products, cart).toFixed(2)}
                  </h3>
                  <div className="h-1 w-24 bg-white/30 rounded-full mx-auto mt-3"></div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center">
                  <button
                    onClick={handleReset}
                    disabled={isProcessing}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto border border-white/30"
                  >
                    Reset Cart
                  </button>
                  {!isProcessing && (
                    <button
                      onClick={handleCheckout}
                      disabled={calculateCartTotal(products, cart) <= 0.5}
                      className="bg-white text-blue-600 hover:bg-blue-50 font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto text-lg"
                    >
                      Checkout →
                    </button>
                  )}
                  {isProcessing && statusMsg.level !== "error" && (
                    <button
                      onClick={checkPaymentStatus}
                      className="bg-white text-blue-600 hover:bg-blue-50 font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 w-full sm:w-auto text-lg"
                    >
                      Check Payment Status
                    </button>
                  )}
                </div>

                {isProcessing && (
                  <div className="mt-6">
                    <StatusMessage
                      text={statusMsg?.message || ""}
                      level={statusMsg?.level || "info"}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orders Tab Content */}
          {activeTab === 'orders' && (
            <OrdersList />
          )}

          {/* Subscriptions Tab Content */}
          {activeTab === 'subscriptions' && (
            <SubscriptionsList />
          )}

          {/* Customers Tab Content */}
          {activeTab === 'customers' && (
            <CustomersList />
          )}
        </>
      )}
    </div>
  );
}
