import { Clock, Check } from 'lucide-react';

export const getStatusIcon = (status, deliveredCount = 0, readCount = 0) => {
  switch (status) {
    case 'sending':
      return (
        <Clock 
          className="w-3 h-3 text-gray-400 animate-pulse" 
          strokeWidth={2}
        />
      );
    
    case 'sent':
      return (
        <Check 
          className="w-3 h-3 text-gray-400" 
          strokeWidth={2.5}
        />
      );
    
    case 'delivered':
      return (
        <div className="relative flex items-center">
          <Check 
            className="w-3 h-3 text-gray-400" 
            strokeWidth={2.5}
          />
          <Check 
            className="w-3 h-3 text-gray-400 -ml-1.5" 
            strokeWidth={2.5}
          />
        </div>
      );
    
    case 'read':
    case 'seen':
      return (
        <div className="relative flex items-center">
          <Check 
            className="w-3 h-3 text-blue-500" 
            strokeWidth={2.5}
          />
          <Check 
            className="w-3 h-3 text-blue-500 -ml-1.5" 
            strokeWidth={2.5}
          />
        </div>
      );
    
    default:
      return (
        <></>
      );
  }
};