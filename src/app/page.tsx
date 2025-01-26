"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { Reader } from "@/components/reader";
import { Input } from "@/components/input";
import { StatusMessage } from "@/components/statusMessage";
import Header from "@/components/Header";
import { useSession } from "next-auth/react";
import { Reader as ReaderType } from "@stripe/terminal-js";
import { Product, Cart, LogLevel } from "./types";
import { products } from "@/config/config";
import { calculateCartTotal, isValidEmail, fetchReaders, pay, retrievePaymentStatus } from "@/lib/utils";
import Receipt from "@/components/receipt";

const initQty: Cart = {
  additionalCharges: 0,
};

products.map((el: Product) => el.id).forEach((el: string) => (initQty[el] = 0));

export default function Home() {
  const { data: session } = useSession();
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
      const readers: ReaderType[] = (await fetchReaders()).readers;
      setReader(readers[0]);
    })();
  }, []);

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
    if (totalAmount > 0.5 && reader && reader.status === "online") {
      setIsModalReceiptOpen(true);
    } else {
      setStatusMsg({
        level: "error",
        message:
          "The reader needs to be online and the amount should be > $0.5",
      });
    }
  };

  // process payment
  const processFinalPayment = async (email: string | null) => {
    setIsProcessing(true);
    setIsModalReceiptOpen(false);
    if (reader && reader.id) {
      const resp = await pay(
        cart,
        email && isValidEmail(email) ? email : null,
        reader.id,
      );
      if (resp.error) setStatusMsg({ level: "error", message: resp.message });
      else {
        setPaymentId(resp.id);
        setStatusMsg({
          level: "info",
          message: "payment processing - check terminal",
        });
      }
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
    <div className="font-sans bg-gray-100 min-h-screen p-6">
      <Header />
      {session && (
        <>
          <Reader reader={reader} />
          <br/><br/>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white p-6 rounded-lg shadow-md text-center"
              >
                <h2 className="text-xl font-semibold mb-4 text-black">
                  {product.name}
                </h2>
                <p className="text-gray-500 mb-4">
                  Unit Cost: ${product.unitCost}
                </p>

                <div className="flex justify-center items-center gap-4 mb-6">
                  <button
                    onClick={() =>
                      handleQuantityChange(product.id, "decrement")
                    }
                    className="bg-gray-300 text-lg p-2 rounded-full hover:bg-gray-400 text-black"
                  >
                    -
                  </button>
                  <span className="text-xl text-black">{cart[product.id]}</span>
                  <button
                    onClick={() =>
                      handleQuantityChange(product.id, "increment")
                    }
                    className="bg-gray-300 text-lg p-2 rounded-full hover:bg-gray-400 text-black"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          {isModalReceiptOpen && (
            <Receipt processFinalPayment={processFinalPayment} />
          )}
          <br />
          <div className="grid grid-cols-1 sm:grid-cols-1 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <Input
                label={"Additional Charges"}
                value={cart.additionalCharges}
                handleAdditionalCharge={handleAdditionalCharge}
              />
            </div>
          </div>

          <div className="mt-8 text-center">
            <h3 className="text-2xl font-bold mb-4 text-black">
              Total Amount: ${calculateCartTotal(products, cart)}
            </h3>
            <button
              onClick={handleReset}
              className="bg-red-500 text-white py-2 px-6 rounded-lg shadow-md hover:bg-red-600 m-4"
            >
              Reset
            </button>
            {!isProcessing && (
              <>
                <button
                  onClick={handleCheckout}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Checkout
                </button>
              </>
            )}
            {isProcessing && statusMsg.level !== "error" && (
              <button
                onClick={checkPaymentStatus}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Check Payment Status
              </button>
            )}
            <br />
            <br />
            {isProcessing && (
              <StatusMessage
                text={statusMsg?.message || ""}
                level={statusMsg?.level || "info"}
              />
            )}
          </div>
          <br />
        </>
      )}
    </div>
  );
}
