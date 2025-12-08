// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Reader: React.FC<any> = ({ reader }) => {
  if (!reader) {
    return (
      <div className="w-full max-w-sm p-4 sm:p-5 rounded-2xl shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-2 border-yellow-400/50 backdrop-blur-sm">
        <div className="flex items-center mb-2">
          <div className="w-3 h-3 rounded-full mr-3 bg-yellow-500 animate-pulse shadow-sm" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-800">No Terminal Reader</h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 ml-5">
          Please check your Stripe Terminal connection
        </p>
      </div>
    );
  }

  const statusConfig = {
    offline: {
      bg: "from-red-50 to-red-100/50",
      border: "border-red-400/50",
      dot: "bg-red-500",
      text: "text-red-800"
    },
    online: {
      bg: "from-green-50 to-green-100/50",
      border: "border-green-400/50",
      dot: "bg-green-500",
      text: "text-green-800"
    },
    default: {
      bg: "from-yellow-50 to-yellow-100/50",
      border: "border-yellow-400/50",
      dot: "bg-yellow-500",
      text: "text-yellow-800"
    }
  };

  const config = reader.status === "offline" 
    ? statusConfig.offline
    : reader.status === "online"
    ? statusConfig.online
    : statusConfig.default;

  return (
    <div
      className={`w-full max-w-sm p-4 sm:p-5 rounded-2xl shadow-lg bg-gradient-to-br ${config.bg} border-2 ${config.border} backdrop-blur-sm transition-all duration-300`}
    >
      <div className="flex items-center mb-2">
        <div
          className={`w-3 h-3 rounded-full mr-3 ${config.dot} shadow-sm ${
            reader.status === "online" ? "animate-pulse" : ""
          }`}
        />
        <h3 className={`text-sm sm:text-base font-semibold ${config.text}`}>
          Reader {reader.label}
        </h3>
      </div>
      <p className={`text-xs sm:text-sm ${config.text} ml-5 capitalize font-medium`}>
        Status: {reader.status}
      </p>
    </div>
  );
};
