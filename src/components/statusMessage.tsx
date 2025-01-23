
type LogLevel = 'info' | 'warning' | 'error' | 'success';

export const StatusMessage: React.FC<{text: string, level: LogLevel}> = ({ text, level }) => {
  const getLogLevelStyles = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'bg-blue-100 border-l-4 border-blue-600 text-blue-700';
      case 'warning':
        return 'bg-yellow-100 border-l-4 border-yellow-600 text-yellow-700';
      case 'error':
        return 'bg-red-100 border-l-4 border-red-600 text-red-700';
      case 'success':
        return 'bg-green-100 border-l-4 border-green-600 text-green-700';
      default:
        return '';
    }
  };

  return (
    <div
      className={`max-w-xs p-4 rounded-lg shadow-md transition-all ${getLogLevelStyles(level)}`}
    >
      <div className="flex items-center mb-2">
        <div className={`w-3 h-3 rounded-full mr-2 ${level === 'info' ? 'bg-blue-600' : level === 'warning' ? 'bg-yellow-600' : level === 'error' ? 'bg-red-600' : 'bg-green-600'}`} />
        <p className="font-medium">{text}</p>
      </div>
    </div>
  );
};