import { useState } from "react";

export default function Receipt({ processFinalPayment }) {
  const [email, setEmail] = useState("");

  const handleEmailOnChange = (e) => {
    setEmail(e.target.value);
  };

  return (
    <div
      id="receiptModal"
      className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl text-black font-semibold">
            Do you want a receipt?
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email Address
            </label>
            <input
              onChange={handleEmailOnChange}
              type="email"
              id="email"
              name="email"
              className="mt-1 block w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm sm:text-base"
              placeholder="Enter your email (optional)"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between mt-4">
          <button
            onClick={() => processFinalPayment()}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm sm:text-base w-full sm:w-auto"
          >
            Skip
          </button>
          <button
            onClick={() => processFinalPayment(email)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm sm:text-base w-full sm:w-auto"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
