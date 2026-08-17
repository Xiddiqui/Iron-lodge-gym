import * as React from 'react';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, onClick, onWheel, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    if (type === 'date') {
      return (
        <div className={cn('relative flex items-center w-full', className)}>
          <input
            type="date"
            ref={innerRef}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch (_) {}
              onClick?.(e);
            }}
            className={cn(
              'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-9 cursor-pointer',
              className
            )}
            {...props}
          />
          <Calendar className="absolute right-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          className
        )}
        ref={ref}
        onClick={onClick}
        onWheel={(e) => {
          if (type === 'number' || (e.target as HTMLInputElement).type === 'number') {
            (e.target as HTMLElement)?.blur();
          }
          onWheel?.(e);
        }}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };

