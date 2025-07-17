// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Reader: React.FC<any> = ({ reader }) => {
  if (!reader) {
    return (
      <div className="w-full max-w-xs p-3 sm:p-4 rounded-lg shadow-md bg-yellow-100 border-l-4 border-yellow-600">
        <div className="flex items-center mb-2">
          <div className="w-3 h-3 rounded-full mr-2 bg-yellow-600" />
          <h3 className="text-sm text-gray-700">No Terminal Reader</h3>
        </div>
        <p className="text-xs text-gray-600">
          Please check your Stripe Terminal connection
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-xs p-3 sm:p-4 rounded-lg shadow-md transition-all ${
        reader.status === "offline" 
          ? "bg-red-100 border-l-4 border-red-600" 
          : reader.status === "online"
          ? "bg-green-100 border-l-4 border-green-600"
          : "bg-yellow-100 border-l-4 border-yellow-600"
      }`}
    >
      <div className="flex items-center mb-2">
        <div
          className={`w-3 h-3 rounded-full mr-2 ${
            reader.status === "offline" 
              ? "bg-red-600" 
              : reader.status === "online"
              ? "bg-green-600"
              : "bg-yellow-600"
          }`}
        />
        <h3 className="text-sm text-gray-700">Reader {reader.label}</h3>
      </div>
      <p className="text-xs text-gray-600 capitalize">
        Status: {reader.status}
      </p>
    </div>
  );
};
