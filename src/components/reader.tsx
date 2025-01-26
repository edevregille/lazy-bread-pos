// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Reader: React.FC<any> = ({ reader }) => {
  return (
    <>
      {reader && (
        <div
          className={`max-w-xs p-4 rounded-lg shadow-md transition-all ${reader.status === "offline" ? "bg-red-100 border-l-4 border-red-600" : "bg-green-100 border-l-4 border-green-600"}`}
        >
          <div className="flex items-center mb-2">
            <div
              className={`w-3 h-3 rounded-full mr-2 ${
                reader.status === "offline" ? "bg-red-600" : "bg-green-600"
              }`}
            />
            <h3 className="text-sm text-gray-700">Reader {reader.label}</h3>
          </div>
        </div>
      )}
    </>
  );
};
