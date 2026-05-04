import { Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import { ReactNode } from 'react';

interface GuideBoxProps {
  type?: 'tip' | 'info' | 'success' | 'error';
  title?: string;
  children: ReactNode;
}

export const GuideBox = ({ type = 'info', title, children }: GuideBoxProps) => {
  const styles = {
    tip: {
      bg: 'bg-yellow-50', border: 'border-yellow-200',
      icon: 'text-yellow-500', text: 'text-yellow-800', title: 'text-yellow-900',
    },
    info: {
      bg: 'bg-blue-50', border: 'border-blue-200',
      icon: 'text-blue-500', text: 'text-blue-800', title: 'text-blue-900',
    },
    success: {
      bg: 'bg-green-50', border: 'border-green-200',
      icon: 'text-green-500', text: 'text-green-800', title: 'text-green-900',
    },
    error: {
      bg: 'bg-red-50', border: 'border-red-200',
      icon: 'text-red-500', text: 'text-red-800', title: 'text-red-900',
    },
  };

  // Fallback to 'info' if an unknown type is ever passed
  const style = styles[type] ?? styles['info'];
  const Icon  = type === 'success' ? CheckCircle : type === 'error' ? XCircle : Lightbulb;

  return (
    <div className={`${style.bg} border-2 ${style.border} rounded-lg p-4`}>
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} />
        <div>
          {title && <h4 className={`font-semibold ${style.title} mb-1`}>{title}</h4>}
          <p className={`${style.text} text-sm leading-relaxed`}>{children}</p>
        </div>
      </div>
    </div>
  );
};
