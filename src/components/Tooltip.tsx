import { ReactNode, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip = ({ content, children, position = 'top' }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  const arrowClasses = {
    top: 'top-full border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full border-l-gray-700 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full border-r-gray-700 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children || <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600" />}
      </div>

      {isVisible && (
        <div
          className={`absolute ${positionClasses[position]} z-50 px-3 py-2 bg-gray-700 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none shadow-lg`}
        >
          {content}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
          />
        </div>
      )}
    </div>
  );
};
