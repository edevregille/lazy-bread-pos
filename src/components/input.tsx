import { ChangeEventHandler } from "react";
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const Input: React.FC<{
  label: string;
  value: number | undefined;
  handleAdditionalCharge: ChangeEventHandler<HTMLInputElement>;
}> = ({ label, value, handleAdditionalCharge }) => {
  return (
    <div>
      <label className="block text-lg sm:text-xl font-bold text-center mb-4 text-gray-800">
        {label}
      </label>
      <div className="mt-2">
        <div className="flex items-center rounded-xl bg-white/90 backdrop-blur-sm pl-4 pr-2 py-2 shadow-md border-2 border-gray-200/50 focus-within:border-blue-500 focus-within:shadow-lg transition-all duration-200">
          <div className="shrink-0 select-none text-lg sm:text-xl font-semibold text-gray-600">
            $
          </div>
          <input
            onChange={handleAdditionalCharge}
            value={value}
            type="text"
            name="price"
            id="price"
            className="block min-w-0 grow py-2 pl-2 pr-2 text-lg sm:text-xl font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
            placeholder="0.00"
          />
          <div className="grid shrink-0 grid-cols-1 focus-within:relative">
            <select
              id="currency"
              name="currency"
              aria-label="Currency"
              className="col-start-1 row-start-1 w-full appearance-none rounded-lg py-2 pl-3 pr-8 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option>USD</option>
            </select>
            <svg
              className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              data-slot="icon"
            >
              <path
                fillRule="evenodd"
                d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
